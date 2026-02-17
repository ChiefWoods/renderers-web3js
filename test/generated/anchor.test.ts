import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Connection, Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import { expect, test } from 'vitest';

import { createCreateInstruction, DUMMYPRG_PROGRAM_ID, fetchStorageAccount } from '../e2e/anchor/docs/index';
import { findStorageAccountPda } from '../e2e/anchor/docs/pdas/storageAccount';

function loadWallet(): Keypair {
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH ?? path.join(os.homedir(), '.config/solana/id.json');
    const secret = JSON.parse(fs.readFileSync(keypairPath, 'utf8')) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function getConnection(): Connection {
    const rpcUrl =
        process.env.SOLANA_RPC_URL ?? 'https://devnet.helius-rpc.com/?api-key=ff17a075-ee9d-4796-b9d5-3d0a054f017c';
    return new Connection(rpcUrl, 'confirmed');
}

test('creates anchor create instruction', () => {
    const authority = Keypair.generate().publicKey;
    const uuid = `codama-anchor-${Date.now()}`;

    const [storageAccount] = findStorageAccountPda({ authority, uuid }, DUMMYPRG_PROGRAM_ID);
    const ix = createCreateInstruction(
        {
            authority,
            systemProgram: SystemProgram.programId,
        },
        {
            text: 'hello anchor',
            uuid,
            action: { __kind: 'SetVaultStatus', fields: [1] },
        },
        DUMMYPRG_PROGRAM_ID,
    );

    expect(ix.programId.equals(DUMMYPRG_PROGRAM_ID)).toBe(true);
    expect(ix.keys).toHaveLength(3);
    expect(ix.keys[1]?.pubkey.equals(storageAccount)).toBe(true);
});

test('defaults anchor create instruction and PDA to DUMMYPRG_PROGRAM_ID', () => {
    const authority = Keypair.generate().publicKey;
    const uuid = `codama-anchor-${Date.now()}`;

    const [storageAccount] = findStorageAccountPda({ authority, uuid });
    const ix = createCreateInstruction(
        {
            authority,
            systemProgram: SystemProgram.programId,
        },
        {
            text: 'hello anchor',
            uuid,
            action: { __kind: 'SetVaultStatus', fields: [1] },
        },
    );

    expect(ix.programId.equals(DUMMYPRG_PROGRAM_ID)).toBe(true);
    expect(ix.keys[1]?.pubkey.equals(storageAccount)).toBe(true);
});

test('sends anchor create transaction on-chain and fetches storage', async () => {
    const wallet = loadWallet();
    const connection = getConnection();
    const uuid = `codama-anchor-${Date.now()}`;
    const text = `hello-anchor-${Date.now()}`;

    const [storageAccount] = findStorageAccountPda({ authority: wallet.publicKey, uuid }, DUMMYPRG_PROGRAM_ID);
    const ix = createCreateInstruction(
        {
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        {
            text,
            uuid,
            action: { __kind: 'SetVaultStatus', fields: [1] },
        },
        DUMMYPRG_PROGRAM_ID,
    );

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log('ANCHOR_CREATE', sig);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);

    const account = await fetchStorageAccount(connection, storageAccount);
    expect(account.address.equals(storageAccount)).toBe(true);
    expect(account.data.authority.equals(wallet.publicKey)).toBe(true);
    expect(account.data.uuid).toBe(uuid);
    expect(account.data.text).toBe(text);
});
