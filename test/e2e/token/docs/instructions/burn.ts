import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface BurnInstructionAccounts {
    account: PublicKey;
    mint: PublicKey;
    authority: PublicKey;
}

export interface BurnInstructionArgs {
    amount: bigint;
}

const BurnInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()]]);

export function createBurnInstruction(accounts: BurnInstructionAccounts, args: BurnInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(BurnInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}