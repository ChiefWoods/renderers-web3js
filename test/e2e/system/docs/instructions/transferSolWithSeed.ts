import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, str, struct, u32, u64 } from '@coral-xyz/borsh';

export interface TransferSolWithSeedInstructionAccounts {
    source: PublicKey;
    baseAccount: PublicKey;
    destination: PublicKey;
}

export interface TransferSolWithSeedInstructionArgs {
    amount: bigint;
    fromSeed: string;
    fromOwner: PublicKey;
}

const TransferSolWithSeedInstructionDataSchema = struct([['discriminator', u32()], ['amount', u64()], ['fromSeed', str()], ['fromOwner', publicKey()]]);

export function createTransferSolWithSeedInstruction(accounts: TransferSolWithSeedInstructionAccounts, args: TransferSolWithSeedInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.source, isSigner: false, isWritable: true },
        { pubkey: accounts.baseAccount, isSigner: true, isWritable: false },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(TransferSolWithSeedInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}