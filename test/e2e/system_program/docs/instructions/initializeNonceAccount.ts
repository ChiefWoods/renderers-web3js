import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import { publicKey, struct } from '@coral-xyz/borsh';

export interface InitializeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    recentBlockhashesSysvar: PublicKey;
    rentSysvar: PublicKey;
}

export interface InitializeNonceAccountInstructionArgs {
    nonceAuthority: PublicKey;
}

const InitializeNonceAccountInstructionDataSchema = struct([publicKey("nonceAuthority")]);

export function createInitializeNonceAccountInstruction(accounts: InitializeNonceAccountInstructionAccounts, args: InitializeNonceAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recentBlockhashesSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.rentSysvar, isSigner: false, isWritable: false },
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
    InitializeNonceAccountInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, InitializeNonceAccountInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(6), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }