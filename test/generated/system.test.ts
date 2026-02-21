import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { expect, test } from 'vitest';

import { createTransferSolInstruction, SYSTEM_PROGRAM_ID } from '../e2e/system_program/docs/index';

function loadWallet(): Keypair {
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/id.json');
    const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf8')) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function getConnection(): Connection {
    const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
    return new Connection(rpcUrl, 'confirmed');
}

test('creates transferSol instruction', () => {
    const source = new PublicKey('11111111111111111111111111111111');
    const destination = new PublicKey('BPFLoader1111111111111111111111111111111111');

    const ix = createTransferSolInstruction({ source, destination }, { amount: 5_000n }, SYSTEM_PROGRAM_ID);

    expect(ix.programId.equals(SYSTEM_PROGRAM_ID)).toBe(true);
    expect(ix.keys).toHaveLength(2);
});

test('defaults transferSol instruction programId to SYSTEM_PROGRAM_ID', () => {
    const source = new PublicKey('11111111111111111111111111111111');
    const destination = new PublicKey('BPFLoader1111111111111111111111111111111111');

    const ix = createTransferSolInstruction({ source, destination }, { amount: 5_000n });

    expect(ix.programId.equals(SYSTEM_PROGRAM_ID)).toBe(true);
});

test('sends transfer transaction on-chain', async () => {
    const wallet = loadWallet();
    const connection = getConnection();

    const ix = createTransferSolInstruction(
        { source: wallet.publicKey, destination: wallet.publicKey },
        { amount: 5_000n },
        SYSTEM_PROGRAM_ID,
    );

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
});
