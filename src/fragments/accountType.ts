import { AccountNode, pascalCase } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { addFragmentImports, Fragment, fragment, getCodeFileFragment, mergeFragments } from '../utils';
import { BorshSchemaVisitor, TypeVisitor } from '../visitors';

export function getAccountTypeFragment(
    node: AccountNode,
    typeVisitor: TypeVisitor,
    borshSchemaVisitor: BorshSchemaVisitor,
): Fragment {
    const fragments: Fragment[] = [];

    // 1. Generate AccountData interface
    console.log(`      1️⃣  Generating AccountData interface...`);
    fragments.push(getAccountDataInterfaceFragment(node, typeVisitor));

    // 2. Generate Account interface (address + data)
    console.log(`      2️⃣  Generating Account interface...`);
    fragments.push(getAccountInterfaceFragment(node));

    // 3. Generate Borsh schema for deserialization
    console.log(`      3️⃣  Generating Borsh schema...`);
    fragments.push(getAccountSchemaFragment(node, borshSchemaVisitor));

    // 4. Generate deserialize function
    console.log(`      4️⃣  Generating deserialize function...`);
    fragments.push(getDeserializeAccountFragment(node));

    // 5. Generate fetch function
    console.log(`      5️⃣  Generating fetch function...`);
    fragments.push(getFetchAccountFragment(node));

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

    console.log(`         → Visiting node.data to generate schema...`);
    const schema = visit(node.data, borshSchemaVisitor);
    console.log(`         → Schema generated: ${schema.content.substring(0, 100)}...`);

    // Manually merge to ensure imports are preserved
    const constFragment = fragment`const ${schemaName} = `;
    const semicolonFragment = fragment`;`;

    const result = mergeFragments([constFragment, schema, semicolonFragment], cs => cs.join(''));
    console.log(`         → Final schema: const ${schemaName} = ${schema.content.substring(0, 60)}...;`);

    return result;
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
        return fragment`export function ${functionName}(data: Buffer): ${dataTypeName} {
    const deserialized = ${schemaName}.decode(data);
    const { ${destructureFields}, ...accountData } = deserialized;
    return accountData as ${dataTypeName};
}`;
    }

    // No discriminator - deserialize entire buffer
    return fragment`export function ${functionName}(data: Buffer): ${dataTypeName} {
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
