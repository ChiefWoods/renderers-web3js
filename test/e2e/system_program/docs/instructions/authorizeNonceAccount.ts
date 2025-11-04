import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, struct } from '@coral-xyz/borsh';

export interface AuthorizeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    nonceAuthority: PublicKey;
}

export interface AuthorizeNonceAccountInstructionArgs {
    newNonceAuthority: PublicKey;
}

const AuthorizeNonceAccountInstructionDataSchema = struct([publicKey("newNonceAuthority")]);

export function createAuthorizeNonceAccountInstruction(accounts: AuthorizeNonceAccountInstructionAccounts, args: AuthorizeNonceAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.nonceAuthority, isSigner: true, isWritable: false },
    ];
    const buffer = Buffer.alloc(1000);
    AuthorizeNonceAccountInstructionDataSchema.encode(args, buffer);
    const data = buffer.subarray(0, AuthorizeNonceAccountInstructionDataSchema.getSpan(buffer));
    
    return new TransactionInstruction({ keys, programId, data });
    }