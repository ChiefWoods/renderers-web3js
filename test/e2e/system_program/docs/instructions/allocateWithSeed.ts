import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, str, struct, u64 } from '@coral-xyz/borsh';

export interface AllocateWithSeedInstructionAccounts {
    newAccount: PublicKey;
    baseAccount: PublicKey;
}

export interface AllocateWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    space: bigint;
    programAddress: PublicKey;
}

const AllocateWithSeedInstructionDataSchema = struct([publicKey("base"), str("seed"), u64("space"), publicKey("programAddress")]);

export function createAllocateWithSeedInstruction(accounts: AllocateWithSeedInstructionAccounts, args: AllocateWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.newAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
    ];
    const buffer = Buffer.alloc(1000);
    AllocateWithSeedInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, AllocateWithSeedInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }