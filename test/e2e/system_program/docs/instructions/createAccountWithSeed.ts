import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import { publicKey, str, struct, u64 } from '@coral-xyz/borsh';

export interface CreateAccountWithSeedInstructionAccounts {
    payer: PublicKey;
    newAccount: PublicKey;
    baseAccount: PublicKey;
}

export interface CreateAccountWithSeedInstructionArgs {
    base: PublicKey;
    seed: string;
    amount: bigint;
    space: bigint;
    programAddress: PublicKey;
}

const CreateAccountWithSeedInstructionDataSchema = struct([publicKey("base"), str("seed"), u64("amount"), u64("space"), publicKey("programAddress")]);

export function createCreateAccountWithSeedInstruction(accounts: CreateAccountWithSeedInstructionAccounts, args: CreateAccountWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.payer, isSigner: true, isWritable: true },
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
    CreateAccountWithSeedInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, CreateAccountWithSeedInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(3), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }