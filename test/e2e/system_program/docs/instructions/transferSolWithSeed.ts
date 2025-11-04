import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, str, struct, u64 } from '@coral-xyz/borsh';

export interface TransferSolWithSeedInstructionAccounts {
    source: PublicKey;
    baseAccount: PublicKey;
    destination: PublicKey;
}

export interface TransferSolWithSeedInstructionArgs {
    amount: bigint;
    fromSeed: string;
    fromOwner: PublicKey;
}

const TransferSolWithSeedInstructionDataSchema = struct([u64("amount"), str("fromSeed"), publicKey("fromOwner")]);

export function createTransferSolWithSeedInstruction(accounts: TransferSolWithSeedInstructionAccounts, args: TransferSolWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
    ];
    const buffer = Buffer.alloc(1000);
    TransferSolWithSeedInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, TransferSolWithSeedInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }