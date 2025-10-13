import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface ApproveInstructionAccounts {
    source: PublicKey;
    delegate: PublicKey;
    owner: PublicKey;
}

export interface ApproveInstructionArgs {
    amount: bigint;
}

const ApproveInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()]]);

export function createApproveInstruction(accounts: ApproveInstructionAccounts, args: ApproveInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.delegate, isSigner: false, isWritable: false },
        { pubkey: accounts.owner, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(ApproveInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}