import { Connection, PublicKey } from '@solana/web3.js';
import { bytes, deserialize, publicKey, str, struct } from '@coral-xyz/borsh';

export interface StorageAccountData { authority: PublicKey; text: string; uuid: string }

export interface StorageAccount {
    address: PublicKey;
    data: StorageAccountData;
}

const StorageAccountDataSchema = struct([['discriminator', bytes()], ['authority', publicKey()], ['text', str()], ['uuid', str()]]);

export function deserializeStorageAccount(data: Buffer): StorageAccountData {
    const deserialized = deserialize(StorageAccountDataSchema, data);
    const { discriminator: _, ...accountData } = deserialized;
    return accountData as StorageAccountData;
}

export async function fetchStorageAccount(
    connection: Connection,
    address: PublicKey
): Promise<StorageAccount> {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
        throw new Error('Storage account not found at address: ' + address.toBase58());
    }
    return {
        address,
        data: deserializeStorageAccount(accountInfo.data),
    };
}