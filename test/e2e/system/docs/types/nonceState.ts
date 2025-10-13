import { u8 } from '@coral-xyz/borsh';

export enum NonceState { Uninitialized, Initialized }

export const nonceStateSchema = u8();