import { AccountNode, pascalCase } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { addFragmentImports, Fragment, fragment, getCodeFileFragment, mergeFragments } from '../utils';
import { getGpaFiltersFromAccountNode } from '../utils/gpaFilters';
import { BorshSchemaVisitor, TypeVisitor } from '../visitors';

export function getAccountTypeFragment(
    node: AccountNode,
    typeVisitor: TypeVisitor,
    borshSchemaVisitor: BorshSchemaVisitor,
): Fragment {
    const fragments: Fragment[] = [];

    // 1. Generate AccountData interface
    fragments.push(getAccountDataInterfaceFragment(node, typeVisitor));

    // 2. Generate Account interface (address + data)
    fragments.push(getAccountInterfaceFragment(node));

    // 3. Generate Borsh schema for deserialization
    fragments.push(getAccountSchemaFragment(node, borshSchemaVisitor));

    // 4. Generate deserialize function
    fragments.push(getDeserializeAccountFragment(node));

    // 5. Generate fetch function
    fragments.push(getFetchAccountFragment(node));

    // 6. Generate fetchAll functions
    fragments.push(getFetchAllAccountsFragment(node));

    // 7. Generate fetchProgramAccounts (GPA) when filters available
    const gpaFragment = getFetchProgramAccountsFragment(node);
    if (gpaFragment) {
        fragments.push(gpaFragment);
    }

    return getCodeFileFragment(fragments);
}

function getAccountDataInterfaceFragment(node: AccountNode, typeVisitor: TypeVisitor): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}AccountData`;

    // Get discriminator field names to exclude from the interface
    const discriminatorNames = (node.discriminators || [])
        .filter(d => d.kind === 'fieldDiscriminatorNode')
        .map(d => d.name);

    if (node.data.kind === 'structTypeNode') {
        const filteredFields = node.data.fields.filter(field => !discriminatorNames.includes(field.name));

        // Create a new struct node without discriminator fields
        const filteredStruct = { ...node.data, fields: filteredFields };
        const dataType = visit(filteredStruct, typeVisitor);

        if (dataType.content.startsWith('export interface') || dataType.content.startsWith('export type')) {
            return fragment`${dataType.content.replace(/export (interface|type) \w+/, `export interface ${interfaceName}`)}`;
        }
        return fragment`export interface ${interfaceName} ${dataType}`;
    }

    // Fallback for non-struct types
    const dataType = visit(node.data, typeVisitor);
    if (dataType.content.startsWith('export interface') || dataType.content.startsWith('export type')) {
        return fragment`${dataType.content.replace(/export (interface|type) \w+/, `export interface ${interfaceName}`)}`;
    }
    return fragment`export interface ${interfaceName} ${dataType}`;
}

function getAccountInterfaceFragment(node: AccountNode): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}Account`;
    const dataInterfaceName = `${name}AccountData`;

    return addFragmentImports(
        fragment`export interface ${interfaceName} {
    address: PublicKey;
    data: ${dataInterfaceName};
}`,
        'web3',
        'PublicKey',
    );
}

function getAccountSchemaFragment(node: AccountNode, borshSchemaVisitor: BorshSchemaVisitor): Fragment {
    const name = pascalCase(node.name);
    const schemaName = `${name}AccountDataCodec`;

    const schema = visit(node.data, borshSchemaVisitor);

    // Manually merge to ensure imports are preserved
    const constFragment = fragment`const ${schemaName} = `;
    const semicolonFragment = fragment`;`;

    return mergeFragments([constFragment, schema, semicolonFragment], cs => cs.join(''));
}

function getDeserializeAccountFragment(node: AccountNode): Fragment {
    const name = pascalCase(node.name);
    const functionName = `deserialize${name}Account`;
    const dataTypeName = `${name}AccountData`;
    const schemaName = `${name}AccountDataCodec`;

    // Check if account has discriminator fields
    const discriminatorNames = (node.discriminators || [])
        .filter(d => d.kind === 'fieldDiscriminatorNode')
        .map(d => d.name);

    const hasDiscriminator = discriminatorNames.length > 0;

    if (hasDiscriminator) {
        // Deserialize all fields, then filter out discriminators
        const destructureFields = discriminatorNames.map(name => `${name}: _`).join(', ');
        return fragment`export function ${functionName}(data: Uint8Array): ${dataTypeName} {
    const deserialized = ${schemaName}.decode(data);
    const { ${destructureFields}, ...accountData } = deserialized;
    return accountData as ${dataTypeName};
}`;
    }

    // No discriminator - deserialize entire buffer
    return fragment`export function ${functionName}(data: Uint8Array): ${dataTypeName} {
    return ${schemaName}.decode(data);
}`;
}

function getFetchAccountFragment(node: AccountNode): Fragment {
    const name = pascalCase(node.name);
    const functionName = `fetch${name}Account`;
    const accountTypeName = `${name}Account`;
    const deserializeFunctionName = `deserialize${name}Account`;

    return addFragmentImports(
        fragment`export async function ${functionName}(
    connection: Connection,
    address: PublicKey
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
        ['Connection', 'PublicKey'],
    );
}

function getFetchAllAccountsFragment(node: AccountNode): Fragment {
    const name = pascalCase(node.name);
    const fetchAllFunctionName = `fetchAll${name}Accounts`;
    const fetchAllMaybeFunctionName = `fetchAllMaybe${name}Accounts`;
    const accountTypeName = `${name}Account`;
    const deserializeFunctionName = `deserialize${name}Account`;

    return addFragmentImports(
        fragment`export async function ${fetchAllMaybeFunctionName}(
    connection: Connection,
    addresses: PublicKey[]
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
    addresses: PublicKey[]
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
        ['Connection', 'PublicKey'],
    );
}

function getFetchProgramAccountsFragment(node: AccountNode): Fragment | undefined {
    const filters = getGpaFiltersFromAccountNode(node);
    if (!filters) return undefined;

    const name = pascalCase(node.name);
    const functionName = `fetchProgramAccounts${name}`;
    const accountTypeName = `${name}Account`;
    const deserializeFunctionName = `deserialize${name}Account`;

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
    programId: PublicKey,
    options?: { commitment?: 'processed' | 'confirmed' | 'finalized' }
): Promise<${accountTypeName}[]> {
    const accounts = await connection.getProgramAccounts(programId, {
        commitment: options?.commitment,
        filters: ${filtersLiteral},
    });
    return accounts.map(({ pubkey, account }) => ({
        address: pubkey,
        data: ${deserializeFunctionName}(account.data),
    }));
}`,
        'web3',
        ['Connection', 'PublicKey'],
    );
}
