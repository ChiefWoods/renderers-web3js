import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, struct, u64 } from '@coral-xyz/borsh';

export interface CreateAccountInstructionAccounts {
    payer: PublicKey;
    newAccount: PublicKey;
}

export interface CreateAccountInstructionArgs {
    lamports: bigint;
    space: bigint;
    programAddress: PublicKey;
}

const CreateAccountInstructionDataSchema = struct([u64("lamports"), u64("space"), publicKey("programAddress")]);

export function createCreateAccountInstruction(accounts: CreateAccountInstructionAccounts, args: CreateAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.payer, isSigner: true, isWritable: true },
        { pubkey: accounts.newAccount, isSigner: true, isWritable: true },
    ];
    const buffer = Buffer.alloc(1000);
    CreateAccountInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, CreateAccountInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }