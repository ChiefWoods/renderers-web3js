import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeMultisig2InstructionAccounts {
    multisig: PublicKey;
}

export interface InitializeMultisig2InstructionArgs {
    m: number;
}

const InitializeMultisig2InstructionDataSchema = struct([['discriminator', u8()], ['m', u8()]]);

export function createInitializeMultisig2Instruction(accounts: InitializeMultisig2InstructionAccounts, args: InitializeMultisig2InstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.multisig, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(InitializeMultisig2InstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}