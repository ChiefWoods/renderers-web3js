import { camelCase, getAllInstructionsWithSubs } from '@codama/nodes';
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
import {
    DEFAULT_NAME_TRANSFORMERS,
    extractPdasFromInstructions,
    getDefinedTypeNodesToExtract,
    getImportFromFactory,
    getNameApi,
    parseCustomDataOptions,
    RenderMapOptions,
} from '../utils';
import { getBorshSchemaVisitor } from './getBorshSchemaVisitor';
import { getTypeVisitor } from './getTypeVisitor';

export function getRenderMapVisitor(options: RenderMapOptions = {}) {
    const linkables = new LinkableDictionary();
    const stack = new NodeStack();

    const customAccountData = parseCustomDataOptions(options.customAccountData ?? [], 'AccountData');
    const customInstructionData = parseCustomDataOptions(options.customInstructionData ?? [], 'InstructionData');
    const getImportFrom = getImportFromFactory(
        options.linkOverrides ?? {},
        customAccountData,
        customInstructionData,
    );
    const nameApi = getNameApi({ ...DEFAULT_NAME_TRANSFORMERS, ...options.nameTransformers });
    const internalNodes = (options.internalNodes ?? []).map(camelCase);
    const renderParentInstructions = options.renderParentInstructions ?? false;
    const dependencyMap = options.dependencyMap ?? {};
    let currentProgramIdConstant: string | undefined;
    const typeVisitor = getTypeVisitor({ getImportFrom, stack });
    const borshSchemaVisitor = getBorshSchemaVisitor({ getImportFrom, stack });
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
                        getAccountTypeFragment(
                            node,
                            typeVisitor,
                            borshSchemaVisitor,
                            customAccountData,
                            dependencyMap,
                        ),
                    );
                },

                visitDefinedType(node) {
                    return createRenderMap(
                        `types/${camelCase(node.name)}.ts`,
                        getDefinedTypeFragment(node, typeVisitor, borshSchemaVisitor, dependencyMap),
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
                            dependencyMap,
                            nameApi,
                        ),
                    );
                },

                visitPda(node) {
                    return createRenderMap(
                        `pdas/${camelCase(node.name)}.ts`,
                        getPdaFunctionFragment(node, typeVisitor, currentProgramIdConstant, dependencyMap),
                    );
                },

                visitProgram(node, { self }) {
                    currentProgramIdConstant = getProgramIdConstantName(node.name, nameApi);
                    try {
                        const instructionsToRender = getAllInstructionsWithSubs(node, {
                            leavesOnly: !renderParentInstructions,
                        });
                        const extractedPdas = extractPdasFromInstructions(instructionsToRender);
                        const allPdas = [...node.pdas, ...extractedPdas];
                        const extractedTypes = [
                            ...getDefinedTypeNodesToExtract(node.accounts, customAccountData),
                            ...getDefinedTypeNodesToExtract(instructionsToRender, customInstructionData),
                        ];
                        const allDefinedTypes = [...node.definedTypes, ...extractedTypes];
                        const programForExports = {
                            ...node,
                            definedTypes: allDefinedTypes,
                            instructions: instructionsToRender,
                        };

                        const renderMaps = [
                            createRenderMap(
                                `index.ts`,
                                getProgramConstantsFragment(programForExports, internalNodes, dependencyMap, nameApi),
                            ),
                            ...node.accounts.map(n => visit(n, self)),
                            ...allDefinedTypes.map(n => visit(n, self)),
                            ...instructionsToRender.map(n => visit(n, self)),
                            ...node.pdas.map(n => visit(n, self)),
                            ...allPdas.map(n => visit(n, self)),
                        ];

                        // Only create types index file if there are defined types
                        if (allDefinedTypes.length > 0) {
                            renderMaps.push(
                                createRenderMap(
                                    `types/index.ts`,
                                    getTypesIndexFragment({ ...node, definedTypes: allDefinedTypes }, internalNodes),
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
