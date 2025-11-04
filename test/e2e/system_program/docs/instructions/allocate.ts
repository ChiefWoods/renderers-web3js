import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { struct, u64 } from '@coral-xyz/borsh';

export interface AllocateInstructionAccounts {
    newAccount: PublicKey;
}

export interface AllocateInstructionArgs {
    space: bigint;
}

const AllocateInstructionDataSchema = struct([u64("space")]);

export function createAllocateInstruction(accounts: AllocateInstructionAccounts, args: AllocateInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.newAccount, isSigner: true, isWritable: true },
    ];
    const buffer = Buffer.alloc(1000);
    AllocateInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, AllocateInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }