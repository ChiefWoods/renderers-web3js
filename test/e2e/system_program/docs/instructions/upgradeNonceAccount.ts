import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { struct } from '@coral-xyz/borsh';

export interface UpgradeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
}



const UpgradeNonceAccountInstructionDataSchema = struct([]);

export function createUpgradeNonceAccountInstruction(accounts: UpgradeNonceAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
    ];
    const data = Buffer.alloc(0);
    
    return new TransactionInstruction({ keys, programId, data });
    }