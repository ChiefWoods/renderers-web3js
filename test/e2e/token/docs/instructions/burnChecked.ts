import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface BurnCheckedInstructionAccounts {
    account: PublicKey;
    mint: PublicKey;
    authority: PublicKey;
}

export interface BurnCheckedInstructionArgs {
    amount: bigint;
    decimals: number;
}

const BurnCheckedInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()], ['decimals', u8()]]);

export function createBurnCheckedInstruction(accounts: BurnCheckedInstructionAccounts, args: BurnCheckedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(BurnCheckedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}