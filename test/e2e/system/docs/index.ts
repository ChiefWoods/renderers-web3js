import { PublicKey } from '@solana/web3.js';

export const DEMOTEST_PROGRAM_ID = new PublicKey('ByrkLR1atR9TS4E9GiN29z3i7jYWgqSPAq4HJR4CP9U7');

export * from './accounts/storage';
export * from './instructions/create';
export * from './instructions/delete';
export * from './instructions/update';