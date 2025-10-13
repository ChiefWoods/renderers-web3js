import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface TransferInstructionAccounts {
    source: PublicKey;
    destination: PublicKey;
    authority: PublicKey;
}

export interface TransferInstructionArgs {
    amount: bigint;
}

const TransferInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()]]);

export function createTransferInstruction(accounts: TransferInstructionAccounts, args: TransferInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(TransferInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}