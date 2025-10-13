import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, struct, u32 } from '@coral-xyz/borsh';

export interface AuthorizeNonceAccountInstructionAccounts {
    nonceAccount: PublicKey;
    nonceAuthority: PublicKey;
}

export interface AuthorizeNonceAccountInstructionArgs {
    newNonceAuthority: PublicKey;
}

const AuthorizeNonceAccountInstructionDataSchema = struct([['discriminator', u32()], ['newNonceAuthority', publicKey()]]);

export function createAuthorizeNonceAccountInstruction(accounts: AuthorizeNonceAccountInstructionAccounts, args: AuthorizeNonceAccountInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.nonceAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.nonceAuthority, isSigner: true, isWritable: false },
    ];
    const data = Buffer.from(serialize(AuthorizeNonceAccountInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}