import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { bytes, serialize, struct } from '@coral-xyz/borsh';

export interface DeleteInstructionAccounts {
    authority: PublicKey;
    storageAccount: PublicKey;
}



const DeleteInstructionDataSchema = struct([['discriminator', bytes()]]);

export function createDeleteInstruction(accounts: DeleteInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: accounts.storageAccount, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(DeleteInstructionDataSchema, { discriminator: Buffer.from('a5cc3c62860f5386', 'hex') }));
    
    return new TransactionInstruction({ keys, programId, data });
}