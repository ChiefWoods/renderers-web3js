import { Connection, PublicKey } from '@solana/web3.js';
import { fetchStorageAccount } from '../e2e/system/docs/index';
import { test } from 'vitest';

test('It should fetch a storage account', async () => {
    const connection = new Connection('https://api.devnet.solana.com');
    const address = new PublicKey('HaWabeCLmAmZ2YVDJNqjLadTmYQmuSkqioPcsBKnqg5n');
    const res = await fetchStorageAccount(connection, address);
    console.log('Account data', res);
});
