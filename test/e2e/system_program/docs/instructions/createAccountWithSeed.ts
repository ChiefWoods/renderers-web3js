import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, str, struct, u64 } from '@coral-xyz/borsh';

export interface CreateAccountWithSeedInstructionAccounts {
    payer: PublicKey;
    newAccount: PublicKey;
    baseAccount: PublicKey;
}

export interface CreateAccountWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    amount: bigint;
    space: bigint;
    programAddress: PublicKey;
}

const CreateAccountWithSeedInstructionDataSchema = struct([publicKey("base"), str("seed"), u64("amount"), u64("space"), publicKey("programAddress")]);

export function createCreateAccountWithSeedInstruction(accounts: CreateAccountWithSeedInstructionAccounts, args: CreateAccountWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.payer, isSigner: true, isWritable: true },
        { pubkey: accounts.newAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
    ];
    const buffer = Buffer.alloc(1000);
    CreateAccountWithSeedInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, CreateAccountWithSeedInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }