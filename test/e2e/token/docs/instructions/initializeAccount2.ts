import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeAccount2InstructionAccounts {
    account: PublicKey;
    mint: PublicKey;
    rent: PublicKey;
}

export interface InitializeAccount2InstructionArgs {
    owner: PublicKey;
}

const InitializeAccount2InstructionDataSchema = struct([['discriminator', u8()], ['owner', publicKey()]]);

export function createInitializeAccount2Instruction(accounts: InitializeAccount2InstructionAccounts, args: InitializeAccount2InstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
        { pubkey: accounts.rent, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(InitializeAccount2InstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}