import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { option, publicKey, serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeMintInstructionAccounts {
    mint: PublicKey;
    rent: PublicKey;
}

export interface InitializeMintInstructionArgs {
    decimals: number;
    mintAuthority: PublicKey;
    freezeAuthority: PublicKey | null;
}

const InitializeMintInstructionDataSchema = struct([['discriminator', u8()], ['decimals', u8()], ['mintAuthority', publicKey()], ['freezeAuthority', option(publicKey())]]);

export function createInitializeMintInstruction(accounts: InitializeMintInstructionAccounts, args: InitializeMintInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: true },
        { pubkey: accounts.rent, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(InitializeMintInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}