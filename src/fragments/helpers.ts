import { Fragment, fragment } from '../utils';

/**
 * Generate the helpers file with custom Borsh layout functions
 */
export function getHelpersFragment(): Fragment {
    // Return the complete file content including imports
    return getOptionU32Fragment();
}

function getOptionU32Fragment(): Fragment {
    // Create fragment with manual imports in content to avoid import merging issues
    return fragment`import { Layout } from '@solana/buffer-layout';
import { u32 } from '@coral-xyz/borsh';

/**
 * Custom Borsh layout helpers for handling non-standard encodings
 */

/**
 * Create an option layout with a u32 prefix instead of the default u8.
 * Used by SPL Token and other programs that use 4-byte option discriminators.
 *
 * @param layout - The inner layout callable (e.g., publicKey, u64)
 * @param property - The property name for this field
 * @returns A Layout that reads a u32 prefix, then the inner value if non-zero
 */
export function optionU32<T>(layout: (property?: string) => Layout<T> | Layout<T>, property?: string): Layout<T | null> {
    const prefixLayout = u32();
    // Handle both callables and Layout instances
    const innerLayout = typeof layout === 'function' ? layout() : layout;

    // Create a custom layout that handles u32-prefixed options
    return new OptionLayout<T>(innerLayout, prefixLayout, property);
}

/**
 * Custom Layout class for handling options with different prefix types
 */
class OptionLayout<T> extends Layout<T | null> {
    private discriminator: Layout<number>;
    private layout: Layout<T>;

    constructor(layout: Layout<T>, discriminator: Layout<number>, property?: string) {
        super(-1, property);
        this.discriminator = discriminator;
        this.layout = layout;
    }

    encode(value: T | null, buffer: Buffer, offset: number = 0): number {
        if (value === null || value === undefined) {
            // Write 0 for None
            return this.discriminator.encode(0, buffer, offset);
        }
        // Write non-zero for Some (typically 1)
        const discriminatorBytes = this.discriminator.encode(1, buffer, offset);
        const valueBytes = this.layout.encode(value, buffer, offset + discriminatorBytes);
        return discriminatorBytes + valueBytes;
    }

    decode(buffer: Buffer, offset: number = 0): T | null {
        const discriminator = this.discriminator.decode(buffer, offset);
        if (discriminator === 0) {
            return null;
        }
        return this.layout.decode(buffer, offset + this.discriminator.span);
    }

    getSpan(buffer: Buffer, offset: number = 0): number {
        const discriminator = this.discriminator.decode(buffer, offset);
        if (discriminator === 0) {
            return this.discriminator.span;
        }
        return this.discriminator.span + this.layout.getSpan(buffer, offset + this.discriminator.span);
    }
}`;
}
