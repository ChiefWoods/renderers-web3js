import {
    camelCase,
    CamelCaseString,
    getAllInstructionArguments,
    InstructionNode,
    isNode,
    NumberTypeNode,
    pascalCase,
    PdaNode,
    structTypeNodeFromInstructionArgumentNodes,
} from '@codama/nodes';
import { ResolvedInstructionInput, visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    DEFAULT_NAME_TRANSFORMERS,
    DiscriminatorInfo,
    Fragment,
    fragment,
    getCodeFileFragment,
    getDiscriminatorConstantContent,
    getDiscriminatorInfos,
    getNameApi,
    GetImportFromFunction,
    mergeFragments,
    NameApi,
    ParsedCustomDataOptions,
    PathOverrides,
    use,
} from '../utils';
import { TypeManifestVisitor } from '../visitors/getTypeManifestVisitor';
import { getValueVisitor } from '../visitors/getValueVisitor';

type CustomInstructionData = NonNullable<ReturnType<ParsedCustomDataOptions['get']>>;

const defaultNameApi = getNameApi(DEFAULT_NAME_TRANSFORMERS);

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
            return fragment`const ${bufferName} = Buffer.alloc(16);
    {
        let value = BigInt(${discriminatorValue});
        for (let i = 0; i < 16; i++) {
            const offset = '${endianLower}' === 'be' ? 15 - i : i;
            ${bufferName}[offset] = Number((value >> BigInt(8 * i)) & 0xffn);
        }
    }`;
        case 'i128':
            return fragment`const ${bufferName} = Buffer.alloc(16);
    {
        let value = BigInt(${discriminatorValue});
        if (value < 0) value = (1n << 128n) + value;
        for (let i = 0; i < 16; i++) {
            const offset = '${endianLower}' === 'be' ? 15 - i : i;
            ${bufferName}[offset] = Number((value >> BigInt(8 * i)) & 0xffn);
        }
    }`;
        default:
            return fragment`const ${bufferName} = Buffer.alloc(4);
    ${bufferName}.writeUInt32LE(Number(${discriminatorValue}), 0);`;
    }
}

export function getInstructionFunctionFragment(
    node: InstructionNode,
    typeManifestVisitor: TypeManifestVisitor,
    resolvedInputs: ResolvedInstructionInput[] = [],
    programIdConstant?: string,
    customInstructionData: ParsedCustomDataOptions = new Map(),
    dependencyMap: PathOverrides = {},
    nameApi?: NameApi,
    asyncResolvers: CamelCaseString[] = [],
    getImportFrom?: GetImportFromFunction,
    pdaNodes: ReadonlyMap<string, PdaNode> = new Map(),
    programName?: string,
): Fragment {
    const names = nameApi ?? defaultNameApi;
    const hasAccounts = node.accounts.length > 0;
    const hasArgs = node.arguments.length > 0;
    const customData = customInstructionData.get(node.name);
    const discriminators = getDiscriminatorInfos(node.name, 'instruction', node.discriminators ?? [], node.arguments);

    const fragments: Fragment[] = [];

    if (discriminators.length > 0) {
        fragments.push(fragment`${discriminators.map(getDiscriminatorConstantContent).join('\n\n')}`);
    }

    // 1. Generate Accounts interface (if there are accounts)
    if (hasAccounts) {
        fragments.push(getAccountsInterfaceFragment(node, resolvedInputs, names));
    }

    // 2. Generate Args interface (if there are arguments or remaining accounts)
    const hasRemainingAccountArgs = !!getRemainingAccountsArgsFragment(node)?.length;
    if (customData) {
        fragments.push(getCustomArgsInterfaceFragment(node, customData, names));
    } else if (hasArgs || hasRemainingAccountArgs) {
        fragments.push(getArgsInterfaceFragment(node, typeManifestVisitor, names));
    }

    // 3. Generate instruction data encoder (if there are arguments and not custom)
    if (hasArgs && !customData) {
        fragments.push(getInstructionEncoderFragment(node, typeManifestVisitor, names));
    }

    // 4. Generate instruction parsing helpers for program-level dispatchers.
    fragments.push(getInstructionParserFragment(node, typeManifestVisitor, customData, names, discriminators));

    // 5. Generate the instruction builder function
    fragments.push(
        getInstructionBuilderFragment(
            node,
            hasAccounts,
            hasArgs,
            resolvedInputs,
            programIdConstant,
            customData,
            names,
            asyncResolvers,
            getImportFrom,
            pdaNodes,
            discriminators,
            programName,
        ),
    );

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments, dependencyMap);
}

