import { camelCase, pascalCase, PdaNode, type TypeNode } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import {
    addFragmentImports,
    encodeStringValue,
    Fragment,
    fragment,
    getCodeFileFragment,
    mergeFragments,
} from '../utils';
import { TypeVisitor } from '../visitors';

export function getPdaFunctionFragment(node: PdaNode, typeVisitor: TypeVisitor, programIdConstant?: string): Fragment {
    const fragments: Fragment[] = [];

    // Check if there are variable seeds (need an interface)
    const variableSeeds = node.seeds.filter(s => s.kind === 'variablePdaSeedNode');
    const hasVariableSeeds = variableSeeds.length > 0;

    // 1. Generate Seeds interface (if there are variable seeds)
    if (hasVariableSeeds) {
        fragments.push(getSeedsInterfaceFragment(node, typeVisitor));
    }

    // 2. Generate PDA derivation function
    fragments.push(getPdaDerivationFunctionFragment(node, hasVariableSeeds, programIdConstant));

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

function getSeedsInterfaceFragment(node: PdaNode, typeVisitor: TypeVisitor): Fragment {
    const name = pascalCase(node.name);
    const interfaceName = `${name}PdaSeeds`;

    const variableSeeds = node.seeds.filter(s => s.kind === 'variablePdaSeedNode');

    const fields = variableSeeds.map(seed => {
        const fieldName = camelCase(seed.name);
        const fieldType = visit(seed.type, typeVisitor);
        return fragment`${fieldName}: ${fieldType}`;
    });

    const fieldsContent = mergeFragments(fields, cs => cs.map(c => `    ${c};`).join('\n'));

    return fragment`export interface ${interfaceName} {\n${fieldsContent}\n}`;
}

function getPdaDerivationFunctionFragment(
    node: PdaNode,
    hasVariableSeeds: boolean,
    programIdConstant?: string,
): Fragment {
    const name = pascalCase(node.name);
    const functionName = `find${name}Pda`;
    const seedsType = `${name}PdaSeeds`;

    // Build function parameters
    const params: string[] = [];
    if (hasVariableSeeds) {
        params.push(`seeds: ${seedsType}`);
    }
    if (programIdConstant) {
        params.push(`programId: Address = ${programIdConstant}`);
    } else {
        params.push('programId: Address');
    }

    const paramsStr = params.join(', ');

    // Build seeds array
    const seedsArrayFragment = getSeedsArrayFragment(node);

    // Build function body
    const functionBody = fragment`${seedsArrayFragment}
    return await Address.findProgramAddress(seedsBuffer, programId);`;

    let functionFragment = addFragmentImports(
        fragment`export async function ${functionName}(${paramsStr}): Promise<[Address, number]> {\n    ${functionBody}\n}`,
        'web3',
        'Address',
    );

    if (programIdConstant) {
        functionFragment = addFragmentImports(functionFragment, '..', programIdConstant);
    }

    return functionFragment;
}

function getSeedsArrayFragment(node: PdaNode): Fragment {
    if (node.seeds.length === 0) {
        return fragment`const seedsBuffer: Uint8Array[] = [];`;
    }

    const seedEntries = node.seeds.map(seed => {
        if (seed.kind === 'constantPdaSeedNode') {
            // Constant seed - encode the value directly based on its type
            if (seed.type.kind === 'bytesTypeNode' && seed.value.kind === 'bytesValueNode') {
                const bytes = [...encodeStringValue(seed.value.encoding, seed.value.data)];
                const ascii = Buffer.from(bytes).toString('utf8');
                const isPrintableAscii = ascii.length > 0 && /^[\x20-\x7E]+$/.test(ascii);
                const roundTrips = isPrintableAscii && Buffer.from(ascii, 'utf8').equals(Buffer.from(bytes));
                if (roundTrips) {
                    return fragment`Buffer.from(${JSON.stringify(ascii)}, 'utf8')`;
                }
                return fragment`Buffer.from([${bytes.join(', ')}])`;
            } else if (seed.type.kind === 'stringTypeNode' && seed.value.kind === 'stringValueNode') {
                // For string seeds, encode as UTF-8
                return fragment`Buffer.from('${seed.value.string}', 'utf8')`;
            } else if (seed.type.kind === 'publicKeyTypeNode' && seed.value.kind === 'publicKeyValueNode') {
                // For publicKey seeds, decode from base58
                const base58 = seed.value.publicKey;
                return addFragmentImports(fragment`new Address('${base58}').toBytes()`, 'web3', 'Address');
            }
            // Fallback for other value types
            return fragment`Buffer.from([])`;
        } else if (seed.kind === 'variablePdaSeedNode') {
            // Variable seed - need to encode based on type
            const seedName = camelCase(seed.name);
            return getSeedEncodingFragment(seedName, seed.type);
        }
        return fragment`Buffer.from([])`;
    });

    const entriesContent = mergeFragments(seedEntries, cs => cs.map(c => `        ${c},`).join('\n'));

    return fragment`const seedsBuffer: Uint8Array[] = [\n${entriesContent}\n    ];`;
}

function getSeedEncodingFragment(seedName: string, seedType: TypeNode): Fragment {
    // Handle different seed types and their encoding
    if (seedType.kind === 'publicKeyTypeNode') {
        return fragment`seeds.${seedName}.toBytes()`;
    } else if (seedType.kind === 'stringTypeNode') {
        return fragment`Buffer.from(seeds.${seedName}, 'utf8')`;
    } else if (seedType.kind === 'sizePrefixTypeNode' && seedType.type.kind === 'stringTypeNode') {
        // Anchor-style size-prefixed UTF-8 string seed.
        return addFragmentImports(
            fragment`Buffer.from(addEncoderSizePrefix(getUtf8Encoder(), getU32Encoder()).encode(seeds.${seedName}))`,
            'codecs',
            ['addEncoderSizePrefix', 'getUtf8Encoder', 'getU32Encoder'],
        );
    } else if (seedType.kind === 'numberTypeNode') {
        // Numbers need to be encoded as buffers
        const format = seedType.format;
        if (format === 'u8' || format === 'i8') {
            return fragment`Buffer.from([seeds.${seedName}])`;
        } else if (format === 'u16' || format === 'i16') {
            return fragment`Buffer.from(new Uint8Array(new ${format === 'i16' ? 'Int' : 'Uint'}16Array([seeds.${seedName}]).buffer))`;
        } else if (format === 'u32' || format === 'i32') {
            return fragment`Buffer.from(new Uint8Array(new ${format === 'i32' ? 'Int' : 'Uint'}32Array([seeds.${seedName}]).buffer))`;
        } else if (format === 'u64' || format === 'i64') {
            return fragment`Buffer.from(new Uint8Array(new ${format === 'i64' ? 'BigInt64' : 'BigUint64'}Array([BigInt(seeds.${seedName})]).buffer))`;
        }
        return fragment`Buffer.from([seeds.${seedName}])`;
    } else if (seedType.kind === 'bytesTypeNode') {
        return fragment`seeds.${seedName}`;
    }

    // Default: try to use it as a buffer
    return fragment`seeds.${seedName}`;
}
