import { Connection, PublicKey } from '@solana/web3.js';
import { NonceState, NonceVersion, nonceStateSchema, nonceVersionSchema } from '../types';
import { publicKey, struct, u64 } from '@coral-xyz/borsh';

export interface NonceAccountData {
    version: NonceVersion;
    state: NonceState;
    authority: PublicKey;
    blockhash: PublicKey;
    lamportsPerSignature: bigint;
}

export interface NonceAccount {
    address: PublicKey;
    data: NonceAccountData;
}

const NonceAccountDataSchema = struct([nonceVersionSchema, nonceStateSchema, publicKey("authority"), publicKey("blockhash"), u64("lamportsPerSignature")]);

export function deserializeNonceAccount(data: Buffer): NonceAccountData {
    return NonceAccountDataSchema.decode(data);
}

export async function fetchNonceAccount(
    connection: Connection,
    address: PublicKey
): Promise<NonceAccount> {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
        throw new Error('Nonce account not found at address: ' + address.toBase58());
    }
    return {
        address,
        data: deserializeNonceAccount(accountInfo.data),
    };
}