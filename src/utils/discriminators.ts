import {
    DiscriminatorNode,
    isNode,
    Node,
    NumberTypeNode,
    pascalCase,
    resolveNestedTypeNode,
    snakeCase,
    TypeNode,
    ValueNode,
    VALUE_NODES,
} from '@codama/nodes';

import { encodeStringValue } from './codecs';

export type DiscriminatorInfo = {
    bytes: number[];
    constantName: string;
    offset: number;
};

type DiscriminatorField = {
    readonly defaultValue?: Node;
    readonly name: string;
    readonly type: TypeNode;
};

export function getDiscriminatorInfos(
    name: string,
    kind: 'account' | 'event' | 'instruction',
    discriminators: DiscriminatorNode[] = [],
    fields: readonly DiscriminatorField[] = [],
): DiscriminatorInfo[] {
    return discriminators.flatMap((discriminator, index) => {
        const value = getDiscriminatorValue(discriminator, fields);
        if (!value) return [];
        const suffix = index === 0 ? '' : `_${index + 1}`;
        const baseName = snakeCase(name).toUpperCase();
        const kindName = kind.toUpperCase();
        const discriminatorName =
            kind === 'event'
                ? baseName.replace(/_EVENT$/, '')
                : baseName.endsWith(`_${kindName}`)
                  ? baseName
                  : `${baseName}_${kindName}`;
        return [
            {
                ...value,
                constantName: `${discriminatorName}_DISCRIMINATOR${suffix}`,
            },
        ];
    });
}

function getDiscriminatorValue(
    discriminator: DiscriminatorNode,
    fields: readonly DiscriminatorField[],
): Omit<DiscriminatorInfo, 'constantName'> | undefined {
    if (discriminator.kind === 'constantDiscriminatorNode') {
        const bytes = encodeValue(discriminator.constant.type, discriminator.constant.value);
        return bytes ? { bytes, offset: discriminator.offset } : undefined;
    }
    if (discriminator.kind === 'fieldDiscriminatorNode') {
        const field = fields.find(candidate => candidate.name === discriminator.name);
        if (!field?.defaultValue || !isNode(field.defaultValue, VALUE_NODES)) return;
        const bytes = encodeValue(field.type, field.defaultValue);
        return bytes ? { bytes, offset: discriminator.offset } : undefined;
    }
    return;
}

function encodeValue(type: TypeNode, value: ValueNode): number[] | undefined {
    const resolvedType = resolveNestedTypeNode(type);

    if (resolvedType.kind === 'numberTypeNode' && value.kind === 'numberValueNode') {
        return encodeNumber(resolvedType, value.number);
    }
    if (resolvedType.kind === 'bytesTypeNode' && value.kind === 'bytesValueNode') {
        return [...encodeStringValue(value.encoding, value.data)];
    }
    if (resolvedType.kind === 'stringTypeNode' && value.kind === 'stringValueNode') {
        return [...encodeStringValue(resolvedType.encoding, value.string)];
    }
    if (resolvedType.kind === 'booleanTypeNode' && value.kind === 'booleanValueNode') {
        return [value.boolean ? 1 : 0];
    }
    if (
        resolvedType.kind === 'arrayTypeNode' &&
        resolvedType.item.kind === 'numberTypeNode' &&
        resolvedType.item.format === 'u8' &&
        value.kind === 'arrayValueNode' &&
        value.items.every(item => item.kind === 'numberValueNode')
    ) {
        return value.items.map(item => (item.kind === 'numberValueNode' ? item.number : 0));
    }
    return;
}

function encodeNumber(type: NumberTypeNode, value: number): number[] | undefined {
    const sizes: Partial<Record<NumberTypeNode['format'], number>> = {
        i128: 16,
        i16: 2,
        i32: 4,
        i64: 8,
        i8: 1,
        u128: 16,
        u16: 2,
        u32: 4,
        u64: 8,
        u8: 1,
    };
    const size = sizes[type.format];
    if (!size) return;
    const signed = type.format.startsWith('i');
    const bits = BigInt(size * 8);
    let encoded = BigInt(value);
    if (signed && encoded < 0) encoded = (1n << bits) + encoded;
    const bytes = Array.from({ length: size }, (_, index) => Number((encoded >> BigInt(index * 8)) & 0xffn));
    return type.endian === 'be' ? bytes.reverse() : bytes;
}

export function getDiscriminatorConstantContent(info: DiscriminatorInfo): string {
    return `export const ${info.constantName} = new Uint8Array([${info.bytes.join(', ')}]);`;
}

export function getDiscriminatorValidationContent(info: DiscriminatorInfo, dataName = 'data'): string {
    return `if (!${info.constantName}.every((byte, index) => ${dataName}[${info.offset} + index] === byte)) {
        throw new Error('${pascalCase(info.constantName.replace(/_DISCRIMINATOR(?:_\\d+)?$/, ''))} discriminator mismatch');
    }`;
}
