import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, str, struct, u8 } from '@coral-xyz/borsh';

export interface UiAmountToAmountInstructionAccounts {
    mint: PublicKey;
}

export interface UiAmountToAmountInstructionArgs {
    uiAmount: string;
}

const UiAmountToAmountInstructionDataSchema = struct([['discriminator', u8()], ['uiAmount', str()]]);

export function createUiAmountToAmountInstruction(accounts: UiAmountToAmountInstructionAccounts, args: UiAmountToAmountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(UiAmountToAmountInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}