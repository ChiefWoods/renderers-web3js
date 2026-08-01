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
    getErrorsFragment,
    getEventFragment,
    getInstructionFunctionFragment,
    getPdaFunctionFragment,
    getConstantsFragment,
    getProgramConstantsFragment,
    getProgramFragment,
    getProgramIdConstantName,
    getTypesIndexFragment,
} from '../fragments';
import {
    DEFAULT_NAME_TRANSFORMERS,
    extractPdasFromInstructions,
    fragment,
    getCodeFileFragment,
    getDefinedTypeNodesToExtract,
    getImportFromFactory,
    getNameApi,
    parseCustomDataOptions,
    RenderMapOptions,
} from '../utils';
import { getTypeManifestVisitor } from './getTypeManifestVisitor';
import { getTypeVisitor } from './getTypeVisitor';

export function getRenderMapVisitor(options: RenderMapOptions = {}) {
    const linkables = new LinkableDictionary();
    const stack = new NodeStack();

    const customAccountData = parseCustomDataOptions(options.customAccountData ?? [], 'AccountData');
    const customInstructionData = parseCustomDataOptions(options.customInstructionData ?? [], 'InstructionData');
    const getImportFrom = getImportFromFactory(options.linkOverrides ?? {}, customAccountData, customInstructionData);
    const nameApi = getNameApi({ ...DEFAULT_NAME_TRANSFORMERS, ...options.nameTransformers });
    const asyncResolvers = (options.asyncResolvers ?? []).map(camelCase);
    const nonScalarEnums = (options.nonScalarEnums ?? []).map(camelCase);
    const internalNodes = (options.internalNodes ?? []).map(camelCase);
    const renderParentInstructions = options.renderParentInstructions ?? false;
    const dependencyMap = options.dependencyMap ?? {};
    let currentProgramIdConstant: string | undefined;
    let currentProgramName: string | undefined;
    const typeVisitor = getTypeVisitor({ getImportFrom, stack });
    const typeManifestVisitor = getTypeManifestVisitor({
        customAccountData,
        customInstructionData,
        getImportFrom,
        linkables,
        nameApi,
        nonScalarEnums,
        stack,
    });
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
                        getAccountTypeFragment(node, typeManifestVisitor, customAccountData, dependencyMap, nameApi),
                    );
                },

                visitDefinedType(node) {
                    return createRenderMap(
                        `types/${camelCase(node.name)}.ts`,
                        getDefinedTypeFragment(node, typeManifestVisitor, nameApi, dependencyMap),
                    );
                },

                visitInstruction(node) {
                    return createRenderMap(
                        `instructions/${camelCase(node.name)}.ts`,
                        getInstructionFunctionFragment(
                            node,
                            typeManifestVisitor,
                            visit(node, resolvedInstructionInputVisitor),
                            currentProgramIdConstant,
                            customInstructionData,
                            dependencyMap,
                            nameApi,
                            asyncResolvers,
                            getImportFrom,
                            undefined,
                            currentProgramName,
                        ),
                    );
                },

                visitPda(node) {
                    return createRenderMap(
                        `pdas/${camelCase(node.name)}.ts`,
                        getPdaFunctionFragment(
                            node,
                            typeVisitor,
                            currentProgramIdConstant,
                            dependencyMap,
                            currentProgramName,
                        ),
                    );
                },

                visitProgram(node, { self }) {
                    currentProgramIdConstant = getProgramIdConstantName(node.name, nameApi);
                    currentProgramName = node.name;
                    try {
                        const instructionsToRender = getAllInstructionsWithSubs(node, {
                            leavesOnly: !renderParentInstructions,
                        });
                        const extractedPdas = extractPdasFromInstructions(instructionsToRender);
                        const allPdas = [...node.pdas, ...extractedPdas];
                        // Last write wins — matches PDA file generation order (extracted overwrites program PDAs).
                        const pdaNodes = new Map(allPdas.map(pda => [String(pda.name), pda]));
                        const extractedTypes = [
                            ...getDefinedTypeNodesToExtract(node.accounts, customAccountData),
                            ...getDefinedTypeNodesToExtract(instructionsToRender, customInstructionData),
                        ];
                        const allDefinedTypes = [...node.definedTypes, ...extractedTypes];
                        const programForExports = {
                            ...node,
                            definedTypes: allDefinedTypes,
                            instructions: instructionsToRender,
                            pdas: allPdas,
                        };
                        const programFileName = camelCase(node.name);
                        const errorsFragment = getErrorsFragment(node, dependencyMap);
                        const events = node.events ?? [];
                        const getBarrelFragment = (names: string[]) =>
                            getCodeFileFragment(
                                [fragment`${names.map(name => `export * from './${name}';`).join('\n')}`],
                                dependencyMap,
                            );
                        const getPublicNames = <T extends { name: string }>(nodes: T[]) =>
                            nodes
                                .filter(child => !internalNodes.includes(camelCase(child.name)))
                                .map(child => camelCase(child.name));

                        const renderMaps = [
                            createRenderMap(
                                `index.ts`,
                                getProgramConstantsFragment(programForExports, internalNodes, dependencyMap),
                            ),
                            ...((node.constants ?? []).length > 0
                                ? [
                                      createRenderMap(
                                          `constants.ts`,
                                          getConstantsFragment(
                                              programForExports,
                                              typeManifestVisitor,
                                              dependencyMap,
                                              nonScalarEnums,
                                          ),
                                      ),
                                  ]
                                : []),
                            createRenderMap(
                                `programs/${programFileName}.ts`,
                                getProgramFragment(programForExports, dependencyMap, nameApi),
                            ),
                            createRenderMap(
                                `programs/index.ts`,
                                getCodeFileFragment([fragment`export * from './${programFileName}';`], dependencyMap),
                            ),
                            ...(errorsFragment
                                ? [
                                      createRenderMap(`errors/${programFileName}.ts`, errorsFragment),
                                      createRenderMap(
                                          `errors/index.ts`,
                                          getCodeFileFragment(
                                              [fragment`export * from './${programFileName}';`],
                                              dependencyMap,
                                          ),
                                      ),
                                  ]
                                : []),
                            ...(node.accounts.length > 0
                                ? [
                                      createRenderMap(
                                          `accounts/index.ts`,
                                          getBarrelFragment(getPublicNames(node.accounts)),
                                      ),
                                  ]
                                : []),
                            ...events.map(event =>
                                createRenderMap(
                                    `events/${camelCase(event.name)}.ts`,
                                    getEventFragment(event, typeManifestVisitor, dependencyMap),
                                ),
                            ),
                            ...(events.length > 0
                                ? [createRenderMap(`events/index.ts`, getBarrelFragment(getPublicNames(events)))]
                                : []),
                            ...(instructionsToRender.length > 0
                                ? [
                                      createRenderMap(
                                          `instructions/index.ts`,
                                          getBarrelFragment(getPublicNames(instructionsToRender)),
                                      ),
                                  ]
                                : []),
                            ...(allPdas.length > 0
                                ? [createRenderMap(`pdas/index.ts`, getBarrelFragment(getPublicNames(allPdas)))]
                                : []),
                            ...node.accounts.map(n => visit(n, self)),
                            ...allDefinedTypes.map(n => visit(n, self)),
                            ...instructionsToRender.map(n =>
                                createRenderMap(
                                    `instructions/${camelCase(n.name)}.ts`,
                                    getInstructionFunctionFragment(
                                        n,
                                        typeManifestVisitor,
                                        visit(n, resolvedInstructionInputVisitor),
                                        currentProgramIdConstant,
                                        customInstructionData,
                                        dependencyMap,
                                        nameApi,
                                        asyncResolvers,
                                        getImportFrom,
                                        pdaNodes,
                                        node.name,
                                    ),
                                ),
                            ),
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
                        currentProgramName = undefined;
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
