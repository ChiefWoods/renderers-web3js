import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeAccount3InstructionAccounts {
    account: PublicKey;
    mint: PublicKey;
}

export interface InitializeAccount3InstructionArgs {
    owner: PublicKey;
}

const InitializeAccount3InstructionDataSchema = struct([['discriminator', u8()], ['owner', publicKey()]]);

export function createInitializeAccount3Instruction(accounts: InitializeAccount3InstructionAccounts, args: InitializeAccount3InstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(InitializeAccount3InstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}