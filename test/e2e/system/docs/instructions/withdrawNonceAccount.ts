import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u32, u64 } from '@coral-xyz/borsh';

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

const WithdrawNonceAccountInstructionDataSchema = struct([['discriminator', u32()], ['withdrawAmount', u64()]]);

export function createWithdrawNonceAccountInstruction(accounts: WithdrawNonceAccountInstructionAccounts, args: WithdrawNonceAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recipientAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recentBlockhashesSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.rentSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.nonceAuthority, isSigner: true, isWritable: false },
    ];
    const data = Buffer.from(serialize(WithdrawNonceAccountInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}