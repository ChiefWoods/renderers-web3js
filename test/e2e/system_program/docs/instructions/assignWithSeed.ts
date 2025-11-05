import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, str, struct } from '@coral-xyz/borsh';

export interface AssignWithSeedInstructionAccounts {
    account: PublicKey;
    baseAccount: PublicKey;
}

export interface AssignWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    programAddress: PublicKey;
}

const AssignWithSeedInstructionDataSchema = struct([publicKey("base"), str("seed"), publicKey("programAddress")]);

export function createAssignWithSeedInstruction(accounts: AssignWithSeedInstructionAccounts, args: AssignWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
    ];
    const buffer = Buffer.alloc(1000);
    AssignWithSeedInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, AssignWithSeedInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }