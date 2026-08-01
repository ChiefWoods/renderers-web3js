import { AccountNode, camelCase, pascalCase, resolveNestedTypeNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    DEFAULT_NAME_TRANSFORMERS,
    DiscriminatorInfo,
    Fragment,
    fragment,
    getCodeFileFragment,
    getDiscriminatorConstantContent,
    getDiscriminatorInfos,
    getDiscriminatorValidationContent,
    getNameApi,
    NameApi,
    ParsedCustomDataOptions,
    PathOverrides,
    use,
} from '../utils';
import { getGpaFiltersFromAccountNode } from '../utils/gpaFilters';
import { TypeManifestVisitor } from '../visitors/getTypeManifestVisitor';

const defaultNameApi = getNameApi(DEFAULT_NAME_TRANSFORMERS);

export function getAccountTypeFragment(
    node: AccountNode,
    typeManifestVisitor: TypeManifestVisitor,
    customAccountData: ParsedCustomDataOptions = new Map(),
    dependencyMap: PathOverrides = {},
    nameApi: NameApi = defaultNameApi,
): Fragment {
    const customData = customAccountData.get(node.name);
    const fragments: Fragment[] = [];
    const resolvedData = resolveNestedTypeNode(node.data);
    const discriminators = getDiscriminatorInfos(node.name, 'account', node.discriminators ?? [], resolvedData.fields);

    if (discriminators.length > 0) {
        fragments.push(fragment`${discriminators.map(getDiscriminatorConstantContent).join('\n\n')}`);
    }

    if (customData) {
        const dataTypeName = pascalCase(customData.importAs);
        const schemaName = `${dataTypeName}Codec`;

        fragments.push(
            addFragmentImports(
                fragment`export type { ${dataTypeName} };
export { ${schemaName} };`,
                customData.importFrom,
                [dataTypeName, schemaName],
            ),
        );
        fragments.push(getAccountInterfaceFragment(node, dataTypeName));
        fragments.push(
            getDeserializeAccountFragment(
                node,
                dataTypeName,
                schemaName,
                /* stripDiscriminators */ false,
                nameApi,
                discriminators,
            ),
        );
    } else {
        fragments.push(getAccountDataTypeFragment(node, typeManifestVisitor, nameApi));
        fragments.push(getAccountInterfaceFragment(node, nameApi.accountDataType(node.name)));
        fragments.push(getAccountDecoderFragment(node, typeManifestVisitor, nameApi));
        fragments.push(
            getDeserializeAccountFragment(
                node,
                nameApi.accountDataType(node.name),
                undefined,
                true,
                nameApi,
                discriminators,
            ),
        );
    }

    fragments.push(getFetchAccountFragment(node, nameApi));
    fragments.push(getFetchAllAccountsFragment(node, nameApi));

    const gpaFragment = getFetchProgramAccountsFragment(node, nameApi);
    if (gpaFragment) {
        fragments.push(gpaFragment);
    }

    return getCodeFileFragment(fragments, dependencyMap);
}

function getAccountDataTypeFragment(
    node: AccountNode,
    typeManifestVisitor: TypeManifestVisitor,
    nameApi: NameApi,
): Fragment {
    const interfaceName = nameApi.accountDataType(node.name);
    const discriminatorNames = new Set(
        (node.discriminators || []).filter(d => d.kind === 'fieldDiscriminatorNode').map(d => d.name),
    );

    const manifest = visit(node, typeManifestVisitor);
    if (node.data.kind === 'structTypeNode' && discriminatorNames.size > 0) {
        // Rebuild type without discriminator fields for the public AccountData type.
        const filteredFields = node.data.fields.filter(field => !discriminatorNames.has(field.name));
        const filteredStruct = { ...node.data, fields: filteredFields };
        const filteredManifest = visit(filteredStruct, typeManifestVisitor);
        return fragment`export type ${interfaceName} = ${filteredManifest.strictType};`;
    }

    return fragment`export type ${interfaceName} = ${manifest.strictType};`;
}

