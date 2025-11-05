import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { struct } from '@coral-xyz/borsh';

export interface AdvanceNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    recentBlockhashesSysvar: PublicKey;
    nonceAuthority: PublicKey;
}



const AdvanceNonceAccountInstructionDataSchema = struct([]);

export function createAdvanceNonceAccountInstruction(accounts: AdvanceNonceAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recentBlockhashesSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.nonceAuthority, isSigner: true, isWritable: false },
    ];
    const data = Buffer.alloc(0);
    
    return new TransactionInstruction({ keys, programId, data });
    }