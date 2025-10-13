import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface RevokeInstructionAccounts {
    source: PublicKey;
    owner: PublicKey;
}



const RevokeInstructionDataSchema = struct([['discriminator', u8()]]);

export function createRevokeInstruction(accounts: RevokeInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.owner, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(RevokeInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}