import { camelCase, DefinedTypeNode, isDataEnum, isNode, pascalCase } from '@codama/nodes';
import { visit } from '@codama/visitors-core';

import { Fragment, fragment, getCodeFileFragment } from '../utils';
import { BorshSchemaVisitor, TypeVisitor } from '../visitors';

export function getDefinedTypeFragment(
    node: DefinedTypeNode,
    typeVisitor: TypeVisitor,
    borshSchemaVisitor: BorshSchemaVisitor,
): Fragment {
    const fragments: Fragment[] = [];

    // 1. Generate the type definition
    const typeDefinition = visit(node, typeVisitor);
    fragments.push(typeDefinition);

    // 2. Generate Borsh schema if it's a struct, enum, or tuple
    if (
        node.type.kind === 'structTypeNode' ||
        node.type.kind === 'enumTypeNode' ||
        node.type.kind === 'tupleTypeNode'
    ) {
        const schemaFragment = getTypeSchemaFragment(node, borshSchemaVisitor);
        if (schemaFragment) {
            fragments.push(schemaFragment);
        }
    }

    const helperFragment = getDiscriminatedUnionHelpersFragment(node);
    if (helperFragment) {
        fragments.push(helperFragment);
    }

    // Combine fragments and prepend imports
    return getCodeFileFragment(fragments);
}

function getTypeSchemaFragment(node: DefinedTypeNode, borshSchemaVisitor: BorshSchemaVisitor): Fragment | undefined {
    // Don't generate schemas for simple type aliases
    if (
        node.type.kind !== 'structTypeNode' &&
        node.type.kind !== 'enumTypeNode' &&
        node.type.kind !== 'tupleTypeNode'
    ) {
        return undefined;
    }

    const schema = visit(node.type, borshSchemaVisitor);
    return fragment`export const ${node.name}Codec = ${schema};`;
}

function getDiscriminatedUnionHelpersFragment(node: DefinedTypeNode): Fragment | undefined {
    if (!isNode(node.type, 'enumTypeNode') || !isDataEnum(node.type)) {
        return;
    }

    const typeName = pascalCase(node.name);
    const constructorName = camelCase(node.name);
    const guardName = `is${typeName}`;
    const discriminator = '__kind';

    const strictName = typeName;
    const getVariantType = `GetDiscriminatedUnionVariant<${strictName}, '${discriminator}'`;
    const getVariantContentType = `GetDiscriminatedUnionVariantContent<${strictName}, '${discriminator}'`;

    const overloads = node.type.variants.map(variant => {
        const variantName = pascalCase(variant.name);
        const variantType = `${getVariantType}, '${variantName}'>`;
        const variantContentType = `${getVariantContentType}, '${variantName}'>`;

        if (isNode(variant, 'enumEmptyVariantTypeNode')) {
            return `export function ${constructorName}(kind: '${variantName}'): ${variantType};`;
        }
        if (isNode(variant, 'enumTupleVariantTypeNode')) {
            return `export function ${constructorName}(kind: '${variantName}', data: ${variantContentType}['fields']): ${variantType};`;
        }

        return `export function ${constructorName}(kind: '${variantName}', data: ${variantContentType}): ${variantType};`;
    });

    return fragment`// Data Enum Helpers.
type GetDiscriminatedUnionVariant<
    TUnion,
    TDiscriminator extends keyof TUnion,
    TKind extends TUnion[TDiscriminator]
> = Extract<TUnion, Record<TDiscriminator, TKind>>;

type GetDiscriminatedUnionVariantContent<
    TUnion,
    TDiscriminator extends keyof TUnion,
    TKind extends TUnion[TDiscriminator]
> = Omit<GetDiscriminatedUnionVariant<TUnion, TDiscriminator, TKind>, TDiscriminator>;

${overloads.join('\n')}
export function ${constructorName}<K extends ${typeName}['${discriminator}'], Data>(kind: K, data?: Data) {
    if (Array.isArray(data)) {
        return { ${discriminator}: kind, fields: data };
    }
    return { ${discriminator}: kind, ...(data ?? {}) };
}

export function ${guardName}<K extends ${typeName}['${discriminator}']>(kind: K, value: ${typeName}): value is ${typeName} & { ${discriminator}: K } {
    return value.${discriminator} === kind;
}`;
}
