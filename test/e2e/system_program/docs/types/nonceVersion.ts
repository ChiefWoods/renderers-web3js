import { u8 } from '@coral-xyz/borsh';

export enum NonceVersion { Legacy, Current }

export const nonceVersionSchema = u8();