import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
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
    const buffer = Buffer.alloc(1000);
    InitializeNonceAccountInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, InitializeNonceAccountInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }