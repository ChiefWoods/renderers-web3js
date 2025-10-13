import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u64, u8 } from '@coral-xyz/borsh';

export interface AmountToUiAmountInstructionAccounts {
    mint: PublicKey;
}

export interface AmountToUiAmountInstructionArgs {
    amount: bigint;
}

const AmountToUiAmountInstructionDataSchema = struct([['discriminator', u8()], ['amount', u64()]]);

export function createAmountToUiAmountInstruction(accounts: AmountToUiAmountInstructionAccounts, args: AmountToUiAmountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.mint, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(AmountToUiAmountInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}