import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface InitializeMultisigInstructionAccounts {
    multisig: PublicKey;
    rent: PublicKey;
}

export interface InitializeMultisigInstructionArgs {
    m: number;
}

const InitializeMultisigInstructionDataSchema = struct([['discriminator', u8()], ['m', u8()]]);

export function createInitializeMultisigInstruction(accounts: InitializeMultisigInstructionAccounts, args: InitializeMultisigInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.multisig, isSigner: false, isWritable: true },
        { pubkey: accounts.rent, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(InitializeMultisigInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}