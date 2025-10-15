import { camelCase, InstructionNode, pascalCase, structTypeNodeFromInstructionArgumentNodes } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { addFragmentImports, Fragment, fragment, getCodeFileFragment, mergeFragments } from '../utils';
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
        fragments.push(getAccountsInterfaceFragment(node));
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

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

function getAccountsInterfaceFragment(node: InstructionNode): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}InstructionAccounts`;

    if (node.accounts.length === 0) {
        return fragment``;
    }

    const fields = node.accounts.map(account => {
        const fieldName = camelCase(account.name);
        const optional = account.isOptional ? '?' : '';
        const isSigner = account.isSigner === 'either' ? 'PublicKey | Keypair' : 'PublicKey';

        return addFragmentImports(fragment`${fieldName}${optional}: ${isSigner}`, 'web3', ['PublicKey', 'Keypair']);
    });

    const fieldsContent = mergeFragments(fields, cs => cs.map(c => `    ${c};`).join('\n'));

    return addFragmentImports(fragment`export interface ${interfaceName} {\n${fieldsContent}\n}`, 'web3', 'PublicKey');
}

function getArgsInterfaceFragment(node: InstructionNode, typeVisitor: TypeVisitor): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}InstructionArgs`;

    // Filter out arguments with defaultValueStrategy: 'omitted' (like discriminators)
    const userArgs = node.arguments.filter(arg => arg.defaultValueStrategy !== 'omitted');

    if (userArgs.length === 0) {
        return fragment``;
    }

    const fields = userArgs.map(arg => {
        const fieldName = camelCase(arg.name);
        const fieldType = visit(arg.type, typeVisitor);
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
        const isWritable = account.isWritable ?? false;

        // Handle "either" case - check if it's a Keypair at runtime
        let signerCheck: string;
        if (account.isSigner === 'either') {
            signerCheck = `'publicKey' in accounts.${accountName}`;
        } else {
            signerCheck = String(account.isSigner ?? false);
        }

        // For pubkey, handle both Keypair.publicKey and direct PublicKey
        const pubkeyAccess =
            account.isSigner === 'either'
                ? `'publicKey' in accounts.${accountName} ? accounts.${accountName}.publicKey : accounts.${accountName}`
                : `accounts.${accountName}`;

        return fragment`{ pubkey: ${pubkeyAccess}, isSigner: ${signerCheck}, isWritable: ${isWritable} }`;
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

    // Check if we have user-facing args (non-omitted)
    const userArgs = node.arguments.filter(arg => arg.defaultValueStrategy !== 'omitted');
    const hasUserArgs = userArgs.length > 0;

    // Build function parameters
    const params: string[] = [];
    if (hasAccounts) {
        params.push(`accounts: ${accountsType}`);
    }
    if (hasUserArgs) {
        params.push(`args: ${argsType}`);
    }
    params.push(`programId: PublicKey`);

    const paramsStr = params.join(', ');

    // Build the keys array
    const keysArrayFragment = getKeysArrayFragment(node);

    // Generate data serialization
    let dataFragment: Fragment;
    if (hasArgs) {
        // Check if there are omitted args (like discriminators) with default values
        const omittedArgs = node.arguments.filter(arg => arg.defaultValueStrategy === 'omitted');

        if (omittedArgs.length > 0 && hasUserArgs) {
            // Need to merge user args with default values
            const defaultValues = omittedArgs.map(arg => {
                const argName = camelCase(arg.name);
                // Get the default value - for discriminators it's typically a bytes value
                if (arg.defaultValue && arg.defaultValue.kind === 'bytesValueNode') {
                    const hexData = arg.defaultValue.data;
                    return fragment`${argName}: Buffer.from('${hexData}', 'hex')`;
                }
                return fragment`${argName}: undefined`;
            });

            const defaultValuesContent = mergeFragments(defaultValues, cs => cs.join(', '));
            dataFragment = fragment`const buffer = Buffer.alloc(1000);
    ${schemaName}.encode({ ${defaultValuesContent}, ...args }, buffer);
    const data = buffer.subarray(0, ${schemaName}.getSpan(buffer));`;
        } else if (omittedArgs.length > 0) {
            // Only omitted args, no user args
            const defaultValues = omittedArgs.map(arg => {
                const argName = camelCase(arg.name);
                if (arg.defaultValue && arg.defaultValue.kind === 'bytesValueNode') {
                    const hexData = arg.defaultValue.data;
                    return fragment`${argName}: Buffer.from('${hexData}', 'hex')`;
                }
                return fragment`${argName}: undefined`;
            });

            const defaultValuesContent = mergeFragments(defaultValues, cs => cs.join(', '));
            dataFragment = fragment`const buffer = Buffer.alloc(1000);
    ${schemaName}.encode({ ${defaultValuesContent} }, buffer);
    const data = buffer.subarray(0, ${schemaName}.getSpan(buffer));`;
        } else {
            // No omitted args
            dataFragment = fragment`const buffer = Buffer.alloc(1000);
    ${schemaName}.encode(args, buffer);
    const data = buffer.subarray(0, ${schemaName}.getSpan(buffer));`;
        }
    } else {
        dataFragment = fragment`const data = Buffer.alloc(0);`;
    }

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
