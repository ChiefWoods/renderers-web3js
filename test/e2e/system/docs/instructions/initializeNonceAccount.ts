import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, struct, u32 } from '@coral-xyz/borsh';

export interface InitializeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    recentBlockhashesSysvar: PublicKey;
    rentSysvar: PublicKey;
}

export interface InitializeNonceAccountInstructionArgs {
    nonceAuthority: PublicKey;
}

const InitializeNonceAccountInstructionDataSchema = struct([['discriminator', u32()], ['nonceAuthority', publicKey()]]);

export function createInitializeNonceAccountInstruction(accounts: InitializeNonceAccountInstructionAccounts, args: InitializeNonceAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recentBlockhashesSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.rentSysvar, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(InitializeNonceAccountInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}