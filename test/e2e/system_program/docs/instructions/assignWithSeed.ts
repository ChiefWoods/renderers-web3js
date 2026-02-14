import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import { publicKey, str, struct } from '@coral-xyz/borsh';

export interface AssignWithSeedInstructionAccounts {
    account: PublicKey;
    baseAccount: PublicKey;
}

export interface AssignWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    programAddress: PublicKey;
}

const AssignWithSeedInstructionDataSchema = struct([publicKey("base"), str("seed"), publicKey("programAddress")]);

export function createAssignWithSeedInstruction(accounts: AssignWithSeedInstructionAccounts, args: AssignWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
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
    AssignWithSeedInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, AssignWithSeedInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(10), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }