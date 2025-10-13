import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface SyncNativeInstructionAccounts {
    account: PublicKey;
}



const SyncNativeInstructionDataSchema = struct([['discriminator', u8()]]);

export function createSyncNativeInstruction(accounts: SyncNativeInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(SyncNativeInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}