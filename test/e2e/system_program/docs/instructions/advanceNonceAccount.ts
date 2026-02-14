import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';

export interface AdvanceNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    recentBlockhashesSysvar: PublicKey;
    nonceAuthority: PublicKey;
}
export function createAdvanceNonceAccountInstruction(accounts: AdvanceNonceAccountInstructionAccounts, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.recentBlockhashesSysvar, isSigner: false, isWritable: false },
        { pubkey: accounts.nonceAuthority, isSigner: true, isWritable: false },
    ];
    const data = Buffer.alloc(4);
    data.writeUInt32LE(Number(4), 0);
    
    return new TransactionInstruction({ keys, programId, data });
    }
