import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface ThawAccountInstructionAccounts {
    account: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
}



const ThawAccountInstructionDataSchema = struct([['discriminator', u8()]]);

export function createThawAccountInstruction(accounts: ThawAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
        { pubkey: accounts.owner, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(ThawAccountInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}