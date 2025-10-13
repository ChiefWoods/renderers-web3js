import { Connection, PublicKey } from '@solana/web3.js';
import { bool, deserialize, option, publicKey, struct, u64, u8 } from '@coral-xyz/borsh';

export interface MintAccountData {
    mintAuthority: PublicKey | null;
    supply: bigint;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: PublicKey | null;
}

export interface MintAccount {
    address: PublicKey;
    data: MintAccountData;
}

const MintAccountDataSchema = struct([['mintAuthority', option(publicKey())], ['supply', u64()], ['decimals', u8()], ['isInitialized', bool()], ['freezeAuthority', option(publicKey())]]);

export function deserializeMintAccount(data: Buffer): MintAccountData {
    return deserialize(MintAccountDataSchema, data);
}

export async function fetchMintAccount(
    connection: Connection,
    address: PublicKey
): Promise<MintAccount> {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
        throw new Error('Mint account not found at address: ' + address.toBase58());
    }
    return {
        address,
        data: deserializeMintAccount(accountInfo.data),
    };
}