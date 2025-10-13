import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface ApproveCheckedInstructionAccounts {
    source: PublicKey;
    mint: PublicKey;
    delegate: PublicKey;
    owner: PublicKey;
}

export interface ApproveCheckedInstructionArgs {
    amount: bigint;
    decimals: number;
}

const ApproveCheckedInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()], ['decimals', u8()]]);

export function createApproveCheckedInstruction(accounts: ApproveCheckedInstructionAccounts, args: ApproveCheckedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
        { pubkey: accounts.delegate, isSigner: false, isWritable: false },
        { pubkey: accounts.owner, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(ApproveCheckedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}