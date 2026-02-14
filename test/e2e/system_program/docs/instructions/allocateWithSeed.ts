import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import { publicKey, str, struct, u64 } from '@coral-xyz/borsh';

export interface AllocateWithSeedInstructionAccounts {
    newAccount: PublicKey;
    baseAccount: PublicKey;
}

export interface AllocateWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    space: bigint;
    programAddress: PublicKey;
}

const AllocateWithSeedInstructionDataSchema = struct([publicKey("base"), str("seed"), u64("space"), publicKey("programAddress")]);

export function createAllocateWithSeedInstruction(accounts: AllocateWithSeedInstructionAccounts, args: AllocateWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.newAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
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
    AllocateWithSeedInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, AllocateWithSeedInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(9), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }