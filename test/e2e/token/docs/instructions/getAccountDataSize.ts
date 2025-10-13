import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface GetAccountDataSizeInstructionAccounts {
    mint: PublicKey;
}



const GetAccountDataSizeInstructionDataSchema = struct([['discriminator', u8()]]);

export function createGetAccountDataSizeInstruction(accounts: GetAccountDataSizeInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(GetAccountDataSizeInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}