function getUserArgs(node: InstructionNode) {
    return node.arguments.filter(arg => arg.defaultValueStrategy !== 'omitted');
}

function getAccountsInterfaceFragment(
    node: InstructionNode,
    resolvedInputs: ResolvedInstructionInput[],
    nameApi: NameApi,
): Fragment {
    const interfaceName = nameApi.instructionAccountsType(node.name);

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
            resolvedInput?.defaultValue?.kind === 'accountValueNode' ||
            resolvedInput?.defaultValue?.kind === 'resolverValueNode';
        const optional = account.isOptional || hasDerivableDefault ? '?' : '';
        const isSigner = account.isSigner === 'either' ? 'Address | Keypair' : 'Address';

        return addFragmentImports(fragment`${fieldName}${optional}: ${isSigner}`, 'web3', ['Address', 'Keypair']);
    });

    const fieldsContent = mergeFragments(fields, cs => cs.map(c => `    ${c};`).join('\n'));

    return addFragmentImports(fragment`export interface ${interfaceName} {\n${fieldsContent}\n}`, 'web3', 'Address');
}

function getArgsInterfaceFragment(
    node: InstructionNode,
    typeManifestVisitor: TypeManifestVisitor,
    nameApi: NameApi,
): Fragment {
    const interfaceName = nameApi.instructionArgsType(node.name);

    // Filter out arguments with defaultValueStrategy: 'omitted' (like discriminators)
    const userArgs = node.arguments.filter(arg => arg.defaultValueStrategy !== 'omitted');

    const remainingArgsFields = getRemainingAccountsArgsFragment(node);
    if (userArgs.length === 0 && !remainingArgsFields?.length) {
        return fragment``;
    }

    const fields = userArgs.map(arg => {
        const fieldName = camelCase(arg.name);
        const fieldType = visit(arg.type, typeManifestVisitor).looseType;
        return fragment`${fieldName}: ${fieldType}`;
    });

    const allFields = remainingArgsFields ? [...fields, ...remainingArgsFields] : fields;
    const fieldsContent = mergeFragments(allFields, cs => cs.map(c => `    ${c};`).join('\n'));

    return fragment`export interface ${interfaceName} {\n${fieldsContent}\n}`;
}

function getCustomArgsInterfaceFragment(
    node: InstructionNode,
    customData: CustomInstructionData,
    nameApi: NameApi,
): Fragment {
    const interfaceName = nameApi.instructionArgsType(node.name);
    const dataTypeName = pascalCase(customData.importAs);
    const codecName = `${dataTypeName}Codec`;
    const remainingArgsFields = getRemainingAccountsArgsFragment(node);

    const importFragment = addFragmentImports(
        fragment`export type { ${dataTypeName} };
export { ${codecName} };`,
        customData.importFrom,
        [dataTypeName, codecName],
    );

    if (!remainingArgsFields?.length) {
        return mergeFragments([importFragment, fragment`export type ${interfaceName} = ${dataTypeName};`], cs =>
            cs.join('\n\n'),
        );
    }

    const remainingFieldsContent = mergeFragments(remainingArgsFields, cs => cs.map(c => `    ${c};`).join('\n'));
    return mergeFragments(
        [importFragment, fragment`export type ${interfaceName} = ${dataTypeName} & {\n${remainingFieldsContent}\n};`],
        cs => cs.join('\n\n'),
    );
}

