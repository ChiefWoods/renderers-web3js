import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface MintToInstructionAccounts {
    mint: PublicKey;
    token: PublicKey;
    mintAuthority: PublicKey;
}

export interface MintToInstructionArgs {
    amount: bigint;
}

const MintToInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()]]);

export function createMintToInstruction(accounts: MintToInstructionAccounts, args: MintToInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: true },
        { pubkey: accounts.token, isSigner: false, isWritable: true },
        { pubkey: accounts.mintAuthority, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(MintToInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}