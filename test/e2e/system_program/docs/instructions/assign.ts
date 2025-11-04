import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, struct } from '@coral-xyz/borsh';

export interface AssignInstructionAccounts {
    account: PublicKey;
}

export interface AssignInstructionArgs {
    programAddress: PublicKey;
}

const AssignInstructionDataSchema = struct([publicKey("programAddress")]);

export function createAssignInstruction(accounts: AssignInstructionAccounts, args: AssignInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: true, isWritable: true },
    ];
    const buffer = Buffer.alloc(1000);
    AssignInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, AssignInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }