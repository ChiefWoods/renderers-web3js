import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';

export interface UpgradeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
}





export function createUpgradeNonceAccountInstruction(accounts: UpgradeNonceAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
    ];
    const data = Buffer.alloc(4);
    data.writeUInt32LE(Number(12), 0);
    
    return new TransactionInstruction({ keys, programId, data });
    }