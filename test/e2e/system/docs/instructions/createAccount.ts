import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, struct, u32, u64 } from '@coral-xyz/borsh';

export interface CreateAccountInstructionAccounts {
    payer: PublicKey;
    newAccount: PublicKey;
}

export interface CreateAccountInstructionArgs {
    lamports: bigint;
    space: bigint;
    programAddress: PublicKey;
}

const CreateAccountInstructionDataSchema = struct([['discriminator', u32()], ['lamports', u64()], ['space', u64()], ['programAddress', publicKey()]]);

export function createCreateAccountInstruction(accounts: CreateAccountInstructionAccounts, args: CreateAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.payer, isSigner: true, isWritable: true },
        { pubkey: accounts.newAccount, isSigner: true, isWritable: true },
    ];
    const data = Buffer.from(serialize(CreateAccountInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}