function getAccountInterfaceFragment(
    node: AccountNode,
    dataTypeName = `${pascalCase(node.name)}AccountData`,
): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}Account`;

    return addFragmentImports(
        fragment`export interface ${interfaceName} {
    address: Address;
    data: ${dataTypeName};
}`,
        'web3',
        'Address',
    );
}

function getAccountDecoderFragment(
    node: AccountNode,
    typeManifestVisitor: TypeManifestVisitor,
    nameApi: NameApi,
): Fragment {
    const dataTypeName = nameApi.accountDataType(node.name);
    const decoderFunction = `get${dataTypeName}Decoder`;
    const manifest = visit(node, typeManifestVisitor);
    const decoderType = use('type Decoder', 'codecs');
    const hasFieldDiscriminators = (node.discriminators || []).some(d => d.kind === 'fieldDiscriminatorNode');

    // When discriminators are stripped from the public AccountData type, the decoder still
    // returns them — type the decoder against the full on-wire shape so deserialize can strip.
    const returnType = hasFieldDiscriminators ? manifest.strictType : dataTypeName;

    return fragment`function ${decoderFunction}(): ${decoderType}<${returnType}> {
    return ${manifest.decoder};
}`;
}

function getDeserializeAccountFragment(
    node: AccountNode,
    dataTypeName = `${pascalCase(node.name)}AccountData`,
    schemaName?: string,
    stripDiscriminators = true,
    nameApi: NameApi = defaultNameApi,
    discriminators: DiscriminatorInfo[] = [],
): Fragment {
    const name = pascalCase(node.name);
    const functionName = `deserialize${name}Account`;
    const decoderCall = schemaName
        ? `${schemaName}.decode(data)`
        : `get${nameApi.accountDataType(node.name)}Decoder().decode(data)`;

    const discriminatorNames = (node.discriminators || [])
        .filter(d => d.kind === 'fieldDiscriminatorNode')
        .map(d => d.name);

    const hasDiscriminator = stripDiscriminators && discriminatorNames.length > 0;
    const validation = discriminators.map(info => getDiscriminatorValidationContent(info)).join('\n    ');

    if (hasDiscriminator) {
        const destructureFields = discriminatorNames.map(n => `${camelCase(n)}: _`).join(', ');
        return fragment`export function ${functionName}(data: Uint8Array): ${dataTypeName} {
    ${validation}
    const deserialized = ${decoderCall};
    const { ${destructureFields}, ...accountData } = deserialized;
    return accountData as ${dataTypeName};
}`;
    }

    return fragment`export function ${functionName}(data: Uint8Array): ${dataTypeName} {
    ${validation}
    return ${decoderCall};
}`;
}

function getFetchAccountFragment(node: AccountNode, nameApi: NameApi): Fragment {
    const name = pascalCase(node.name);
    const functionName = nameApi.accountFetchFunction(node.name);
    const accountTypeName = nameApi.accountType(node.name);
    const deserializeFunctionName = nameApi.accountDeserializeFunction(node.name);

    return addFragmentImports(
        fragment`export async function ${functionName}(
    connection: Connection,
    address: Address
): Promise<${accountTypeName}> {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
        throw new Error('${name} account not found at address: ' + address.toBase58());
    }
    return {
        address,
        data: ${deserializeFunctionName}(accountInfo.data),
    };
}`,
        'web3',
        ['Connection', 'Address'],
    );
}

function getFetchAllAccountsFragment(node: AccountNode, nameApi: NameApi): Fragment {
    const name = pascalCase(node.name);
    const fetchAllFunctionName = nameApi.accountFetchAllFunction(node.name);
    const fetchAllMaybeFunctionName = nameApi.accountFetchAllMaybeFunction(node.name);
    const accountTypeName = nameApi.accountType(node.name);
    const deserializeFunctionName = nameApi.accountDeserializeFunction(node.name);

    return addFragmentImports(
        fragment`export async function ${fetchAllMaybeFunctionName}(
    connection: Connection,
    addresses: Address[]
): Promise<(${accountTypeName} | null)[]> {
    const accountInfos = await connection.getMultipleAccountsInfo(addresses);
    return accountInfos.map((accountInfo, index) => {
        if (!accountInfo) {
            return null;
        }
        return {
            address: addresses[index],
            data: ${deserializeFunctionName}(accountInfo.data),
        };
    });
}

export async function ${fetchAllFunctionName}(
    connection: Connection,
    addresses: Address[]
): Promise<${accountTypeName}[]> {
    const maybeAccounts = await ${fetchAllMaybeFunctionName}(connection, addresses);
    const missingAddresses = maybeAccounts
        .flatMap((account, i) => (!account ? [addresses[i].toBase58()] : []))
        .join(', ');
    if (missingAddresses) {
        throw new Error('${name} account(s) not found at address(es): ' + missingAddresses);
    }
    return maybeAccounts.filter((a): a is ${accountTypeName} => a !== null);
}`,
        'web3',
        ['Connection', 'Address'],
    );
}

function getFetchProgramAccountsFragment(node: AccountNode, nameApi: NameApi): Fragment | undefined {
    const filters = getGpaFiltersFromAccountNode(node);
    if (!filters) return undefined;

    const functionName = nameApi.accountFetchProgramAccountsFunction(node.name);
    const accountTypeName = nameApi.accountType(node.name);
    const deserializeFunctionName = nameApi.accountDeserializeFunction(node.name);

    const filterEntries: string[] = [];
    if (filters.memcmp) {
        filterEntries.push(`{ memcmp: { offset: ${filters.memcmp.offset}, bytes: '${filters.memcmp.bytes}' } }`);
    }
    if (filters.dataSize != null) {
        filterEntries.push(`{ dataSize: ${filters.dataSize} }`);
    }
    const filtersLiteral = `[${filterEntries.join(', ')}]`;

    return addFragmentImports(
        fragment`export async function ${functionName}(
    connection: Connection,
    programId: Address,
    options?: {
        commitment?: 'processed' | 'confirmed' | 'finalized';
        filters?: GetProgramAccountsFilter[];
    }
): Promise<${accountTypeName}[]> {
    const accounts = await connection.getProgramAccounts(programId, {
        commitment: options?.commitment,
        filters: [...${filtersLiteral}, ...(options?.filters ?? [])],
    });
    return accounts.map(({ pubkey, account }) => ({
        address: pubkey,
        data: ${deserializeFunctionName}(account.data),
    }));
}`,
        'web3',
        ['Connection', 'GetProgramAccountsFilter', 'Address'],
    );
}
