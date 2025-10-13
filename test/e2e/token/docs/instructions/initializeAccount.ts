import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeAccountInstructionAccounts {
    account: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    rent: PublicKey;
}



const InitializeAccountInstructionDataSchema = struct([['discriminator', u8()]]);

export function createInitializeAccountInstruction(accounts: InitializeAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
        { pubkey: accounts.owner, isSigner: false, isWritable: false },
        { pubkey: accounts.rent, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(InitializeAccountInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}