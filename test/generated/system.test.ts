import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Address, Connection, Keypair, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { expect, test } from 'vitest';

import { createTransferSolInstruction, SYSTEM_PROGRAM_ID } from '../e2e/system_program/docs/index';

const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/id.json');
const hasWallet = process.env.CI !== 'true' && fs.existsSync(keypairPath);
const canSendOnChain = hasWallet && !__BROWSER__;

async function loadWallet(): Promise<Keypair> {
    const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf8')) as number[];
    return await Keypair.fromSecretKey(Uint8Array.from(secret));
}

function getConnection(): Connection {
    const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
    return new Connection(rpcUrl, 'confirmed');
}

test('creates transferSol instruction', () => {
    const source = new Address('11111111111111111111111111111111');
    const destination = new Address('BPFLoader1111111111111111111111111111111111');

    const ix = createTransferSolInstruction({ destination, source }, { amount: 5_000n }, SYSTEM_PROGRAM_ID);

    expect(ix.programId.equals(SYSTEM_PROGRAM_ID)).toBe(true);
    expect(ix.keys).toHaveLength(2);
});

test('defaults transferSol instruction programId to SYSTEM_PROGRAM_ID', () => {
    const source = new Address('11111111111111111111111111111111');
    const destination = new Address('BPFLoader1111111111111111111111111111111111');

    const ix = createTransferSolInstruction({ destination, source }, { amount: 5_000n });

    expect(ix.programId.equals(SYSTEM_PROGRAM_ID)).toBe(true);
});

test.skipIf(!canSendOnChain)('sends transfer transaction on-chain', async () => {
    const wallet = await loadWallet();
    const connection = getConnection();

    const ix = createTransferSolInstruction(
        { destination: wallet.publicKey, source: wallet.publicKey },
        { amount: 5_000n },
        SYSTEM_PROGRAM_ID,
    );

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
});
