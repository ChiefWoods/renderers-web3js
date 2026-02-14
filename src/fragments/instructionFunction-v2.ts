import {
    camelCase,
    InstructionNode,
    isNode,
    NumberTypeNode,
    pascalCase,
    structTypeNodeFromInstructionArgumentNodes,
} from '@codama/nodes';
import { ResolvedInstructionInput, visit } from '@codama/visitors-core';

import { addFragmentImports, Fragment, fragment, getCodeFileFragment, mergeFragments } from '../utils';
import { BorshSchemaVisitor, getValueVisitor, TypeVisitor } from '../visitors';

function getUserArgs(node: InstructionNode) {
    return node.arguments.filter(arg => arg.defaultValueStrategy !== 'omitted');
}

function getDiscriminatorArg(node: InstructionNode) {
    return node.arguments.find(
        arg => arg.defaultValueStrategy === 'omitted' && arg.name === 'discriminator' && !!arg.defaultValue,
    );
}

function usesRawStringEncoding(node: InstructionNode) {
    const userArgs = getUserArgs(node);
    const discriminatorArg = getDiscriminatorArg(node);
    return userArgs.length === 1 && userArgs[0].type.kind === 'stringTypeNode' && !discriminatorArg;
}

function getNumericDiscriminatorBufferFragment(
    bufferName: string,
    discriminatorValue: Fragment,
    discriminatorType: NumberTypeNode,
): Fragment {
    const endian = discriminatorType.endian === 'be' ? 'BE' : 'LE';
    const endianLower = discriminatorType.endian === 'be' ? 'be' : 'le';
    switch (discriminatorType.format) {
        case 'u8':
            return fragment`const ${bufferName} = Buffer.alloc(1);
    ${bufferName}.writeUInt8(Number(${discriminatorValue}), 0);`;
        case 'u16':
            return fragment`const ${bufferName} = Buffer.alloc(2);
    ${bufferName}.writeUInt16${endian}(Number(${discriminatorValue}), 0);`;
        case 'u32':
            return fragment`const ${bufferName} = Buffer.alloc(4);
    ${bufferName}.writeUInt32${endian}(Number(${discriminatorValue}), 0);`;
        case 'u64':
            return fragment`const ${bufferName} = Buffer.alloc(8);
    ${bufferName}.writeBigUInt64${endian}(BigInt(${discriminatorValue}), 0);`;
        case 'i8':
            return fragment`const ${bufferName} = Buffer.alloc(1);
    ${bufferName}.writeInt8(Number(${discriminatorValue}), 0);`;
        case 'i16':
            return fragment`const ${bufferName} = Buffer.alloc(2);
    ${bufferName}.writeInt16${endian}(Number(${discriminatorValue}), 0);`;
        case 'i32':
            return fragment`const ${bufferName} = Buffer.alloc(4);
    ${bufferName}.writeInt32${endian}(Number(${discriminatorValue}), 0);`;
        case 'i64':
            return fragment`const ${bufferName} = Buffer.alloc(8);
    ${bufferName}.writeBigInt64${endian}(BigInt(${discriminatorValue}), 0);`;
        case 'u128':
            return addFragmentImports(
                fragment`const ${bufferName} = new BN(String(${discriminatorValue})).toArrayLike(Buffer, '${endianLower}', 16);`,
                'bn.js',
                'BN',
            );
        case 'i128':
            return addFragmentImports(
                fragment`const ${bufferName} = new BN(String(${discriminatorValue})).toTwos(128).toArrayLike(Buffer, '${endianLower}', 16);`,
                'bn.js',
                'BN',
            );
        default:
            return fragment`const ${bufferName} = Buffer.alloc(4);
    ${bufferName}.writeUInt32LE(Number(${discriminatorValue}), 0);`;
    }
}

