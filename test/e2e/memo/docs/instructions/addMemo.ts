import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { str, struct } from '@coral-xyz/borsh';

export interface AddMemoInstructionArgs {
    memo: string;
}

const AddMemoInstructionDataSchema = struct([str("memo")]);

export function createAddMemoInstruction(args: AddMemoInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [];
    const buffer = Buffer.alloc(1000);
    AddMemoInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, AddMemoInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }