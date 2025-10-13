import { u8 } from '@coral-xyz/borsh';

export enum AuthorityType { MintTokens, FreezeAccount, AccountOwner, CloseAccount }

export const authorityTypeSchema = u8();