import { Connection, PublicKey } from '@solana/web3.js';
import { fetchStorageAccount } from '../e2e/system/docs/index';
import { fetchMintAccount } from '../e2e/token/docs';

import { test } from 'vitest';

// test('It should fetch a storage account', async () => {
//     const connection = new Connection('https://api.devnet.solana.com');
//     const address = new PublicKey('HaWabeCLmAmZ2YVDJNqjLadTmYQmuSkqioPcsBKnqg5n');
//     const res = await fetchStorageAccount(connection, address);
//     console.log('Account data', res);
// });

test('It should fetch a mint account', async () => {
    const connection = new Connection('https://api.devnet.solana.com');
    const address = new PublicKey('6MaeSTm1zoVAUCxjPmvqc3nxyVu4iPpMZqyydwwR7J7A');
    const res = await fetchMintAccount(connection, address);
    console.log('Account data', res);
});
