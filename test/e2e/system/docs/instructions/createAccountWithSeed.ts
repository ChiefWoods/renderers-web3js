import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, str, struct, u32, u64 } from '@coral-xyz/borsh';

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

const CreateAccountWithSeedInstructionDataSchema = struct([['discriminator', u32()], ['base', publicKey()], ['seed', str()], ['amount', u64()], ['space', u64()], ['programAddress', publicKey()]]);

export function createCreateAccountWithSeedInstruction(accounts: CreateAccountWithSeedInstructionAccounts, args: CreateAccountWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.payer, isSigner: true, isWritable: true },
        { pubkey: accounts.newAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
    ];
    const data = Buffer.from(serialize(CreateAccountWithSeedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}