import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, str, struct, u32, u64 } from '@coral-xyz/borsh';

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

const AllocateWithSeedInstructionDataSchema = struct([['discriminator', u32()], ['base', publicKey()], ['seed', str()], ['space', u64()], ['programAddress', publicKey()]]);

export function createAllocateWithSeedInstruction(accounts: AllocateWithSeedInstructionAccounts, args: AllocateWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.newAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
    ];
    const data = Buffer.from(serialize(AllocateWithSeedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}