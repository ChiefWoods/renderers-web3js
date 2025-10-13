import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AuthorityType, AuthorityTypeSchema } from '../types';
import { option, publicKey, serialize, struct, u8 } from '@coral-xyz/borsh';

export interface SetAuthorityInstructionAccounts {
    owned: PublicKey;
    owner: PublicKey;
}

export interface SetAuthorityInstructionArgs {
    authorityType: AuthorityType;
    newAuthority: PublicKey | null;
}

const SetAuthorityInstructionDataSchema = struct([['discriminator', u8()], ['authorityType', AuthorityTypeSchema], ['newAuthority', option(publicKey())]]);

export function createSetAuthorityInstruction(accounts: SetAuthorityInstructionAccounts, args: SetAuthorityInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.owned, isSigner: false, isWritable: true },
        { pubkey: accounts.owner, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(SetAuthorityInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}