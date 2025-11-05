import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { struct, u64 } from '@coral-xyz/borsh';

export interface WithdrawNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    recipientAccount: PublicKey;
    recentBlockhashesSysvar: PublicKey;
    rentSysvar: PublicKey;
    nonceAuthority: PublicKey;
}

export interface WithdrawNonceAccountInstructionArgs {
    withdrawAmount: bigint;
}

const WithdrawNonceAccountInstructionDataSchema = struct([u64("withdrawAmount")]);

export function createWithdrawNonceAccountInstruction(accounts: WithdrawNonceAccountInstructionAccounts, args: WithdrawNonceAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recipientAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recentBlockhashesSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.rentSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.nonceAuthority, isSigner: true, isWritable: false },
    ];
    const buffer = Buffer.alloc(1000);
    WithdrawNonceAccountInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, WithdrawNonceAccountInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }