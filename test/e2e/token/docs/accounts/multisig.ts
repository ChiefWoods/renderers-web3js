import { Connection, PublicKey } from '@solana/web3.js';
import { array, bool, deserialize, publicKey, struct, u8 } from '@coral-xyz/borsh';

export interface MultisigAccountData { m: number; n: number; isInitialized: boolean; signers: Array<PublicKey> }

export interface MultisigAccount {
    address: PublicKey;
    data: MultisigAccountData;
}

const MultisigAccountDataSchema = struct([['m', u8()], ['n', u8()], ['isInitialized', bool()], ['signers', array(publicKey(), 11)]]);

export function deserializeMultisigAccount(data: Buffer): MultisigAccountData {
    return deserialize(MultisigAccountDataSchema, data);
}

export async function fetchMultisigAccount(
    connection: Connection,
    address: PublicKey
): Promise<MultisigAccount> {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
        throw new Error('Multisig account not found at address: ' + address.toBase58());
    }
    return {
        address,
        data: deserializeMultisigAccount(accountInfo.data),
    };
}