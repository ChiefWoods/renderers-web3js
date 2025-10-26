import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createCreateInstruction, DEMOTEST_PROGRAM_ID, fetchStorageAccount } from '../e2e/system/docs/index';

import { test } from 'vitest';
import fs from 'fs';

// test('It should fetch a storage account', async () => {
//     const connection = new Connection('https://api.devnet.solana.com');
//     const address = new PublicKey('7sY1wM8eSpFmLAjhb1jgzTgx6JxRQ7gSq8d2cc4D6MBw');
//     const res = await fetchStorageAccount(connection, address);
//     console.log('Account data', res);
// });

// test('It should fetch a mint account', async () => {
//     const connection = new Connection('https://api.devnet.solana.com');
//     const address = new PublicKey('7sY1wM8eSpFmLAjhb1jgzTgx6JxRQ7gSq8d2cc4D6MBw');
//     const res = await fetchMintAccount(connection, address);
//     console.log('Account data', res);
// });

test('It should create a storage account', async () => {
    // load wallet from path
    const wallet = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync('/Users/pratik/.config/solana/id.json', 'utf8'))),
    );
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=3fc11e81-5f24-43cc-a621-6b340ce43c07');
    console.log('Wallet', wallet.publicKey.toString());
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('Balance', balance);
    const uuid = '003';

    // Properly serialize uuid as size-prefixed string (u32 length + bytes)
    const uuidBuffer = Buffer.from(uuid, 'utf8');
    const uuidLength = Buffer.alloc(4);
    uuidLength.writeUInt32LE(uuidBuffer.length, 0);
    const uuidSeed = Buffer.concat([uuidLength, uuidBuffer]);

    const seeds = [
        Buffer.from('storage'),
        wallet.publicKey.toBuffer(),
        uuidSeed, // Properly serialized with u32 prefix
    ];
    const [storageAccount] = await PublicKey.findProgramAddressSync(seeds, DEMOTEST_PROGRAM_ID);
    console.log('StorageAccount', storageAccount.toString());
    const ix = createCreateInstruction(
        {
            payer: wallet.publicKey,
            authority: wallet.publicKey,
            storageAccount: storageAccount,
            systemProgram: SystemProgram.programId,
        },
        {
            text: 'Hello, world!',
            uuid: uuid,
        },
        DEMOTEST_PROGRAM_ID,
    );
    console.log('INXS KEYS', ix.keys);
    console.log('INXS DATA', ix.data.toString('hex'));
    const tx = new Transaction().add(ix);
    const sig = await connection.sendTransaction(tx, [wallet]);
    console.log('Transaction sent', sig);
});
