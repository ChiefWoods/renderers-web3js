import { camelCase } from '@codama/nodes';
import { createRenderMap, mergeRenderMaps } from '@codama/renderers-core';
import {
    extendVisitor,
    LinkableDictionary,
    NodeStack,
    pipe,
    recordLinkablesOnFirstVisitVisitor,
    recordNodeStackVisitor,
    staticVisitor,
    visit,
} from '@codama/visitors-core';

import {
    getAccountTypeFragment,
    getDefinedTypeFragment,
    getHelpersFragment,
    getInstructionFunctionFragment,
    getPdaFunctionFragment,
    getProgramConstantsFragment,
    getTypesIndexFragment,
} from '../fragments';
import { RenderMapOptions } from '../utils';
import { getBorshSchemaVisitor } from './getBorshSchemaVisitor';
import { getTypeVisitor } from './getTypeVisitor-v2';

export function getRenderMapVisitor(options: RenderMapOptions = {}) {
    const linkables = new LinkableDictionary();
    const stack = new NodeStack();

    const extension = options.extension ?? 'ts';
    const indexFilename = options.indexFilename ?? 'index';
    const typeVisitor = getTypeVisitor({ stack, typeIndent: options.typeIndent });
    const borshSchemaVisitor = getBorshSchemaVisitor({ stack });

    return pipe(
        staticVisitor(() => createRenderMap(), {
            keys: ['rootNode', 'programNode', 'pdaNode', 'accountNode', 'definedTypeNode', 'instructionNode'],
        }),
        v =>
            extendVisitor(v, {
                visitAccount(node) {
                    console.log(`\n📦 [RenderMap] Generating account: ${node.name}`);
                    console.log(`   → File: accounts/${camelCase(node.name)}.${extension}`);
                    const result = createRenderMap(
                        `accounts/${camelCase(node.name)}.${extension}`,
                        getAccountTypeFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                    console.log(`   ✓ Generated ${Object.keys(result).length} file(s)`);
                    return result;
                },

                visitDefinedType(node) {
                    console.log(`\n📘 [RenderMap] Generating defined type: ${node.name}`);
                    console.log(`   → File: types/${camelCase(node.name)}.${extension}`);
                    const result = createRenderMap(
                        `types/${camelCase(node.name)}.${extension}`,
                        getDefinedTypeFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                    console.log(`   ✓ Generated`);
                    return result;
                },

                visitInstruction(node) {
                    console.log(`\n⚡ [RenderMap] Generating instruction: ${node.name}`);
                    console.log(`   → File: instructions/${camelCase(node.name)}.${extension}`);
                    const result = createRenderMap(
                        `instructions/${camelCase(node.name)}.${extension}`,
                        getInstructionFunctionFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                    console.log(`   ✓ Generated`);
                    return result;
                },

                visitPda(node) {
                    console.log(`\n🔑 [RenderMap] Generating PDA: ${node.name}`);
                    console.log(`   → File: pdas/${camelCase(node.name)}.${extension}`);
                    const result = createRenderMap(
                        `pdas/${camelCase(node.name)}.${extension}`,
                        getPdaFunctionFragment(node, typeVisitor),
                    );
                    console.log(`   ✓ Generated`);
                    return result;
                },

                visitProgram(node, { self }) {
                    console.log(`\n🚀 [RenderMap] Processing program: ${node.name}`);
                    console.log(`   Accounts: ${node.accounts.length}`);
                    console.log(`   Types: ${node.definedTypes.length}`);
                    console.log(`   Instructions: ${node.instructions.length}`);
                    console.log(`   PDAs: ${node.pdas.length}`);

                    const renderMaps = [
                        createRenderMap(`${indexFilename}.${extension}`, getProgramConstantsFragment(node)),
                        ...node.accounts.map(n => visit(n, self)),
                        ...node.definedTypes.map(n => visit(n, self)),
                        ...node.instructions.map(n => visit(n, self)),
                        ...node.pdas.map(n => visit(n, self)),
                    ];

                    // Only create types index file if there are defined types
                    if (node.definedTypes.length > 0) {
                        console.log(`\n📑 [RenderMap] Generating types index file`);
                        renderMaps.push(
                            createRenderMap(`types/${indexFilename}.${extension}`, getTypesIndexFragment(node)),
                        );
                    }

                    // Always generate helpers file for custom Borsh layouts
                    console.log(`\n🛠️  [RenderMap] Generating helpers file`);
                    renderMaps.push(
                        createRenderMap(`helpers/${indexFilename}.${extension}`, getHelpersFragment()),
                    );

                    const merged = mergeRenderMaps(renderMaps);
                    console.log(`\n✅ [RenderMap] Total files generated: ${Object.keys(merged).length}`);
                    return merged;
                },

                visitRoot(node, { self }) {
                    // Here, we ignore `node.additionalPrograms` for simplicity.
                    return visit(node.program, self);
                },
            }),
        v => recordNodeStackVisitor(v, stack),
        v => recordLinkablesOnFirstVisitVisitor(v, linkables),
    );
}
