import { pascalCase, ProgramNode, snakeCase } from '@codama/nodes';

import { Fragment, fragment, getCodeFileFragment, PathOverrides } from '../utils';

export function getErrorsFragment(node: ProgramNode, dependencyMap: PathOverrides = {}): Fragment | undefined {
    const errors = node.errors ?? [];
    if (errors.length === 0) return;

    const name = pascalCase(node.name);
    const typeName = `${name}Error`;
    const errorInfoTypeName = `${name}ErrorInfo`;
    const constants = [...errors]
        .sort((a, b) => a.code - b.code)
        .map(
            error =>
                `export const ${getErrorConstantName(node.name, error.name)} = 0x${error.code.toString(16)}; // ${error.code}`,
        )
        .join('\n');
    const errorTypes = [...errors]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(error => `typeof ${getErrorConstantName(node.name, error.name)}`)
        .join(' | ');
    const entries = [...errors]
        .sort((a, b) => a.code - b.code)
        .map(
            error =>
                `    [${getErrorConstantName(node.name, error.name)}]: { code: ${error.code}, name: ${JSON.stringify(error.name)}, message: ${JSON.stringify(error.message)} },`,
        )
        .join('\n');

    return getCodeFileFragment(
        [
            fragment`${constants}

export type ${typeName} = ${errorTypes};

export interface ${errorInfoTypeName} {
    code: ${typeName};
    name: string;
    message: string;
}

const ${node.name.toUpperCase()}_ERRORS: Readonly<Record<${typeName}, ${errorInfoTypeName}>> = {
${entries}
};

export function get${name}ErrorFromCode(code: number): ${errorInfoTypeName} | undefined {
    return ${node.name.toUpperCase()}_ERRORS[code as ${typeName}];
}

export function get${name}ErrorMessage(code: ${typeName}): string {
    return ${node.name.toUpperCase()}_ERRORS[code].message;
}`,
        ],
        dependencyMap,
    );
}

function getErrorConstantName(programName: string, errorName: string): string {
    return `${snakeCase(programName).toUpperCase()}_ERROR__${snakeCase(errorName).toUpperCase()}`;
}
