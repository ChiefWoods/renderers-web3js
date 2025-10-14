import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { bytes, serialize, str, struct } from '@coral-xyz/borsh';

export interface UpdateInstructionAccounts {
    authority: PublicKey;
    storageAccount: PublicKey;
}

export interface UpdateInstructionArgs {
    text: string;
}

const UpdateInstructionDataSchema = struct([['discriminator', bytes()], ['text', str()]]);

export function createUpdateInstruction(accounts: UpdateInstructionAccounts, args: UpdateInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: accounts.storageAccount, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(UpdateInstructionDataSchema, { discriminator: Buffer.from('dbc858b09e3ffd7f', 'hex'), ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}