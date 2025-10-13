import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u32, u64 } from '@coral-xyz/borsh';

export interface AllocateInstructionAccounts {
    newAccount: PublicKey;
}

export interface AllocateInstructionArgs {
    space: bigint;
}

const AllocateInstructionDataSchema = struct([['discriminator', u32()], ['space', u64()]]);

export function createAllocateInstruction(accounts: AllocateInstructionAccounts, args: AllocateInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.newAccount, isSigner: true, isWritable: true },
    ];
    const data = Buffer.from(serialize(AllocateInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}