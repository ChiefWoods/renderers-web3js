import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u8 } from '@coral-xyz/borsh';

export interface CloseAccountInstructionAccounts {
    account: PublicKey;
    destination: PublicKey;
    owner: PublicKey;
}



const CloseAccountInstructionDataSchema = struct([['discriminator', u8()]]);

export function createCloseAccountInstruction(accounts: CloseAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: false, isWritable: true },
        { pubkey: accounts.destination, isSigner: false, isWritable: true },
        { pubkey: accounts.owner, isSigner: either, isWritable: false },
    ];
    const data = Buffer.from(serialize(CloseAccountInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}