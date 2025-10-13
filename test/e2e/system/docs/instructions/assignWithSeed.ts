import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, str, struct, u32 } from '@coral-xyz/borsh';

export interface AssignWithSeedInstructionAccounts {
    account: PublicKey;
    baseAccount: PublicKey;
}

export interface AssignWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    programAddress: PublicKey;
}

const AssignWithSeedInstructionDataSchema = struct([['discriminator', u32()], ['base', publicKey()], ['seed', str()], ['programAddress', publicKey()]]);

export function createAssignWithSeedInstruction(accounts: AssignWithSeedInstructionAccounts, args: AssignWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
    ];
    const data = Buffer.from(serialize(AssignWithSeedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}