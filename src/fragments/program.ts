import { camelCase, pascalCase, ProgramNode, resolveNestedTypeNode, snakeCase } from '@codama/nodes';

import {
    addFragmentImports,
    Fragment,
    fragment,
    getCodeFileFragment,
    getDiscriminatorInfos,
    PathOverrides,
} from '../utils';
import { getProgramIdConstantName } from './programConstants';

export function getProgramFragment(
    node: ProgramNode,
    dependencyMap: PathOverrides = {},
    nameApi = undefined as Parameters<typeof getProgramIdConstantName>[1] | undefined,
): Fragment {
    const name = pascalCase(node.name);
    const programIdConstant = getProgramIdConstantName(node.name, nameApi);
    let descriptor = addFragmentImports(
        fragment`export const ${programIdConstant} = new Address('${node.publicKey}');
export const ${snakeCase(node.name).toUpperCase()}_PROGRAM_ADDRESS = ${programIdConstant};

export interface ${name}Program {
    name: '${node.name}';
    programId: Address;
}

export function get${name}Program(programId: Address = ${programIdConstant}): ${name}Program {
    return { name: '${node.name}', programId };
}`,
        'web3',
        'Address',
    );

    if (node.accounts.length > 0) {
        const accountEnum = `${name}Account`;
        const discriminatedAccounts = node.accounts.flatMap(account => {
            const discriminators = getDiscriminatorInfos(
                account.name,
                'account',
                account.discriminators ?? [],
                resolveNestedTypeNode(account.data).fields,
            );
            return discriminators.length > 0 ? [{ account, discriminators }] : [];
        });

        if (discriminatedAccounts.length > 0) {
            const variants = node.accounts.map(account => `    ${pascalCase(account.name)},`).join('\n');
            const checks = discriminatedAccounts
                .map(({ account, discriminators }) => {
                    const predicate = discriminators
                        .map(
                            discriminator =>
                                `${discriminator.constantName}.every((byte, index) => data[${discriminator.offset} + index] === byte)`,
                        )
                        .join(' && ');
                    return `    if (${predicate}) return ${accountEnum}.${pascalCase(account.name)};`;
                })
                .join('\n');

            descriptor = addFragmentImports(
                fragment`${descriptor}

export enum ${accountEnum} {
${variants}
}

export function identify${name}Account(account: { data: Uint8Array } | Uint8Array): ${accountEnum} {
    const data = account instanceof Uint8Array ? account : account.data;
${checks}
    throw new Error('Failed to identify ${name} account');
}`,
                'web3',
                'Address',
            );

            for (const { account, discriminators } of discriminatedAccounts) {
                descriptor = addFragmentImports(
                    descriptor,
                    `../accounts/${camelCase(account.name)}`,
                    discriminators.map(discriminator => discriminator.constantName),
                );
            }
        }
    }

    if (node.instructions.length > 0) {
        const instructionEnum = `${name}Instruction`;
        const discriminatedInstructions = node.instructions.flatMap(instruction => {
            const discriminators = getDiscriminatorInfos(
                instruction.name,
                'instruction',
                instruction.discriminators ?? [],
                instruction.arguments,
            );
            return discriminators.length > 0 ? [{ discriminators, instruction }] : [];
        });

        if (discriminatedInstructions.length > 0) {
            const variants = node.instructions.map(instruction => `    ${pascalCase(instruction.name)},`).join('\n');
            const checks = discriminatedInstructions
                .map(({ discriminators, instruction }) => {
                    const predicate = discriminators
                        .map(
                            discriminator =>
                                `${discriminator.constantName}.every((byte, index) => data[${discriminator.offset} + index] === byte)`,
                        )
                        .join(' && ');
                    return `    if (${predicate}) return ${instructionEnum}.${pascalCase(instruction.name)};`;
                })
                .join('\n');
            const parsedType = `Parsed${name}Instruction`;
            const parsedUnion = discriminatedInstructions
                .map(
                    ({ instruction }) =>
                        `    | ({ instructionType: ${instructionEnum}.${pascalCase(instruction.name)} } & Parsed${pascalCase(instruction.name)}Instruction)`,
                )
                .join('\n');
            const parseCases = discriminatedInstructions
                .map(
                    ({ instruction }) => `        case ${instructionEnum}.${pascalCase(instruction.name)}:
            return {
                instructionType,
                ...parse${pascalCase(instruction.name)}Instruction(instruction),
            };`,
                )
                .join('\n');

            descriptor = addFragmentImports(
                fragment`${descriptor}

export enum ${instructionEnum} {
${variants}
}

export function identify${name}Instruction(instruction: { data: Uint8Array } | Uint8Array): ${instructionEnum} {
    const data = instruction instanceof Uint8Array ? instruction : instruction.data;
${checks}
    throw new Error('Failed to identify ${name} instruction');
}

export type ${parsedType} =
${parsedUnion};

export function parse${name}Instruction(instruction: TransactionInstruction): ${parsedType} {
    const instructionType = identify${name}Instruction(instruction);
    switch (instructionType) {
${parseCases}
    }
}`,
                'web3',
                'TransactionInstruction',
            );

            for (const { discriminators, instruction } of discriminatedInstructions) {
                descriptor = addFragmentImports(descriptor, `../instructions/${camelCase(instruction.name)}`, [
                    ...discriminators.map(discriminator => discriminator.constantName),
                    `parse${pascalCase(instruction.name)}Instruction`,
                    `type Parsed${pascalCase(instruction.name)}Instruction`,
                ]);
            }
        }
    }

    return getCodeFileFragment([descriptor], dependencyMap);
}
