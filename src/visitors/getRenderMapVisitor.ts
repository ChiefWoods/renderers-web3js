import { camelCase } from '@codama/nodes';
import { createRenderMap, mergeRenderMaps } from '@codama/renderers-core';
import {
    extendVisitor,
    getResolvedInstructionInputsVisitor,
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
    getInstructionFunctionFragment,
    getPdaFunctionFragment,
    getProgramConstantsFragment,
    getProgramIdConstantName,
    getTypesIndexFragment,
} from '../fragments';
import { extractPdasFromInstructions, getDefinedTypeNodesToExtract, parseCustomDataOptions, RenderMapOptions } from '../utils';
import { getBorshSchemaVisitor } from './getBorshSchemaVisitor';
import { getTypeVisitor } from './getTypeVisitor';

export function getRenderMapVisitor(options: RenderMapOptions = {}) {
    const linkables = new LinkableDictionary();
    const stack = new NodeStack();

    const customAccountData = parseCustomDataOptions(options.customAccountData ?? [], 'AccountData');
    const customInstructionData = parseCustomDataOptions(options.customInstructionData ?? [], 'InstructionData');
    let currentProgramIdConstant: string | undefined;
    const typeVisitor = getTypeVisitor({ stack });
    const borshSchemaVisitor = getBorshSchemaVisitor({ stack });
    const resolvedInstructionInputVisitor = getResolvedInstructionInputsVisitor();

    return pipe(
        staticVisitor(() => createRenderMap(), {
            keys: ['rootNode', 'programNode', 'pdaNode', 'accountNode', 'definedTypeNode', 'instructionNode'],
        }),
        v =>
            extendVisitor(v, {
                visitAccount(node) {
                    return createRenderMap(
                        `accounts/${camelCase(node.name)}.ts`,
                        getAccountTypeFragment(node, typeVisitor, borshSchemaVisitor, customAccountData),
                    );
                },

                visitDefinedType(node) {
                    return createRenderMap(
                        `types/${camelCase(node.name)}.ts`,
                        getDefinedTypeFragment(node, typeVisitor, borshSchemaVisitor),
                    );
                },

                visitInstruction(node) {
                    return createRenderMap(
                        `instructions/${camelCase(node.name)}.ts`,
                        getInstructionFunctionFragment(
                            node,
                            typeVisitor,
                            borshSchemaVisitor,
                            visit(node, resolvedInstructionInputVisitor),
                            currentProgramIdConstant,
                            customInstructionData,
                        ),
                    );
                },

                visitPda(node) {
                    return createRenderMap(
                        `pdas/${camelCase(node.name)}.ts`,
                        getPdaFunctionFragment(node, typeVisitor, currentProgramIdConstant),
                    );
                },

                visitProgram(node, { self }) {
                    currentProgramIdConstant = getProgramIdConstantName(node.name);
                    try {
                        const extractedPdas = extractPdasFromInstructions(node.instructions);
                        const allPdas = [...node.pdas, ...extractedPdas];
                        const extractedTypes = [
                            ...getDefinedTypeNodesToExtract(node.accounts, customAccountData),
                            ...getDefinedTypeNodesToExtract(node.instructions, customInstructionData),
                        ];
                        const allDefinedTypes = [...node.definedTypes, ...extractedTypes];

                        const renderMaps = [
                            createRenderMap(
                                `index.ts`,
                                getProgramConstantsFragment({ ...node, definedTypes: allDefinedTypes }),
                            ),
                            ...node.accounts.map(n => visit(n, self)),
                            ...allDefinedTypes.map(n => visit(n, self)),
                            ...node.instructions.map(n => visit(n, self)),
                            ...node.pdas.map(n => visit(n, self)),
                            ...allPdas.map(n => visit(n, self)),
                        ];

                        // Only create types index file if there are defined types
                        if (allDefinedTypes.length > 0) {
                            renderMaps.push(
                                createRenderMap(
                                    `types/index.ts`,
                                    getTypesIndexFragment({ ...node, definedTypes: allDefinedTypes }),
                                ),
                            );
                        }

                        return mergeRenderMaps(renderMaps);
                    } finally {
                        currentProgramIdConstant = undefined;
                    }
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