function getRemainingAccountsArgsFragment(node: InstructionNode): Fragment[] | undefined {
    const allArguments = getAllInstructionArguments(node);
    const fragments = (node.remainingAccounts ?? []).flatMap(remainingAccount => {
        if (!isNode(remainingAccount.value, 'argumentValueNode')) return [];
        const argumentExists = allArguments.some(arg => arg.name === remainingAccount.value.name);
        if (argumentExists) return [];

        const fieldName = camelCase(remainingAccount.value.name);
        const optional = remainingAccount.isOptional ? '?' : '';
        const accountType =
            remainingAccount.isSigner === 'either'
                ? 'Address | Keypair'
                : remainingAccount.isSigner
                  ? 'Keypair'
                  : 'Address';
        return [
            addFragmentImports(fragment`${fieldName}${optional}: Array<${accountType}>`, 'web3', [
                'Address',
                'Keypair',
            ]),
        ];
    });

    if (fragments.length === 0) return;
    return fragments;
}

function getInstructionEncoderFragment(
    node: InstructionNode,
    typeManifestVisitor: TypeManifestVisitor,
    nameApi: NameApi,
): Fragment {
    if (node.arguments.length === 0) {
        return fragment``;
    }

    const userArgs = getUserArgs(node);
    if (userArgs.length === 0 || usesRawStringEncoding(node)) {
        return fragment``;
    }

    const argsType = nameApi.instructionArgsType(node.name);
    const encoderFunction = nameApi.encoderFunction(nameApi.instructionDataType(node.name));
    const argsStruct = structTypeNodeFromInstructionArgumentNodes(userArgs);
    const manifest = visit(argsStruct, typeManifestVisitor);
    const encoderType = use('type Encoder', 'codecs');

    return fragment`function ${encoderFunction}(): ${encoderType}<${argsType}> {
    return ${manifest.encoder};
}`;
}

function getInstructionParserFragment(
    node: InstructionNode,
    typeManifestVisitor: TypeManifestVisitor,
    customData: CustomInstructionData | undefined,
    nameApi: NameApi,
    discriminators: DiscriminatorInfo[],
): Fragment {
    const name = pascalCase(node.name);
    const parsedType = `Parsed${name}Instruction`;
    const argsType = nameApi.instructionArgsType(node.name);
    const userArgs = getUserArgs(node);
    const discriminatorLength = discriminators.reduce((sum, discriminator) => sum + discriminator.bytes.length, 0);
    const discriminatorValidation = discriminators
        .map(
            discriminator => `if (!${discriminator.constantName}.every((byte, index) => instruction.data[${discriminator.offset} + index] === byte)) {
        throw new Error('${name} instruction discriminator mismatch');
    }`,
        )
        .join('\n    ');
    const accounts = node.accounts.map(
        (account, index) => `        ${camelCase(account.name)}: instruction.keys[${index}]!,`,
    );
    const accountTypeFields = node.accounts.map(account => `        ${camelCase(account.name)}: AccountMeta;`);
    const dataType = customData || userArgs.length > 0 ? argsType : '{}';

    let decoder: Fragment;
    let decodeExpression: string;
    if (customData) {
        const codecName = `${pascalCase(customData.importAs)}Codec`;
        decoder = fragment``;
        decodeExpression = `${codecName}.decode(instructionData)`;
    } else if (userArgs.length === 0) {
        decoder = fragment``;
        decodeExpression = '{}';
    } else if (usesRawStringEncoding(node)) {
        const stringArg = userArgs[0];
        const encoding = isNode(stringArg.type, 'stringTypeNode') ? stringArg.type.encoding : 'utf8';
        decoder = fragment``;
        decodeExpression = `{ ${camelCase(stringArg.name)}: Buffer.from(instructionData).toString('${encoding}') }`;
    } else {
        const decoderFunction = `get${nameApi.instructionDataType(node.name)}Decoder`;
        const manifest = visit(structTypeNodeFromInstructionArgumentNodes(userArgs), typeManifestVisitor);
        decoder = fragment`function ${decoderFunction}(): ${use('type Decoder', 'codecs')}<${argsType}> {
    return ${manifest.decoder};
}`;
        decodeExpression = `${decoderFunction}().decode(instructionData)`;
    }

    const minimumAccountsCheck = node.accounts.length
        ? `if (instruction.keys.length < ${node.accounts.length}) {
        throw new Error('Expected ${node.accounts.length} account metas for ${name} instruction');
    }
    `
        : '';
    const accountsType = node.accounts.length ? `{\n${accountTypeFields.join('\n')}\n    }` : '{}';
    const accountsValue = node.accounts.length ? `{\n${accounts.join('\n')}\n    }` : '{}';

    return addFragmentImports(
        fragment`${decoder}

export interface ${parsedType} {
    programId: Address;
    accounts: ${accountsType};
    data: ${dataType};
}

export function parse${name}Instruction(instruction: TransactionInstruction): ${parsedType} {
    ${minimumAccountsCheck}${discriminatorValidation ? `${discriminatorValidation}\n    ` : ''}const instructionData = instruction.data.subarray(${discriminatorLength});
    return {
        programId: instruction.programId,
        accounts: ${accountsValue},
        data: ${decodeExpression},
    };
}`,
        'web3',
        ['AccountMeta', 'Address', 'TransactionInstruction'],
    );
}

