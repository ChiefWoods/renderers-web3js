import { camelCase, PdaNode, pascalCase } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { addFragmentImports, Fragment, fragment, getCodeFileFragment, mergeFragments } from '../utils';
import { TypeVisitor } from '../visitors';

export function getPdaFunctionFragment(node: PdaNode, typeVisitor: TypeVisitor): Fragment {
    const fragments: Fragment[] = [];

    // Check if there are variable seeds (need an interface)
    const variableSeeds = node.seeds.filter(s => s.kind === 'variablePdaSeedNode');
    const hasVariableSeeds = variableSeeds.length > 0;

    // 1. Generate Seeds interface (if there are variable seeds)
    if (hasVariableSeeds) {
        fragments.push(getSeedsInterfaceFragment(node, typeVisitor));
    }

    // 2. Generate PDA derivation function
    fragments.push(getPdaDerivationFunctionFragment(node, hasVariableSeeds));

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

function getPdaDerivationFunctionFragment(node: PdaNode, hasVariableSeeds: boolean): Fragment {
    const name = pascalCase(node.name);
    const functionName = `find${name}Pda`;
    const seedsType = `${name}PdaSeeds`;

    // Build function parameters
    const params: string[] = [];
    if (hasVariableSeeds) {
        params.push(`seeds: ${seedsType}`);
    }
    params.push('programId: PublicKey');

    const paramsStr = params.join(', ');

    // Build seeds array
    const seedsArrayFragment = getSeedsArrayFragment(node);

    // Build function body
    const functionBody = fragment`${seedsArrayFragment}
    return PublicKey.findProgramAddressSync(seedsBuffer, programId);`;

    return addFragmentImports(
        fragment`export function ${functionName}(${paramsStr}): [PublicKey, number] {\n    ${functionBody}\n}`,
        'web3',
        'PublicKey',
    );
}

function getSeedsArrayFragment(node: PdaNode): Fragment {
    if (node.seeds.length === 0) {
        return fragment`const seedsBuffer: Buffer[] = [];`;
    }

    const seedEntries = node.seeds.map(seed => {
        if (seed.kind === 'constantPdaSeedNode') {
            // Constant seed - encode the value directly based on its type
            if (seed.type.kind === 'bytesTypeNode' && seed.value.kind === 'bytesValueNode') {
                const hexData = seed.value.data;
                return fragment`Buffer.from('${hexData}', 'hex')`;
            } else if (seed.type.kind === 'stringTypeNode' && seed.value.kind === 'stringValueNode') {
                // For string seeds, encode as UTF-8
                return fragment`Buffer.from('${seed.value.string}', 'utf8')`;
            } else if (seed.type.kind === 'publicKeyTypeNode' && seed.value.kind === 'publicKeyValueNode') {
                // For publicKey seeds, decode from base58
                const base58 = seed.value.publicKey;
                return addFragmentImports(fragment`new PublicKey('${base58}').toBuffer()`, 'web3', 'PublicKey');
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

    return fragment`const seedsBuffer: Buffer[] = [\n${entriesContent}\n    ];`;
}

function getSeedEncodingFragment(seedName: string, seedType: any): Fragment {
    // Handle different seed types and their encoding
    if (seedType.kind === 'publicKeyTypeNode') {
        return fragment`seeds.${seedName}.toBuffer()`;
    } else if (seedType.kind === 'stringTypeNode') {
        return fragment`Buffer.from(seeds.${seedName}, 'utf8')`;
    } else if (seedType.kind === 'sizePrefixTypeNode' && seedType.type.kind === 'stringTypeNode') {
        // For Anchor-style strings with size prefix, we need to encode properly
        // Create a temporary schema and encode the string
        return addFragmentImports(
            fragment`(() => { const schema = struct([['value', str()]]); const buf = Buffer.alloc(1000); schema.encode({ value: seeds.${seedName} }, buf); return buf.subarray(0, schema.getSpan(buf)); })()`,
            'borsh',
            ['struct', 'str'],
        );
    } else if (seedType.kind === 'numberTypeNode') {
        // Numbers need to be encoded as buffers
        const format = seedType.format;
        if (format === 'u8') {
            return fragment`Buffer.from([seeds.${seedName}])`;
        } else if (format === 'u16') {
            return fragment`Buffer.from(new Uint8Array(new Uint16Array([seeds.${seedName}]).buffer))`;
        } else if (format === 'u32') {
            return fragment`Buffer.from(new Uint8Array(new Uint32Array([seeds.${seedName}]).buffer))`;
        } else if (format === 'u64') {
            return fragment`Buffer.from(new Uint8Array(new BigUint64Array([BigInt(seeds.${seedName})]).buffer))`;
        }
        return fragment`Buffer.from([seeds.${seedName}])`;
    } else if (seedType.kind === 'bytesTypeNode') {
        return fragment`seeds.${seedName}`;
    }

    // Default: try to use it as a buffer
    return fragment`seeds.${seedName}`;
}
