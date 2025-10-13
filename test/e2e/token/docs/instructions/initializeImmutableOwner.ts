import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeImmutableOwnerInstructionAccounts {
    account: PublicKey;
}



const InitializeImmutableOwnerInstructionDataSchema = struct([['discriminator', u8()]]);

export function createInitializeImmutableOwnerInstruction(accounts: InitializeImmutableOwnerInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(InitializeImmutableOwnerInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}