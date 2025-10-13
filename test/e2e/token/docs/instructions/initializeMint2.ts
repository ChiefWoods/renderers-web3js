import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { option, publicKey, serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeMint2InstructionAccounts {
    mint: PublicKey;
}

export interface InitializeMint2InstructionArgs {
    decimals: number;
    mintAuthority: PublicKey;
    freezeAuthority: PublicKey | null;
}

const InitializeMint2InstructionDataSchema = struct([['discriminator', u8()], ['decimals', u8()], ['mintAuthority', publicKey()], ['freezeAuthority', option(publicKey())]]);

export function createInitializeMint2Instruction(accounts: InitializeMint2InstructionAccounts, args: InitializeMint2InstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(InitializeMint2InstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}