export function getInstructionFunctionFragment(
    node: InstructionNode,
    typeVisitor: TypeVisitor,
    borshSchemaVisitor: BorshSchemaVisitor,
    resolvedInputs: ResolvedInstructionInput[] = [],
): Fragment {
    console.log(`\n   🏗️  [Fragment:Instruction] Building instruction for: ${node.name}`);
    console.log(`      Accounts: ${node.accounts.length}, Args: ${node.arguments.length}`);
    const hasAccounts = node.accounts.length > 0;
    const hasArgs = node.arguments.length > 0;

    const fragments: Fragment[] = [];

    // 1. Generate Accounts interface (if there are accounts)
    if (hasAccounts) {
        fragments.push(getAccountsInterfaceFragment(node, resolvedInputs));
    }

    // 2. Generate Args interface (if there are arguments)
    if (hasArgs) {
        fragments.push(getArgsInterfaceFragment(node, typeVisitor));
    }

    // 3. Generate Borsh schema (if there are arguments)
    if (hasArgs) {
        fragments.push(getInstructionSchemaFragment(node, borshSchemaVisitor));
    }

    // 4. Generate the instruction builder function
    fragments.push(getInstructionBuilderFragment(node, hasAccounts, hasArgs, resolvedInputs));

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

function getAccountsInterfaceFragment(node: InstructionNode, resolvedInputs: ResolvedInstructionInput[]): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}InstructionAccounts`;

    if (node.accounts.length === 0) {
        return fragment``;
    }

    const fields = node.accounts.map(account => {
        const fieldName = camelCase(account.name);
        const resolvedInput = resolvedInputs.find(
            input => input.kind === 'instructionAccountNode' && input.name === account.name,
        );
        const hasDerivableDefault =
            resolvedInput?.defaultValue?.kind === 'pdaValueNode' ||
            resolvedInput?.defaultValue?.kind === 'programIdValueNode' ||
            resolvedInput?.defaultValue?.kind === 'accountValueNode';
        const optional = account.isOptional || hasDerivableDefault ? '?' : '';
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

    // Filter out omitted arguments (like discriminators) - they should not be in the schema
    const userArgs = getUserArgs(node);
    if (userArgs.length === 0 || usesRawStringEncoding(node)) {
        return fragment``;
    }

    // Create a struct type from only the user-facing arguments
    const argsStruct = structTypeNodeFromInstructionArgumentNodes(userArgs);
    const schema = visit(argsStruct, borshSchemaVisitor);

    // Manually merge to ensure imports are preserved
    const constFragment = fragment`const ${schemaName} = `;
    const semicolonFragment = fragment`;`;

    return mergeFragments([constFragment, schema, semicolonFragment], cs => cs.join(''));
}

function getKeysArrayFragment(node: InstructionNode, resolvedInputs: ResolvedInstructionInput[]): Fragment {
    if (node.accounts.length === 0) {
        return addFragmentImports(fragment`const keys: AccountMeta[] = [];`, 'web3', 'AccountMeta');
    }

    const requiredAccounts: Fragment[] = [];
    const optionalAccounts: Fragment[] = [];

    node.accounts.forEach(account => {
        const accountName = camelCase(account.name);
        const isWritable = account.isWritable ?? false;

        // Check if this account has a derived default value
        const resolvedInput = resolvedInputs.find(
            input => input.kind === 'instructionAccountNode' && input.name === account.name,
        );
        const hasDerivedDefault =
            resolvedInput?.defaultValue?.kind === 'pdaValueNode' ||
            resolvedInput?.defaultValue?.kind === 'programIdValueNode';

        // Handle "either" case - check if it's a Keypair at runtime
        let signerCheck: string;
        if (account.isSigner === 'either') {
            // For derived accounts, check the local variable; for others, check accounts.xxx
            const checkTarget = hasDerivedDefault ? accountName : `accounts.${accountName}`;
            signerCheck = `'publicKey' in ${checkTarget}`;
        } else {
            signerCheck = String(account.isSigner ?? false);
        }

        // For pubkey: use local variable if derived, otherwise use accounts.xxx
        const pubkeyAccess = hasDerivedDefault
            ? accountName // Use the derived variable (already resolved in defaults)
            : account.isSigner === 'either'
              ? `'publicKey' in accounts.${accountName} ? accounts.${accountName}.publicKey : accounts.${accountName}`
              : `accounts.${accountName}`;

        const entry = fragment`{ pubkey: ${pubkeyAccess}, isSigner: ${signerCheck}, isWritable: ${isWritable} }`;

        // PDA-derived accounts are always included after derivation (they become required)
        if (hasDerivedDefault) {
            requiredAccounts.push(entry);
        } else if (account.isOptional) {
            // Truly optional accounts use spread operator
            optionalAccounts.push(fragment`...(accounts.${accountName} ? [${entry}] : [])`);
        } else {
            requiredAccounts.push(entry);
        }
    });

    // Combine required and optional accounts
    const allEntries = [...requiredAccounts, ...optionalAccounts];
    const entriesContent = mergeFragments(allEntries, cs => cs.map(c => `        ${c},`).join('\n'));

    return addFragmentImports(
        fragment`const keys: AccountMeta[] = [\n${entriesContent}\n    ];`,
        'web3',
        'AccountMeta',
    );
}

function getInstructionBuilderFragment(
    node: InstructionNode,
    hasAccounts: boolean,
    hasArgs: boolean,
    resolvedInputs: ResolvedInstructionInput[],
): Fragment {
    const name = pascalCase(node.name);
    const functionName = `create${name}Instruction`;
    const accountsType = `${name}InstructionAccounts`;
    const argsType = `${name}InstructionArgs`;
    const schemaName = `${name}InstructionDataSchema`;

    // Check if we have user-facing args (non-omitted)
    const userArgs = getUserArgs(node);
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

    const defaultFragments: Fragment[] = [];
    resolvedInputs.forEach(input => {
        if (input.defaultValue) {
            const defaultFragment = getInputDefaultFragment(input, node);
            if (defaultFragment.content) {
                defaultFragments.push(defaultFragment);
            }
        }
    });

    // Build the keys array
    const keysArrayFragment = getKeysArrayFragment(node, resolvedInputs);

    // Generate data serialization
    let dataFragment: Fragment;
    if (hasArgs) {
        // Get discriminator from omitted args
        const discriminatorArg = getDiscriminatorArg(node);

        if (hasUserArgs) {
            // Check if arguments require raw encoding (strings without sizePrefixTypeNode wrapper)
            // vs Borsh encoding (structs, size-prefixed strings, etc.)
            const requiresRawEncoding = userArgs.some(arg => {
                // Check if this is a raw string (not wrapped in sizePrefixTypeNode)
                let type = arg.type;
                if (type.kind === 'stringTypeNode') {
                    return true; // Raw string without wrapper
                }
                // Check for nested raw strings (e.g., inside structs)
                // For now, we only handle the simple case: single raw string argument
                return false;
            });

            // If single raw string argument, use raw UTF-8 encoding
            const isSingleRawString =
                requiresRawEncoding &&
                userArgs.length === 1 &&
                userArgs[0].type.kind === 'stringTypeNode' &&
                !discriminatorArg;

            if (isSingleRawString) {
                // For raw string encoding (like memo program), encode as UTF-8 bytes directly
                const stringArgName = camelCase(userArgs[0].name);
                const stringType = isNode(userArgs[0].type, 'stringTypeNode') ? userArgs[0].type : null;
                if (!stringType) throw new Error('Expected stringTypeNode');
                const encoding = stringType.encoding || 'utf8';
                dataFragment = fragment`const data = Buffer.from(args.${stringArgName}, '${encoding}');`;
            } else if (discriminatorArg && discriminatorArg.defaultValue?.kind === 'bytesValueNode') {
                const discriminatorHex = discriminatorArg.defaultValue.data;
                dataFragment = addFragmentImports(
                    fragment`const mapBigIntToBn = (value: unknown): unknown => {
        if (typeof value === 'bigint') return new BN(value.toString());
        if (Array.isArray(value)) return value.map(mapBigIntToBn);
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, mapBigIntToBn(nested)])
            );
        }
        return value;
    };
    const borshArgs = mapBigIntToBn(args);
    const buffer = Buffer.alloc(1000);
    ${schemaName}.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, ${schemaName}.getSpan(buffer));
    const discriminator = Buffer.from('${discriminatorHex}', 'hex');
    const data = Buffer.concat([discriminator, instructionData]);`,
                    'bn.js',
                    'BN',
                );
            } else if (
                discriminatorArg &&
                discriminatorArg.defaultValue?.kind === 'numberValueNode' &&
                discriminatorArg.type.kind === 'numberTypeNode'
            ) {
                const discriminatorValue = visit(discriminatorArg.defaultValue, getValueVisitor());
                const discriminatorFragment = getNumericDiscriminatorBufferFragment(
                    'discriminator',
                    discriminatorValue,
                    discriminatorArg.type,
                );
                dataFragment = addFragmentImports(
                    fragment`const mapBigIntToBn = (value: unknown): unknown => {
        if (typeof value === 'bigint') return new BN(value.toString());
        if (Array.isArray(value)) return value.map(mapBigIntToBn);
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, mapBigIntToBn(nested)])
            );
        }
        return value;
    };
    const borshArgs = mapBigIntToBn(args);
    const buffer = Buffer.alloc(1000);
    ${schemaName}.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, ${schemaName}.getSpan(buffer));
    ${discriminatorFragment}
    const data = Buffer.concat([discriminator, instructionData]);`,
                    'bn.js',
                    'BN',
                );
            } else {
                dataFragment = addFragmentImports(
                    fragment`const mapBigIntToBn = (value: unknown): unknown => {
        if (typeof value === 'bigint') return new BN(value.toString());
        if (Array.isArray(value)) return value.map(mapBigIntToBn);
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, mapBigIntToBn(nested)])
            );
        }
        return value;
    };
    const borshArgs = mapBigIntToBn(args);
    const buffer = Buffer.alloc(1000);
    ${schemaName}.encode(borshArgs as Record<string, unknown>, buffer);
    const data = buffer.subarray(0, ${schemaName}.getSpan(buffer));`,
                    'bn.js',
                    'BN',
                );
            }
        } else {
            // No user args, just discriminator
            if (discriminatorArg && discriminatorArg.defaultValue?.kind === 'bytesValueNode') {
                const discriminatorHex = discriminatorArg.defaultValue.data;
                dataFragment = fragment`const data = Buffer.from('${discriminatorHex}', 'hex');`;
            } else if (
                discriminatorArg &&
                discriminatorArg.defaultValue?.kind === 'numberValueNode' &&
                discriminatorArg.type.kind === 'numberTypeNode'
            ) {
                const discriminatorValue = visit(discriminatorArg.defaultValue, getValueVisitor());
                dataFragment = getNumericDiscriminatorBufferFragment('data', discriminatorValue, discriminatorArg.type);
            } else {
                dataFragment = fragment`const data = Buffer.alloc(0);`;
            }
        }
    } else {
        // No args at all
        dataFragment = fragment`const data = Buffer.alloc(0);`;
    }

    // Build return statement
    const returnFragment = addFragmentImports(
        fragment`return new TransactionInstruction({ keys, programId, data });`,
        'web3',
        'TransactionInstruction',
    );

    // Combine function body - defaults must come before keys array
    const bodyParts: Fragment[] = [];
    if (defaultFragments.length > 0) {
        bodyParts.push(mergeFragments(defaultFragments, cs => cs.join('\n    ')));
    }
    bodyParts.push(keysArrayFragment);
    bodyParts.push(dataFragment);
    bodyParts.push(fragment``);
    bodyParts.push(returnFragment);

    const functionBody = mergeFragments(bodyParts, cs => cs.join('\n    '));

    // Build the complete function by merging function signature with body
    const functionSignature = fragment`export function ${functionName}(${paramsStr}): TransactionInstruction {`;
    const functionClosing = fragment`}`;

    // Merge: signature + body + closing
    const result = mergeFragments([functionSignature, functionBody, functionClosing], cs => cs.join('\n    '));

    // Add all necessary imports
    let finalResult = addFragmentImports(result, 'web3', ['PublicKey', 'TransactionInstruction']);
    if (hasAccounts) {
        finalResult = addFragmentImports(finalResult, 'web3', 'AccountMeta');
    }

    // Merge imports from default fragments (PDA imports) manually
    // We need to merge imports but keep the function content
    if (defaultFragments.length > 0) {
        // Collect all imports from default fragments
        defaultFragments.forEach(f => {
            f.imports?.forEach((imports, module) => {
                const names = Array.from(imports);
                finalResult = addFragmentImports(finalResult, module, names);
            });
        });
    }

    return finalResult;
}

/**
 * Generates code for resolving default values for instruction inputs.
 * This handles PDA derivation, program ID defaults, etc.
 * Similar to getInstructionInputDefaultFragment in kit-based codebase.
 */
function getInputDefaultFragment(input: ResolvedInstructionInput, node: InstructionNode): Fragment {
    const { defaultValue } = input;

    if (!defaultValue) {
        return fragment``;
    }

    const inputName = camelCase(input.name);
    const defaultFragment = (renderedValue: string): Fragment => {
        if (input.kind === 'instructionAccountNode') {
            // For accounts, assign to the account variable
            return fragment`let ${inputName} = accounts.${inputName} || ${renderedValue};`;
        } else {
            // For arguments, assign to args
            return fragment`const ${inputName} = args.${inputName} ?? ${renderedValue};`;
        }
    };

    switch (defaultValue.kind) {
        case 'pdaValueNode': {
            // Linked PDA value - use the generated PDA function
            const pdaFunctionName = `find${pascalCase(defaultValue.pda.name)}Pda`;
            const pdaFileName = camelCase(defaultValue.pda.name);

            // Build seeds object from defaultValue.seeds
            const seedsEntries: Fragment[] = [];

            defaultValue.seeds.forEach(seedValue => {
                if (!seedValue || typeof seedValue !== 'object') return;
                if (!('name' in seedValue) || !('value' in seedValue)) return;
                const seedNameValue = seedValue.name;
                const seedNodeValue = seedValue.value;
                if (typeof seedNameValue !== 'string') return;
                if (!seedNodeValue || typeof seedNodeValue !== 'object') return;
                if (!('kind' in seedNodeValue)) return;
                const seedName = camelCase(seedNameValue);

                const seedKind = (seedNodeValue as { kind: string }).kind;
                if (seedKind === 'accountValueNode' && 'name' in seedNodeValue) {
                    const accountRef = camelCase(String(seedNodeValue.name));
                    seedsEntries.push(fragment`${seedName}: accounts.${accountRef}`);
                } else if (seedKind === 'argumentValueNode' && 'name' in seedNodeValue) {
                    const argRef = camelCase(String(seedNodeValue.name));
                    seedsEntries.push(fragment`${seedName}: args.${argRef}`);
                } else if (seedKind === 'identityValueNode') {
                    // Find first signer account
                    const signerAccount = node.accounts.find(acc => acc.isSigner === true || acc.isSigner === 'either');
                    if (signerAccount) {
                        const signerName = camelCase(signerAccount.name);
                        seedsEntries.push(fragment`${seedName}: accounts.${signerName}`);
                    } else {
                        seedsEntries.push(fragment`${seedName}: accounts.authority`);
                    }
                }
                // Handle other seed value types as needed
            });

            const seedsContent = mergeFragments(seedsEntries, cs => cs.map(c => `            ${c},`).join('\n'));

            const hasSeeds = seedsEntries.length > 0;
            const pdaCall = hasSeeds
                ? fragment`${pdaFunctionName}({\n${seedsContent}\n        }, programId)`
                : fragment`${pdaFunctionName}(programId)`;

            // Generate complete pattern with variable declaration and derivation
            const result = addFragmentImports(
                fragment`let ${inputName} = accounts.${inputName};
    if (!${inputName}) {
        const [derived] = ${pdaCall};
        ${inputName} = derived;
    }`,
                '../pdas/' + pdaFileName,
                pdaFunctionName,
            );

            return result;
        }

        case 'programIdValueNode':
            if (input.kind === 'instructionAccountNode' && input.isOptional) {
                return defaultFragment('programId');
            }
            return fragment``;

        case 'accountValueNode':
            const accountRef = camelCase(defaultValue.name);
            return defaultFragment(`accounts.${accountRef}`);

        case 'argumentValueNode':
            const argRef = camelCase(defaultValue.name);
            return defaultFragment(`args.${argRef}`);

        // Add other cases as needed
        default:
            return fragment``;
    }
}
