import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { struct, u64 } from '@coral-xyz/borsh';

export interface TransferSolInstructionAccounts {
    source: PublicKey;
    destination: PublicKey;
}

export interface TransferSolInstructionArgs {
    amount: bigint;
}

const TransferSolInstructionDataSchema = struct([u64("amount")]);

export function createTransferSolInstruction(accounts: TransferSolInstructionAccounts, args: TransferSolInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: true, isWritable: true },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
    ];
    const buffer = Buffer.alloc(1000);
    TransferSolInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, TransferSolInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }