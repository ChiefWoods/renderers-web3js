import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';

export interface AddMemoInstructionArgs {
    memo: string;
}



export function createAddMemoInstruction(args: AddMemoInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [];
    const data = Buffer.from(args.memo, 'utf8');
    
    return new TransactionInstruction({ keys, programId, data });
    }