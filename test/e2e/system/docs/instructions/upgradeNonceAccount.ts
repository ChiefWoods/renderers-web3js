import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { serialize, struct, u32 } from '@coral-xyz/borsh';

export interface UpgradeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
}



const UpgradeNonceAccountInstructionDataSchema = struct([['discriminator', u32()]]);

export function createUpgradeNonceAccountInstruction(accounts: UpgradeNonceAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
    ];
    const data = Buffer.from(serialize(UpgradeNonceAccountInstructionDataSchema, { discriminator: undefined }));
    
    return new TransactionInstruction({ keys, programId, data });
}