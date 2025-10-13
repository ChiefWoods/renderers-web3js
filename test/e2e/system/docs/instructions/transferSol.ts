import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u32, u64 } from '@coral-xyz/borsh';

export interface TransferSolInstructionAccounts {
    source: PublicKey;
    destination: PublicKey;
}

export interface TransferSolInstructionArgs {
    amount: bigint;
}

const TransferSolInstructionDataSchema = struct([['discriminator', u32()], ['amount', u64()]]);

export function createTransferSolInstruction(accounts: TransferSolInstructionAccounts, args: TransferSolInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: true, isWritable: true },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(TransferSolInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}