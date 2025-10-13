import { camelCase, InstructionNode, pascalCase, structTypeNodeFromInstructionArgumentNodes } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { addFragmentImports, Fragment, fragment, mergeFragments } from '../utils';
import { BorshSchemaVisitor, TypeVisitor } from '../visitors';

export function getInstructionFunctionFragment(
    node: InstructionNode,
    typeVisitor: TypeVisitor,
    borshSchemaVisitor: BorshSchemaVisitor,
): Fragment {
    const hasAccounts = node.accounts.length > 0;
    const hasArgs = node.arguments.length > 0;

    const fragments: Fragment[] = [];

    // 2. Generate Accounts interface (if there are accounts)
    if (hasAccounts) {
        fragments.push(getAccountsInterfaceFragment(node, typeVisitor));
    }

    // 3. Generate Args interface (if there are arguments)
    if (hasArgs) {
        fragments.push(getArgsInterfaceFragment(node, typeVisitor));
    }

    // 4. Generate Borsh schema (if there are arguments)
    if (hasArgs) {
        fragments.push(getInstructionSchemaFragment(node, borshSchemaVisitor));
    }

    // 5. Generate the instruction builder function
    fragments.push(getInstructionBuilderFragment(node, hasAccounts, hasArgs));

    return mergeFragments(fragments, cs => cs.join('\n\n'));
}

function getAccountsInterfaceFragment(node: InstructionNode, typeVisitor: TypeVisitor): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}InstructionAccounts`;

    if (node.accounts.length === 0) {
        return fragment``;
    }

    const fields = node.accounts.map(account => {
        const fieldName = camelCase(account.name);
        const optional = account.isOptional ? '?' : '';
        return addFragmentImports(fragment`${fieldName}${optional}: PublicKey`, 'web3', 'PublicKey');
    });

    const fieldsContent = mergeFragments(fields, cs => cs.map(c => `    ${c};`).join('\n'));

    return addFragmentImports(fragment`export interface ${interfaceName} {\n${fieldsContent}\n}`, 'web3', 'PublicKey');
}

function getArgsInterfaceFragment(node: InstructionNode, typeVisitor: TypeVisitor): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}InstructionArgs`;

    if (node.arguments.length === 0) {
        return fragment``;
    }

    const fields = node.arguments.map(arg => {
        const fieldName = camelCase(arg.name);
        const fieldType = visit(arg.type, typeVisitor);
        console.log('FieldType', fieldType);
        return fragment`${fieldName}: ${fieldType}`;
    });

    const fieldsContent = mergeFragments(fields, cs => cs.map(c => `    ${c};`).join('\n'));

    return fragment`export interface ${interfaceName} {\n${fieldsContent}\n}`;
}

function getInstructionSchemaFragment(node: InstructionNode, borshSchemaVisitor: BorshSchemaVisitor): Fragment {
    const name = pascalCase(node.name);
    const schemaName = `${name}InstructionDataSchema`;

    if (node.arguments.length === 0) {
        return fragment``;
    }

    // Create a struct type from the instruction arguments
    const argsStruct = structTypeNodeFromInstructionArgumentNodes(node.arguments);
    const schema = visit(argsStruct, borshSchemaVisitor);

    return fragment`const ${schemaName} = ${schema};`;
}

function getKeysArrayFragment(node: InstructionNode): Fragment {
    if (node.accounts.length === 0) {
        return fragment`const keys: AccountMeta[] = [];`;
    }

    const accountEntries = node.accounts.map(account => {
        const accountName = camelCase(account.name);
        const isSigner = account.isSigner ?? false;
        const isWritable = account.isWritable ?? false;

        return fragment`{ pubkey: accounts.${accountName}, isSigner: ${isSigner}, isWritable: ${isWritable} }`;
    });

    const entriesContent = mergeFragments(accountEntries, cs => cs.map(c => `        ${c},`).join('\n'));

    return addFragmentImports(
        fragment`const keys: AccountMeta[] = [\n${entriesContent}\n    ];`,
        'web3',
        'AccountMeta',
    );
}

function getInstructionBuilderFragment(node: InstructionNode, hasAccounts: boolean, hasArgs: boolean): Fragment {
    const name = pascalCase(node.name);
    const functionName = `create${name}Instruction`;
    const accountsType = `${name}InstructionAccounts`;
    const argsType = `${name}InstructionArgs`;
    const schemaName = `${name}InstructionDataSchema`;

    // Build function parameters
    const params: string[] = [];
    if (hasAccounts) {
        params.push(`accounts: ${accountsType}`);
    }
    if (hasArgs) {
        params.push(`args: ${argsType}`);
    }
    params.push(`programId: PublicKey`);

    const paramsStr = params.join(', ');

    // Build the keys array
    const keysArrayFragment = getKeysArrayFragment(node);

    // Generate data serialization
    const dataFragment = hasArgs
        ? addFragmentImports(fragment`const data = Buffer.from(serialize(${schemaName}, args));`, 'borsh', 'serialize')
        : fragment`const data = Buffer.alloc(0);`;

    // Build return statement
    const returnFragment = addFragmentImports(
        fragment`return new TransactionInstruction({ keys, programId, data });`,
        'web3',
        'TransactionInstruction',
    );

    // Combine function body
    const functionBody = mergeFragments([keysArrayFragment, dataFragment, fragment``, returnFragment], cs =>
        cs.join('\n    '),
    );

    // Add imports
    let result = addFragmentImports(
        fragment`export function ${functionName}(${paramsStr}): TransactionInstruction {\n    ${functionBody}\n}`,
        'web3',
        ['PublicKey', 'TransactionInstruction'],
    );

    if (hasAccounts) {
        result = addFragmentImports(result, 'web3', 'AccountMeta');
    }

    return result;
}
