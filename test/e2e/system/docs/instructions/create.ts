import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { u8, serialize, str, struct } from '@coral-xyz/borsh';

export interface CreateInstructionAccounts {
    authority: PublicKey;
    storageAccount: PublicKey;
    systemProgram: PublicKey;
}

export interface CreateInstructionArgs {
    text: string;
    uuid: string;
}

const CreateInstructionDataSchema = struct([['discriminator', u8()], ['text', str()], ['uuid', str()]]);

export function createCreateInstruction(accounts: CreateInstructionAccounts, args: CreateInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: accounts.storageAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    ];
    const data = Buffer.from(serialize(CreateInstructionDataSchema, { discriminator: Buffer.from('181ec828051c0777', 'hex'), ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}