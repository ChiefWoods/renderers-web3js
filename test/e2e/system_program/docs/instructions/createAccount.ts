import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import { publicKey, struct, u64 } from '@coral-xyz/borsh';

export interface CreateAccountInstructionAccounts {
    payer: PublicKey;
    newAccount: PublicKey;
}

export interface CreateAccountInstructionArgs {
    lamports: bigint;
    space: bigint;
    programAddress: PublicKey;
}

const CreateAccountInstructionDataSchema = struct([u64("lamports"), u64("space"), publicKey("programAddress")]);

export function createCreateAccountInstruction(accounts: CreateAccountInstructionAccounts, args: CreateAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.payer, isSigner: true, isWritable: true },
        { pubkey: accounts.newAccount, isSigner: true, isWritable: true },
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
    CreateAccountInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, CreateAccountInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(0), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }