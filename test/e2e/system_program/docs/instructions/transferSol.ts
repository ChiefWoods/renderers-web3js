import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
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
    const mapBigIntToBn = (value: unknown): unknown => {
        if (typeof value === 'bigint') return new BN(value.toString());
        if (Array.isArray(value)) return value.map(mapBigIntToBn);
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, mapBigIntToBn(nested)])
            );
        }
        return value;
    };
    const borshArgs = mapBigIntToBn(args);
    const buffer = Buffer.alloc(1000);
    TransferSolInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, TransferSolInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(2), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }