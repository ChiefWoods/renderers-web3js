import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Connection, Keypair, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { expect, test } from 'vitest';

import { createAddMemoInstruction, MEMO_PROGRAM_ID } from '../e2e/memo/docs/index';

function loadWallet(): Keypair {
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/id.json');
    const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf8')) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function getConnection(): Connection {
    const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
    return new Connection(rpcUrl, 'confirmed');
}

test('creates addMemo instruction', () => {
    const memo = 'Hello from Codama!';
    const ix = createAddMemoInstruction({ memo }, MEMO_PROGRAM_ID);

    expect(ix.keys).toEqual([]);
    expect(ix.programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    expect(Buffer.from(ix.data).toString('utf8')).toBe(memo);
});

test('sends memo transaction on-chain', async () => {
    const wallet = loadWallet();
    const connection = getConnection();

    const memo = `codama-memo-${Date.now()}`;
    const ix = createAddMemoInstruction({ memo }, MEMO_PROGRAM_ID);
    const tx = new Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log('MEMO', sig);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
});
