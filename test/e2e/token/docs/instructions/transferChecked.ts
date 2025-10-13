import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface TransferCheckedInstructionAccounts {
    source: PublicKey;
    mint: PublicKey;
    destination: PublicKey;
    authority: PublicKey;
}

export interface TransferCheckedInstructionArgs {
    amount: bigint;
    decimals: number;
}

const TransferCheckedInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()], ['decimals', u8()]]);

export function createTransferCheckedInstruction(accounts: TransferCheckedInstructionAccounts, args: TransferCheckedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(TransferCheckedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}