function getKeysArrayFragment(node: InstructionNode, resolvedInputs: ResolvedInstructionInput[]): Fragment {
    if (node.accounts.length === 0) {
        return addFragmentImports(fragment`const keys: AccountMeta[] = [];`, 'web3', 'AccountMeta');
    }

    const entries: Fragment[] = [];
    const optionalAccountStrategy = node.optionalAccountStrategy ?? 'programId';

    node.accounts.forEach(account => {
        const accountName = camelCase(account.name);
        const isWritable = account.isWritable ?? false;

        // Check if this account has a derived default value
        const resolvedInput = resolvedInputs.find(
            input => input.kind === 'instructionAccountNode' && input.name === account.name,
        );
        const hasPdaDefault = resolvedInput?.defaultValue?.kind === 'pdaValueNode';
        const hasDerivedDefault = hasPdaDefault || resolvedInput?.defaultValue?.kind === 'programIdValueNode';

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

        if (hasPdaDefault) {
            entries.push(entry);
        } else if (account.isOptional && optionalAccountStrategy === 'omitted') {
            entries.push(fragment`...(accounts.${accountName} ? [${entry}] : [])`);
        } else if (account.isOptional) {
            entries.push(
                fragment`accounts.${accountName} ? ${entry} : { pubkey: programId, isSigner: false, isWritable: false }`,
            );
        } else {
            entries.push(entry);
        }
    });

    const entriesContent = mergeFragments(entries, cs => cs.map(c => `        ${c},`).join('\n'));

    return addFragmentImports(
        fragment`const keys: AccountMeta[] = [\n${entriesContent}\n    ];`,
        'web3',
        'AccountMeta',
    );
}

function getRemainingKeysArrayFragment(node: InstructionNode): Fragment {
    const argumentNames = new Set(getAllInstructionArguments(node).map(arg => arg.name));
    const fragments = (node.remainingAccounts ?? []).flatMap(remainingAccount => {
        if (!isNode(remainingAccount.value, 'argumentValueNode')) return [];

        const argumentName = camelCase(remainingAccount.value.name);
        const optionalArg = remainingAccount.isOptional ? ' ?? []' : '';
        const isWritable = remainingAccount.isWritable ?? false;
        const argumentExists = argumentNames.has(remainingAccount.value.name);

        if (argumentExists) return [];

        if (remainingAccount.isSigner === 'either') {
            return [
                fragment`keys.push(...(args.${argumentName}${optionalArg}).map((accountOrSigner) => ({
        pubkey: 'publicKey' in accountOrSigner ? accountOrSigner.publicKey : accountOrSigner,
        isSigner: 'publicKey' in accountOrSigner,
        isWritable: ${isWritable},
    })));`,
            ];
        }

        if (remainingAccount.isSigner) {
            return [
                fragment`keys.push(...(args.${argumentName}${optionalArg}).map((signer) => ({
        pubkey: signer.publicKey,
        isSigner: true,
        isWritable: ${isWritable},
    })));`,
            ];
        }

        return [
            fragment`keys.push(...(args.${argumentName}${optionalArg}).map((account) => ({
        pubkey: account,
        isSigner: ${remainingAccount.isSigner ? 'true' : 'false'},
        isWritable: ${isWritable},
    })));`,
        ];
    });

    if (fragments.length === 0) return fragment``;
    return mergeFragments(fragments, cs => cs.join('\n    '));
}

