import { Connection, Keypair, Transaction } from '@solana/web3.js';
import { createAddMemoInstruction, MEMO_PROGRAM_ID } from '../e2e/memo/docs/index';

import { test, expect } from 'vitest';
import fs from 'fs';

test('It should create an addMemo instruction', () => {
    const memo = 'Hello from Codama!';
    const ix = createAddMemoInstruction(
        { memo },
        MEMO_PROGRAM_ID,
    );

    // Verify instruction properties
    expect(ix.keys).toEqual([]);
    expect(ix.programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    expect(ix.data.length).toBeGreaterThan(0);
    console.log('Instruction created successfully');
    console.log('Keys:', ix.keys);
    console.log('Program ID:', ix.programId.toString());
    console.log('Data length:', ix.data.length);
});

test('It should send a memo to devnet', async () => {
    // load wallet from path
    const wallet = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync('/Users/pratik/.config/solana/id.json', 'utf8'))),
    );
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=3fc11e81-5f24-43cc-a621-6b340ce43c07');
    console.log('Wallet', wallet.publicKey.toString());
    const balance = await connection.getBalance(wallet.publicKey);
    console.log('Balance', balance);

    const memo = 'Hello from Codama!';
    const ix = createAddMemoInstruction(
        { memo },
        MEMO_PROGRAM_ID,
    );
    console.log('INXS KEYS', ix.keys);
    console.log('INXS DATA', ix.data.toString('hex'));
    const tx = new Transaction().add(ix);
    const sig = await connection.sendTransaction(tx, [wallet]);
    console.log('Transaction sent', sig);
});

