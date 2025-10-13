import { AccountState, AccountStateSchema } from '../types';
import { Connection, PublicKey } from '@solana/web3.js';
import { deserialize, option, publicKey, struct, u64 } from '@coral-xyz/borsh';

export interface TokenAccountData {
    mint: PublicKey;
    owner: PublicKey;
    amount: bigint;
    delegate: PublicKey | null;
    state: AccountState;
    isNative: bigint | null;
    delegatedAmount: bigint;
    closeAuthority: PublicKey | null;
}

export interface TokenAccount {
    address: PublicKey;
    data: TokenAccountData;
}

const TokenAccountDataSchema = struct([['mint', publicKey()], ['owner', publicKey()], ['amount', u64()], ['delegate', option(publicKey())], ['state', AccountStateSchema], ['isNative', option(u64())], ['delegatedAmount', u64()], ['closeAuthority', option(publicKey())]]);

export function deserializeTokenAccount(data: Buffer): TokenAccountData {
    return deserialize(TokenAccountDataSchema, data);
}

export async function fetchTokenAccount(
    connection: Connection,
    address: PublicKey
): Promise<TokenAccount> {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
        throw new Error('Token account not found at address: ' + address.toBase58());
    }
    return {
        address,
        data: deserializeTokenAccount(accountInfo.data),
    };
}