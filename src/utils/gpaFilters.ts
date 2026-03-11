import type { BytesEncoding } from '@codama/nodes';
import {
    type AccountNode,
    type ConstantDiscriminatorNode,
    type DiscriminatorNode,
    type FieldDiscriminatorNode,
} from '@codama/nodes';

import { encodeStringValue } from './codecs';
import { encodeBytesToBase58 } from './codecs';

export type GpaFilter = {
    dataSize?: number;
    memcmp?: { bytes: string; offset: number };
};

/**
 * Resolves GPA filters from an AccountNode. Returns null if no filters can be built
 * (requires at least discriminator or size).
 */
export function getGpaFiltersFromAccountNode(node: AccountNode): GpaFilter | null {
    const filters: GpaFilter = {};

    // Resolve discriminator for memcmp filter
    const discriminatorFilter = getDiscriminatorMemcmpFilter(node);
    if (discriminatorFilter) {
        filters.memcmp = discriminatorFilter;
    }

    // Add dataSize filter when account has fixed size
    if (node.size != null) {
        filters.dataSize = node.size;
    }

    if (!filters.memcmp && filters.dataSize == null) {
        return null;
    }

    return filters;
}

function getDiscriminatorMemcmpFilter(node: AccountNode): { bytes: string; offset: number } | null {
    const discriminators = node.discriminators ?? [];
    if (discriminators.length === 0) return null;

    // Use first discriminator for filter (typically only one per account)
    const discriminator = discriminators[0];
    const bytes = getDiscriminatorBytes(discriminator, node);
    if (!bytes) return null;

    const offset = 'offset' in discriminator ? discriminator.offset : 0;
    return { bytes: encodeBytesToBase58(bytes), offset };
}

function getDiscriminatorBytes(discriminator: DiscriminatorNode, node: AccountNode): Uint8Array | null {
    switch (discriminator.kind) {
        case 'constantDiscriminatorNode':
            return getConstantDiscriminatorBytes(discriminator);
        case 'fieldDiscriminatorNode':
            return getFieldDiscriminatorBytes(discriminator, node);
        default:
            return null;
    }
}

function getConstantDiscriminatorBytes(discriminator: ConstantDiscriminatorNode): Uint8Array | null {
    const constant = discriminator.constant;
    if (!constant) return null;

    // constantValueNodeFromBytes has encoding and data
    if ('encoding' in constant && 'data' in constant) {
        const bytes = encodeStringValue(constant.encoding as BytesEncoding, constant.data as string);
        return new Uint8Array(bytes);
    }

    // constantValueNode with number value
    if (constant.kind === 'constantValueNode' && constant.value?.kind === 'numberValueNode') {
        const type = constant.type?.kind === 'numberTypeNode' ? constant.type : null;
        return encodeNumberToBytes(Number(constant.value.number), type ?? { endian: 'le', format: 'u32' });
    }

    return null;
}

function getFieldDiscriminatorBytes(discriminator: FieldDiscriminatorNode, node: AccountNode): Uint8Array | null {
    if (node.data.kind !== 'structTypeNode') return null;

    const field = node.data.fields.find(f => f.name === discriminator.name);
    if (!field?.defaultValue) return null;

    const value = field.defaultValue;
    const numType =
        field.type?.kind === 'numberTypeNode' ? field.type : { endian: 'le' as const, format: 'u32' as const };
    if (value.kind === 'numberValueNode') {
        return encodeNumberToBytes(Number(value.number), numType);
    }
    if (value.kind === 'bytesValueNode') {
        const bytes = encodeStringValue(value.encoding, value.data);
        return new Uint8Array(bytes);
    }

    return null;
}

function encodeNumberToBytes(num: number, type: { endian?: 'be' | 'le'; format?: string }): Uint8Array {
    const format = type?.format ?? 'u32';
    const endian = type?.endian ?? 'le';
    const le = endian === 'le';

    const writeBytes = (byteLength: number) => {
        const buf = new Uint8Array(byteLength);
        for (let i = 0; i < byteLength; i++) {
            const shift = i * 8;
            buf[le ? i : byteLength - 1 - i] = (num >> shift) & 0xff;
        }
        return buf;
    };

    switch (format) {
        case 'u8':
            return new Uint8Array([num & 0xff]);
        case 'u16':
            return writeBytes(2);
        case 'u32':
            return writeBytes(4);
        case 'u64':
            return writeBytes(8);
        default:
            return writeBytes(4);
    }
}
