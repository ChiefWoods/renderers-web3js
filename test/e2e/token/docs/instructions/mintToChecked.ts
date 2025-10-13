import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface MintToCheckedInstructionAccounts {
    mint: PublicKey;
    token: PublicKey;
    mintAuthority: PublicKey;
}

export interface MintToCheckedInstructionArgs {
    amount: bigint;
    decimals: number;
}

const MintToCheckedInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()], ['decimals', u8()]]);

export function createMintToCheckedInstruction(accounts: MintToCheckedInstructionAccounts, args: MintToCheckedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: true },
        { pubkey: accounts.token, isSigner: false, isWritable: true },
        { pubkey: accounts.mintAuthority, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(MintToCheckedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}