function getInstructionBuilderFragment(
    node: InstructionNode,
    hasAccounts: boolean,
    hasArgs: boolean,
    resolvedInputs: ResolvedInstructionInput[],
    programIdConstant?: string,
    customData?: CustomInstructionData,
    nameApi: NameApi = defaultNameApi,
    asyncResolvers: CamelCaseString[] = [],
    getImportFrom?: GetImportFromFunction,
    pdaNodes: ReadonlyMap<string, PdaNode> = new Map(),
    discriminators: DiscriminatorInfo[] = [],
    programName?: string,
): Fragment {
    const functionName = nameApi.instructionCreateFunction(node.name);
    const accountsType = nameApi.instructionAccountsType(node.name);
    const argsType = nameApi.instructionArgsType(node.name);
    const customCodecName = customData ? `${pascalCase(customData.importAs)}Codec` : undefined;
    const encoderFunction = nameApi.encoderFunction(nameApi.instructionDataType(node.name));
    const encodeCall = customCodecName ? `${customCodecName}.encode(args)` : `${encoderFunction}().encode(args)`;

    // Check if we have user-facing args (non-omitted)
    const userArgs = getUserArgs(node);
    const hasUserArgs = customData ? true : userArgs.length > 0;
    const hasRemainingAccountArgs = (node.remainingAccounts ?? []).some(
        remainingAccount =>
            isNode(remainingAccount.value, 'argumentValueNode') &&
            !getAllInstructionArguments(node).some(arg => arg.name === remainingAccount.value.name),
    );
    const hasInputArgs = hasUserArgs || hasRemainingAccountArgs;

    // Build function parameters
    const params: string[] = [];
    if (hasAccounts) {
        params.push(`accounts: ${accountsType}`);
    }
    if (hasInputArgs) {
        params.push(`args: ${argsType}`);
    }
    if (programIdConstant) {
        params.push(`programId: Address = ${programIdConstant}`);
    } else {
        params.push(`programId: Address`);
    }

    const paramsStr = params.join(', ');

    const hasAsyncDefaults = resolvedInputs.some(input => {
        if (!input.defaultValue) return false;
        if (input.defaultValue.kind === 'pdaValueNode') return true;
        if (input.defaultValue.kind === 'resolverValueNode') {
            return asyncResolvers.includes(input.defaultValue.name);
        }
        return false;
    });

    const defaultFragments: Fragment[] = [];
    resolvedInputs.forEach(input => {
        if (input.defaultValue) {
            const defaultFragment = getInputDefaultFragment(input, node, asyncResolvers, getImportFrom, pdaNodes);
            if (defaultFragment.content) {
                defaultFragments.push(defaultFragment);
            }
        }
    });

    // Build the keys array
    const keysArrayFragment = getKeysArrayFragment(node, resolvedInputs);
    const remainingKeysArrayFragment = getRemainingKeysArrayFragment(node);

    // Generate data serialization
    let dataFragment: Fragment;
    if (discriminators.length > 0) {
        const encodedData = customData || hasUserArgs ? `Buffer.from(${encodeCall})` : 'Buffer.alloc(0)';
        const insertions = [...discriminators]
            .sort((a, b) => a.offset - b.offset)
            .map(
                discriminator => `data = Buffer.concat([
        data.subarray(0, ${discriminator.offset}),
        Buffer.alloc(Math.max(0, ${discriminator.offset} - data.length)),
        Buffer.from(${discriminator.constantName}),
        data.subarray(${discriminator.offset}),
    ]);`,
            )
            .join('\n    ');
        dataFragment = fragment`let data = ${encodedData};
    ${insertions}`;
    } else if (customData) {
        const discriminatorArg = getDiscriminatorArg(node);
        if (discriminatorArg && discriminatorArg.defaultValue?.kind === 'bytesValueNode') {
            const discriminatorHex = discriminatorArg.defaultValue.data;
            dataFragment = fragment`const instructionData = Buffer.from(${encodeCall});
    const discriminator = Buffer.from('${discriminatorHex}', 'hex');
    const data = Buffer.concat([discriminator, instructionData]);`;
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
            dataFragment = fragment`const instructionData = Buffer.from(${encodeCall});
    ${discriminatorFragment}
    const data = Buffer.concat([discriminator, instructionData]);`;
        } else {
            dataFragment = fragment`const data = Buffer.from(${encodeCall});`;
        }
    } else if (hasArgs) {
        // Get discriminator from omitted args
        const discriminatorArg = getDiscriminatorArg(node);

        if (hasUserArgs) {
            // Check if arguments require raw encoding (strings without sizePrefixTypeNode wrapper)
            // vs Borsh encoding (structs, size-prefixed strings, etc.)
            const requiresRawEncoding = userArgs.some(arg => {
                // Check if this is a raw string (not wrapped in sizePrefixTypeNode)
                const type = arg.type;
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
                dataFragment = fragment`const instructionData = Buffer.from(${encodeCall});
    const discriminator = Buffer.from('${discriminatorHex}', 'hex');
    const data = Buffer.concat([discriminator, instructionData]);`;
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
                dataFragment = fragment`const instructionData = Buffer.from(${encodeCall});
    ${discriminatorFragment}
    const data = Buffer.concat([discriminator, instructionData]);`;
            } else {
                dataFragment = fragment`const data = Buffer.from(${encodeCall});`;
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
    if (remainingKeysArrayFragment.content) {
        bodyParts.push(remainingKeysArrayFragment);
    }
    bodyParts.push(dataFragment);
    bodyParts.push(fragment``);
    bodyParts.push(returnFragment);

    const functionBody = mergeFragments(bodyParts, cs => cs.join('\n    '));

    // Build the complete function by merging function signature with body
    const functionSignature = hasAsyncDefaults
        ? fragment`export async function ${functionName}(${paramsStr}): Promise<TransactionInstruction> {`
        : fragment`export function ${functionName}(${paramsStr}): TransactionInstruction {`;
    const functionClosing = fragment`}`;

    // Merge: signature + body + closing
    const result = mergeFragments([functionSignature, functionBody, functionClosing], cs => cs.join('\n    '));

    // Add all necessary imports
    let finalResult = addFragmentImports(result, 'web3', ['Address', 'TransactionInstruction']);
    if (programIdConstant) {
        finalResult = addFragmentImports(
            finalResult,
            getProgramIdImportPath(programIdConstant, programName),
            programIdConstant,
        );
    }
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

function getProgramIdImportPath(programIdConstant: string, programName?: string): string {
    return `../programs/${camelCase(programName ?? programIdConstant.replace(/_PROGRAM_ID$/, '').toLowerCase())}`;
}

/**
 * Generates code for resolving default values for instruction inputs.
 * This handles PDA derivation, program ID defaults, etc.
 * Similar to getInstructionInputDefaultFragment in kit-based codebase.
 */
function getInputDefaultFragment(
    input: ResolvedInstructionInput,
    node: InstructionNode,
    asyncResolvers: CamelCaseString[] = [],
    getImportFrom?: GetImportFromFunction,
    pdaNodes: ReadonlyMap<string, PdaNode> = new Map(),
): Fragment {
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

            // Build seeds object from defaultValue.seeds.
            // Keys must match the shared PDA helper's seed interface. When the same
            // PDA is inlined across instructions with different seed *names*, map
            // values by position onto the canonical PDA's variable seed names.
            const seedsEntries: Fragment[] = [];
            const canonicalPda = pdaNodes.get(String(defaultValue.pda.name));
            const inlineProgramId = defaultValue.pda.kind === 'pdaNode' ? defaultValue.pda.programId : undefined;
            const hasExplicitProgramId = !!(canonicalPda?.programId ?? inlineProgramId);
            const canonicalVariableSeeds =
                canonicalPda?.seeds.filter(seed => seed.kind === 'variablePdaSeedNode') ?? [];

            const pushSeedEntry = (seedName: string, seedNodeValue: { kind: string; name?: string }) => {
                const seedKind = seedNodeValue.kind;
                if (seedKind === 'accountValueNode' && seedNodeValue.name) {
                    const accountRef = camelCase(String(seedNodeValue.name));
                    seedsEntries.push(fragment`${seedName}: accounts.${accountRef}`);
                } else if (seedKind === 'argumentValueNode' && seedNodeValue.name) {
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
            };

            if (canonicalVariableSeeds.length > 0) {
                canonicalVariableSeeds.forEach((seed, index) => {
                    const seedValue = defaultValue.seeds[index];
                    if (!seedValue || typeof seedValue !== 'object') return;
                    if (!('value' in seedValue)) return;
                    const seedNodeValue = seedValue.value;
                    if (!seedNodeValue || typeof seedNodeValue !== 'object') return;
                    if (!('kind' in seedNodeValue)) return;
                    pushSeedEntry(camelCase(seed.name), seedNodeValue as { kind: string; name?: string });
                });
            } else {
                defaultValue.seeds.forEach(seedValue => {
                    if (!seedValue || typeof seedValue !== 'object') return;
                    if (!('name' in seedValue) || !('value' in seedValue)) return;
                    const seedNameValue = seedValue.name;
                    const seedNodeValue = seedValue.value;
                    if (typeof seedNameValue !== 'string') return;
                    if (!seedNodeValue || typeof seedNodeValue !== 'object') return;
                    if (!('kind' in seedNodeValue)) return;
                    pushSeedEntry(camelCase(seedNameValue), seedNodeValue as { kind: string; name?: string });
                });
            }

            const seedsContent = mergeFragments(seedsEntries, cs => cs.map(c => `            ${c},`).join('\n'));

            const hasSeeds = seedsEntries.length > 0;
            const programIdArgument = hasExplicitProgramId ? '' : ', programId';
            const pdaCall = hasSeeds
                ? fragment`${pdaFunctionName}({\n${seedsContent}\n        }${programIdArgument})`
                : fragment`${pdaFunctionName}(${hasExplicitProgramId ? '' : 'programId'})`;

            // Generate complete pattern with variable declaration and derivation
            const result = addFragmentImports(
                fragment`let ${inputName} = accounts.${inputName};
    if (!${inputName}) {
        const [derived] = await ${pdaCall};
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

        case 'accountValueNode': {
            const accountRef = camelCase(defaultValue.name);
            return defaultFragment(`accounts.${accountRef}`);
        }

        case 'argumentValueNode': {
            const argRef = camelCase(defaultValue.name);
            return defaultFragment(`args.${argRef}`);
        }

        case 'resolverValueNode': {
            const resolverName = camelCase(defaultValue.name);
            const importFrom = getImportFrom?.(defaultValue) ?? 'hooked';
            const isAsync = asyncResolvers.includes(defaultValue.name);
            const call = isAsync ? `await ${resolverName}()` : `${resolverName}()`;

            if (input.kind === 'instructionAccountNode') {
                return addFragmentImports(
                    fragment`let ${inputName} = accounts.${inputName};
    if (!${inputName}) {
        ${inputName} = ${call};
    }`,
                    importFrom,
                    resolverName,
                );
            }

            return addFragmentImports(
                fragment`const ${inputName} = args.${inputName} ?? ${call};`,
                importFrom,
                resolverName,
            );
        }

        default:
            return fragment``;
    }
}
