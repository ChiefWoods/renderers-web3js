import { u8 } from '@coral-xyz/borsh';

export enum AccountState { Uninitialized, Initialized, Frozen }

export const accountStateSchema = u8();