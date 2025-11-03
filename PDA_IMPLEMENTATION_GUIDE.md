# PDA Derivation System - Complete Implementation Guide

This guide will walk you through implementing automatic PDA extraction and derivation in the Codama renderer.

## Table of Contents
1. [Overview](#overview)
2. [Phase 1: Extract PDAs from Instructions](#phase-1-extract-pdas-from-instructions)
3. [Phase 2: Fix String Seed Encoding](#phase-2-fix-string-seed-encoding)
4. [Phase 3: Make PDA Accounts Optional](#phase-3-make-pda-accounts-optional)
5. [Phase 4: Add PDA Derivation Helper](#phase-4-add-pda-derivation-helper)
6. [Phase 5: Integrate PDA Derivation](#phase-5-integrate-pda-derivation)
7. [Phase 6: Update Keys Array](#phase-6-update-keys-array)
8. [Phase 7: Add Tests](#phase-7-add-tests)
9. [Phase 8: Testing & Validation](#phase-8-testing--validation)

---

## Overview

### What We're Building

Currently, the IDL has `"pdas": []` (empty), but PDA definitions exist embedded inside instruction accounts at `account.defaultValue.pda`. We need to:

1. **Extract** these PDAs and let the existing `visitPda` generate files
2. **Make accounts optional** when they have PDA defaults
3. **Auto-derive** PDAs in instruction builders if not provided

### Architecture Flow

```
IDL with instruction accounts
    ↓
extractPdasFromInstructions() → finds embedded PDAs
    ↓
visitProgram() → visits extracted PDAs
    ↓
visitPda() → generates pdas/*.ts files
    ↓
getInstructionFunctionFragment() → imports & uses PDA functions
```

---

## Phase 1: Extract PDAs from Instructions

**File:** `src/visitors/getRenderMapVisitor.ts`

### Step 1.1: Add Extraction Helper Function

**Location:** Before the `getRenderMapVisitor` function (before line 27)

**Add this code:**

```typescript
/**
 * Extracts PDA definitions from instruction account default values.
 * PDAs are embedded in accounts with defaultValue.kind === 'pdaValueNode'.
 * This function deduplicates PDAs by name - same PDA used in multiple instructions
 * will only be extracted once.
 */
function extractPdasFromInstructions(instructions: any[]): any[] {
    const pdaMap = new Map<string, any>();

    for (const instruction of instructions) {
        for (const account of instruction.accounts) {
            // Check if account has a PDA default value
            if (account.defaultValue?.kind === 'pdaValueNode') {
                const pda = account.defaultValue.pda;

                // Deduplicate by name
                if (!pdaMap.has(pda.name)) {
                    console.log(`      → Found PDA: ${pda.name} in instruction ${instruction.name}`);
                    pdaMap.set(pda.name, pda);
                }
            }
        }
    }

    return Array.from(pdaMap.values());
}
```

**Why:** This function scans all instruction accounts, finds PDAs embedded in `defaultValue.pda`, and deduplicates them by name.

### Step 1.2: Update visitProgram

**Location:** Lines 86-118 in `src/visitors/getRenderMapVisitor.ts`

**Find this code:**
```typescript
visitProgram(node, { self }) {
    console.log(`\n🚀 [RenderMap] Processing program: ${node.name}`);
    console.log(`   Accounts: ${node.accounts.length}`);
    console.log(`   Types: ${node.definedTypes.length}`);
    console.log(`   Instructions: ${node.instructions.length}`);
    console.log(`   PDAs: ${node.pdas.length}`);

    const renderMaps = [
        createRenderMap(`${indexFilename}.${extension}`, getProgramConstantsFragment(node)),
        ...node.accounts.map(n => visit(n, self)),
        ...node.definedTypes.map(n => visit(n, self)),
        ...node.instructions.map(n => visit(n, self)),
        ...node.pdas.map(n => visit(n, self)),
    ];
```

**Replace with:**
```typescript
visitProgram(node, { self }) {
    console.log(`\n🚀 [RenderMap] Processing program: ${node.name}`);

    // Extract PDAs from instruction account default values
    const extractedPdas = extractPdasFromInstructions(node.instructions);
    const allPdas = [...node.pdas, ...extractedPdas];

    console.log(`   Accounts: ${node.accounts.length}`);
    console.log(`   Types: ${node.definedTypes.length}`);
    console.log(`   Instructions: ${node.instructions.length}`);
    console.log(`   PDAs: ${allPdas.length} (${extractedPdas.length} extracted from instructions)`);

    const renderMaps = [
        createRenderMap(`${indexFilename}.${extension}`, getProgramConstantsFragment(node)),
        ...node.accounts.map(n => visit(n, self)),
        ...node.definedTypes.map(n => visit(n, self)),
        ...node.instructions.map(n => visit(n, self)),
        ...allPdas.map(n => visit(n, self)),  // ✅ Now includes extracted PDAs
    ];
```

**Why:** We extract PDAs from instructions and combine them with any existing PDAs, then let `visitPda` generate files for all of them.

**Test Phase 1:**
```bash
pnpm build
cd test/e2e/system && pnpm test
```

**Expected output:**
- Console log: `PDAs: 1 (1 extracted from instructions)`
- Console log: `🔑 [RenderMap] Generating PDA: storageAccount`
- New file created: `test/e2e/system/docs/pdas/storageAccount.ts`

---

## Phase 2: Fix String Seed Encoding

**File:** `src/fragments/pdaFunction.ts`

### Problem

The current code for size-prefixed strings (line 111-118) generates an overcomplicated IIFE. We need to properly encode strings with their length prefix to match on-chain behavior.

### Step 2.1: Update String Seed Encoding

**Location:** Lines 111-118 in `src/fragments/pdaFunction.ts`

**Find this code:**
```typescript
} else if (seedType.kind === 'sizePrefixTypeNode' && seedType.type.kind === 'stringTypeNode') {
    // For Anchor-style strings with size prefix, we need to encode properly
    // Create a temporary schema and encode the string
    return addFragmentImports(
        fragment`(() => { const schema = struct([['value', str()]]); const buf = Buffer.alloc(1000); schema.encode({ value: seeds.${seedName} }, buf); return buf.subarray(0, schema.getSpan(buf)); })()`,
        'borsh',
        ['struct', 'str'],
    );
}
```

**Replace with:**
```typescript
} else if (seedType.kind === 'sizePrefixTypeNode' && seedType.type.kind === 'stringTypeNode') {
    // For size-prefixed strings (e.g., Anchor strings), encode with length prefix
    const prefixFormat = seedType.prefix.format; // e.g., 'u32'

    if (prefixFormat === 'u32') {
        // Most common case: u32 length prefix
        return fragment`(() => {
            const stringBuf = Buffer.from(seeds.${seedName}, 'utf8');
            const lengthBuf = Buffer.alloc(4);
            lengthBuf.writeUInt32LE(stringBuf.length, 0);
            return Buffer.concat([lengthBuf, stringBuf]);
        })()`;
    } else if (prefixFormat === 'u8') {
        return fragment`(() => {
            const stringBuf = Buffer.from(seeds.${seedName}, 'utf8');
            const lengthBuf = Buffer.alloc(1);
            lengthBuf.writeUInt8(stringBuf.length, 0);
            return Buffer.concat([lengthBuf, stringBuf]);
        })()`;
    } else if (prefixFormat === 'u16') {
        return fragment`(() => {
            const stringBuf = Buffer.from(seeds.${seedName}, 'utf8');
            const lengthBuf = Buffer.alloc(2);
            lengthBuf.writeUInt16LE(stringBuf.length, 0);
            return Buffer.concat([lengthBuf, stringBuf]);
        })()`;
    }

    // Fallback for other prefix sizes
    return fragment`Buffer.from(seeds.${seedName}, 'utf8')`;
}
```

**Why:** This properly encodes strings with their length prefix, matching how they're serialized on-chain. The IIFE keeps the buffer creation scoped.

**Test Phase 2:**
```bash
pnpm build
cd test/e2e/system && pnpm test
cat test/e2e/system/docs/pdas/storageAccount.ts
```

**Expected in storageAccount.ts:**
```typescript
const seedsBuffer: Buffer[] = [
    Buffer.from('73746f72616765', 'hex'),
    seeds.authority.toBuffer(),
    (() => {
        const stringBuf = Buffer.from(seeds.uuid, 'utf8');
        const lengthBuf = Buffer.alloc(4);
        lengthBuf.writeUInt32LE(stringBuf.length, 0);
        return Buffer.concat([lengthBuf, stringBuf]);
    })(),
];
```

---

## Phase 3: Make PDA Accounts Optional

**File:** `src/fragments/instructionFunction-v2.ts`

### Step 3.1: Update Accounts Interface Generation

**Location:** Lines 50-55 in `src/fragments/instructionFunction-v2.ts`

**Find this code:**
```typescript
const fields = node.accounts.map(account => {
    const fieldName = camelCase(account.name);
    const optional = account.isOptional ? '?' : '';
    const isSigner = account.isSigner === 'either' ? 'PublicKey | Keypair' : 'PublicKey';

    return addFragmentImports(fragment`${fieldName}${optional}: ${isSigner}`, 'web3', ['PublicKey', 'Keypair']);
});
```

**Replace with:**
```typescript
const fields = node.accounts.map(account => {
    const fieldName = camelCase(account.name);

    // Account is optional if:
    // 1. Explicitly marked as optional, OR
    // 2. Has a PDA default value (will be auto-derived)
    const hasPdaDefault = account.defaultValue?.kind === 'pdaValueNode';
    const optional = (account.isOptional || hasPdaDefault) ? '?' : '';

    const isSigner = account.isSigner === 'either' ? 'PublicKey | Keypair' : 'PublicKey';

    return addFragmentImports(fragment`${fieldName}${optional}: ${isSigner}`, 'web3', ['PublicKey', 'Keypair']);
});
```

**Why:** Accounts with PDA defaults should be optional because they can be auto-derived if not provided.

**Test Phase 3:**
```bash
pnpm build
cd test/e2e/system && pnpm test
cat test/e2e/system/docs/instructions/create.ts
```

**Expected in CreateInstructionAccounts:**
```typescript
export interface CreateInstructionAccounts {
    authority: PublicKey;
    payer?: PublicKey;
    storageAccount?: PublicKey;  // ✅ Now optional!
    systemProgram?: PublicKey;
}
```

---

## Phase 4: Add PDA Derivation Helper

**File:** `src/fragments/instructionFunction-v2.ts`

### Step 4.1: Add Helper Function

**Location:** After `getKeysArrayFragment` function (after line 152)

**Add this complete function:**

```typescript
/**
 * Generates PDA derivation logic for accounts with PDA default values.
 * This creates code that auto-derives the PDA if the user doesn't provide it.
 */
function getPdaDerivationFragment(node: InstructionNode): Fragment {
    // Find all accounts that have PDA default values
    const pdaAccounts = node.accounts.filter(
        account => account.defaultValue?.kind === 'pdaValueNode'
    );

    if (pdaAccounts.length === 0) {
        return fragment``;
    }

    const derivations = pdaAccounts.map(account => {
        const accountName = camelCase(account.name);
        const pdaValueNode = account.defaultValue as any; // pdaValueNode type
        const pda = pdaValueNode.pda;
        const pdaName = pascalCase(pda.name);
        const pdaFunctionName = `find${pdaName}Pda`;

        // Build seeds object from pdaValueNode.seeds
        // Each seed maps to either an account or an argument
        const seedsArgs = pdaValueNode.seeds.map((seedValue: any) => {
            const seedName = camelCase(seedValue.name);

            // Map seed value to actual variable reference
            if (seedValue.value.kind === 'accountValueNode') {
                // Seed comes from an account (e.g., authority)
                const accountRef = camelCase(seedValue.value.name);
                return fragment`${seedName}: accounts.${accountRef}`;

            } else if (seedValue.value.kind === 'argumentValueNode') {
                // Seed comes from an instruction argument (e.g., uuid)
                const argRef = camelCase(seedValue.value.name);
                return fragment`${seedName}: args.${argRef}`;

            } else if (seedValue.value.kind === 'identityValueNode') {
                // Identity value - typically maps to the first signer
                // For now, we'll assume it's the authority account
                return fragment`${seedName}: accounts.authority`;

            } else if (seedValue.value.kind === 'resolverValueNode') {
                // Resolver value - needs dynamic resolution
                // This is more complex and may need special handling
                console.warn(`Resolver value for seed ${seedName} - may need manual implementation`);
                return fragment`${seedName}: undefined /* TODO: resolver value */`;
            }

            // Fallback for unknown value types
            return fragment`${seedName}: undefined`;
        });

        const seedsContent = mergeFragments(seedsArgs, cs => cs.join(', '));

        // Generate the derivation code with import
        return addFragmentImports(
            fragment`let ${accountName} = accounts.${accountName};
    if (!${accountName}) {
        const [derivedAddress] = ${pdaFunctionName}({ ${seedsContent} }, programId);
        ${accountName} = derivedAddress;
    }`,
            `../pdas/${camelCase(pda.name)}`,
            pdaFunctionName
        );
    });

    return mergeFragments(derivations, cs => cs.join('\n    '));
}
```

**Why:** This function generates the auto-derivation code for each account that has a PDA default. It maps the seed values to the correct variables (accounts or args) and imports the PDA function.

---

## Phase 5: Integrate PDA Derivation

**File:** `src/fragments/instructionFunction-v2.ts`

### Step 5.1: Update Instruction Builder Function

**Location:** Lines 213-215 in `src/fragments/instructionFunction-v2.ts`

**Find this code:**
```typescript
// Combine function body
const functionBody = mergeFragments([keysArrayFragment, dataFragment, fragment``, returnFragment], cs =>
    cs.join('\n    '),
);
```

**Replace with:**
```typescript
// Get PDA derivation logic (if any accounts have PDA defaults)
const pdaDerivationFragment = getPdaDerivationFragment(node);

// Combine function body - add PDA derivation at the start
const functionBody = mergeFragments(
    [pdaDerivationFragment, fragment``, keysArrayFragment, dataFragment, fragment``, returnFragment],
    cs => cs.join('\n    '),
);
```

**Why:** This inserts the PDA derivation code at the beginning of the function, before the keys array is built. The extra `fragment``` adds blank lines for readability.

**Test Phase 5:**
```bash
pnpm build
cd test/e2e/system && pnpm test
cat test/e2e/system/docs/instructions/create.ts
```

**Expected in createCreateInstruction:**
```typescript
export function createCreateInstruction(accounts, args, programId) {
    // ✅ PDA derivation added!
    let storageAccount = accounts.storageAccount;
    if (!storageAccount) {
        const [derivedAddress] = findStorageAccountPda(
            { authority: accounts.authority, uuid: args.uuid },
            programId
        );
        storageAccount = derivedAddress;
    }

    const keys: AccountMeta[] = [
        // ...
    ];
}
```

---

## Phase 6: Update Keys Array

**File:** `src/fragments/instructionFunction-v2.ts`

### Problem

Currently, the keys array uses `accounts.storageAccount`, but we've created a `let storageAccount` variable. We need to use the variable for PDA accounts.

### Step 6.1: Update Keys Array Generation

**Location:** Lines 127-131 in `src/fragments/instructionFunction-v2.ts`

**Find this code:**
```typescript
// For pubkey, handle both Keypair.publicKey and direct PublicKey
const pubkeyAccess =
    account.isSigner === 'either'
        ? `'publicKey' in accounts.${accountName} ? accounts.${accountName}.publicKey : accounts.${accountName}`
        : `accounts.${accountName}`;
```

**Replace with:**
```typescript
// Check if this account has a PDA default (will be a derived variable)
const hasPdaDefault = account.defaultValue?.kind === 'pdaValueNode';

// For pubkey, handle both Keypair.publicKey and direct PublicKey
const pubkeyAccess = hasPdaDefault
    ? accountName  // Use the derived variable directly (e.g., storageAccount)
    : account.isSigner === 'either'
        ? `'publicKey' in accounts.${accountName} ? accounts.${accountName}.publicKey : accounts.${accountName}`
        : `accounts.${accountName}`;
```

**Why:** PDA accounts are now stored in `let` variables, so we reference them directly instead of accessing `accounts.*`.

**Test Phase 6:**
```bash
pnpm build
cd test/e2e/system && pnpm test
cat test/e2e/system/docs/instructions/create.ts
```

**Expected in keys array:**
```typescript
const keys: AccountMeta[] = [
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: storageAccount, isSigner: false, isWritable: true },  // ✅ Uses variable!
    // ...
];
```

---

## Phase 7: Add Tests

**File:** `test/fragments/instructionFunction-v2.test.ts`

### Step 7.1: Add PDA Test Case

**Location:** After the last test (after line 101)

**Add this complete test:**

```typescript
test('it generates PDA derivation for accounts with PDA defaults', () => {
    const node = instructionNode({
        name: 'create',
        accounts: [
            instructionAccountNode({
                name: 'authority',
                isSigner: true,
                isWritable: true,
            }),
            instructionAccountNode({
                name: 'storageAccount',
                isSigner: false,
                isWritable: true,
                defaultValue: {
                    kind: 'pdaValueNode',
                    pda: {
                        kind: 'pdaNode',
                        name: 'storageAccount',
                        docs: [],
                        seeds: [
                            {
                                kind: 'constantPdaSeedNode',
                                type: { kind: 'bytesTypeNode' },
                                value: {
                                    kind: 'bytesValueNode',
                                    data: '73746f72616765',
                                    encoding: 'base16',
                                },
                            },
                            {
                                kind: 'variablePdaSeedNode',
                                name: 'authority',
                                docs: [],
                                type: { kind: 'publicKeyTypeNode' },
                            },
                            {
                                kind: 'variablePdaSeedNode',
                                name: 'uuid',
                                docs: [],
                                type: {
                                    kind: 'sizePrefixTypeNode',
                                    type: { kind: 'stringTypeNode', encoding: 'utf8' },
                                    prefix: { kind: 'numberTypeNode', format: 'u32', endian: 'le' },
                                },
                            },
                        ],
                    },
                    seeds: [
                        {
                            kind: 'pdaSeedValueNode',
                            name: 'authority',
                            value: { kind: 'accountValueNode', name: 'authority' },
                        },
                        {
                            kind: 'pdaSeedValueNode',
                            name: 'uuid',
                            value: { kind: 'argumentValueNode', name: 'uuid' },
                        },
                    ],
                },
            }),
        ],
        arguments: [
            instructionArgumentNode({
                name: 'uuid',
                type: {
                    kind: 'sizePrefixTypeNode',
                    type: { kind: 'stringTypeNode', encoding: 'utf8' },
                    prefix: { kind: 'numberTypeNode', format: 'u32', endian: 'le' },
                },
            }),
        ],
    });

    const result = getInstructionFunctionFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    // Check that storageAccount is optional in the interface
    expect(result.content).toContain('storageAccount?: PublicKey');

    // Check PDA derivation logic exists
    expect(result.content).toContain('let storageAccount = accounts.storageAccount');
    expect(result.content).toContain('if (!storageAccount)');
    expect(result.content).toContain('findStorageAccountPda');

    // Check seed mapping
    expect(result.content).toContain('authority: accounts.authority');
    expect(result.content).toContain('uuid: args.uuid');

    // Check keys array uses the derived variable
    expect(result.content).toContain('{ pubkey: storageAccount,');
    expect(result.content).not.toContain('{ pubkey: accounts.storageAccount,');

    // Check import from pdas folder
    expect(result.content).toContain("from '../pdas/storageAccount'");
});
```

**Why:** This test verifies all aspects of PDA integration: optional interface, derivation logic, seed mapping, and variable usage.

---

## Phase 8: Testing & Validation

### Step 8.1: Run Unit Tests

```bash
pnpm run test:unit -- test/fragments/instructionFunction-v2.test.ts
```

**Expected:** All tests pass, including the new PDA test.

### Step 8.2: Rebuild Project

```bash
pnpm build
```

**Expected:** No TypeScript errors.

### Step 8.3: Regenerate System Tests

```bash
cd test/e2e/system && pnpm test
```

**Expected console output:**
```
🚀 [RenderMap] Processing program: demoTest
   → Found PDA: storageAccount in instruction create
   PDAs: 1 (1 extracted from instructions)

🔑 [RenderMap] Generating PDA: storageAccount
   → File: pdas/storageAccount.ts
   ✓ Generated

⚡ [RenderMap] Generating instruction: create
   → File: instructions/create.ts
   ✓ Generated
```

### Step 8.4: Verify Generated Files

**Check `test/e2e/system/docs/pdas/storageAccount.ts`:**

```typescript
import { PublicKey } from '@solana/web3.js';

export interface StorageAccountPdaSeeds {
    authority: PublicKey;
    uuid: string;
}

export function findStorageAccountPda(
    seeds: StorageAccountPdaSeeds,
    programId: PublicKey
): [PublicKey, number] {
    const seedsBuffer: Buffer[] = [
        Buffer.from('73746f72616765', 'hex'),
        seeds.authority.toBuffer(),
        (() => {
            const stringBuf = Buffer.from(seeds.uuid, 'utf8');
            const lengthBuf = Buffer.alloc(4);
            lengthBuf.writeUInt32LE(stringBuf.length, 0);
            return Buffer.concat([lengthBuf, stringBuf]);
        })(),
    ];
    return PublicKey.findProgramAddressSync(seedsBuffer, programId);
}
```

**Check `test/e2e/system/docs/instructions/create.ts`:**

```typescript
import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { str, struct } from '@coral-xyz/borsh';
import { findStorageAccountPda } from '../pdas/storageAccount';  // ✅ Import added

export interface CreateInstructionAccounts {
    authority: PublicKey;
    payer?: PublicKey;
    storageAccount?: PublicKey;  // ✅ Optional
    systemProgram?: PublicKey;
}

export interface CreateInstructionArgs {
    text: string;
    uuid: string;
}

const CreateInstructionDataSchema = struct([str("text"), str("uuid")]);

export function createCreateInstruction(
    accounts: CreateInstructionAccounts,
    args: CreateInstructionArgs,
    programId: PublicKey
): TransactionInstruction {
    // ✅ Auto-derive storageAccount if not provided
    let storageAccount = accounts.storageAccount;
    if (!storageAccount) {
        const [derivedAddress] = findStorageAccountPda(
            { authority: accounts.authority, uuid: args.uuid },
            programId
        );
        storageAccount = derivedAddress;
    }

    const keys: AccountMeta[] = [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: storageAccount, isSigner: false, isWritable: true },  // ✅ Uses variable
        { pubkey: accounts.systemProgram ?? new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
        ...(accounts.payer ? [{ pubkey: accounts.payer, isSigner: true, isWritable: true }] : []),
    ];

    const buffer = Buffer.alloc(1000);
    CreateInstructionDataSchema.encode(args, buffer);
    const instructionData = buffer.subarray(0, CreateInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.from('181ec828051c0777', 'hex');
    const data = Buffer.concat([discriminator, instructionData]);

    return new TransactionInstruction({ keys, programId, data });
}
```

### Step 8.5: Test PDA Derivation Manually

Create a test file `test/e2e/system/test-pda.ts`:

```typescript
import { PublicKey } from '@solana/web3.js';
import { findStorageAccountPda } from './docs/pdas/storageAccount';
import { DEMOTEST_PROGRAM_ID } from './docs/index';

// Test PDA derivation
const authority = new PublicKey('7sY1wM8eSpFmLAjhb1jgzTgx6JxRQ7gSq8d2cc4D6MBw');
const uuid = '003';

const [address, bump] = findStorageAccountPda(
    { authority, uuid },
    DEMOTEST_PROGRAM_ID
);

console.log('PDA Address:', address.toString());
console.log('Bump:', bump);

// Compare with manual derivation (from your working code)
const uuidBuffer = Buffer.from(uuid, 'utf8');
const uuidLength = Buffer.alloc(4);
uuidLength.writeUInt32LE(uuidBuffer.length, 0);
const uuidSeed = Buffer.concat([uuidLength, uuidBuffer]);

const seeds = [
    Buffer.from('storage'),
    authority.toBuffer(),
    uuidSeed,
];

const [manualAddress] = PublicKey.findProgramAddressSync(seeds, DEMOTEST_PROGRAM_ID);

console.log('Manual Address:', manualAddress.toString());
console.log('Matches:', address.toString() === manualAddress.toString());
```

Run it:
```bash
cd test/e2e/system
npx ts-node test-pda.ts
```

**Expected output:**
```
PDA Address: <some address>
Bump: 255
Manual Address: <same address>
Matches: true
```

### Step 8.6: Test with Real Transaction

Update `test/generated/system.test.ts` to test with and without providing the storageAccount:

```typescript
test('It should create a storage account with auto-derived PDA', async () => {
    const wallet = Keypair.fromSecretKey(/* ... */);
    const connection = new Connection(/* ... */);
    const uuid = '004';

    // Test 1: Without providing storageAccount (auto-derive)
    const ix1 = createCreateInstruction(
        {
            authority: wallet.publicKey,
            payer: wallet.publicKey,
            // storageAccount not provided - will be auto-derived
        },
        {
            text: 'Auto-derived!',
            uuid: uuid,
        },
        DEMOTEST_PROGRAM_ID,
    );

    console.log('Auto-derived keys:', ix1.keys.map(k => k.pubkey.toString()));

    // Test 2: Manually provide storageAccount (should use provided value)
    const [manualPda] = findStorageAccountPda(
        { authority: wallet.publicKey, uuid: uuid },
        DEMOTEST_PROGRAM_ID
    );

    const ix2 = createCreateInstruction(
        {
            authority: wallet.publicKey,
            payer: wallet.publicKey,
            storageAccount: manualPda,  // Explicitly provided
        },
        {
            text: 'Manual PDA!',
            uuid: uuid,
        },
        DEMOTEST_PROGRAM_ID,
    );

    console.log('Manual keys:', ix2.keys.map(k => k.pubkey.toString()));

    // Both should have the same storageAccount
    expect(ix1.keys[1].pubkey.toString()).toBe(ix2.keys[1].pubkey.toString());
});
```

---

## Troubleshooting

### Issue 1: PDA file not generated

**Problem:** `pdas/storageAccount.ts` doesn't exist after regeneration.

**Solution:**
- Check console logs for "Found PDA: storageAccount"
- Verify `extractPdasFromInstructions` is being called
- Add debug logs to see if the PDA is in the array

### Issue 2: Import path error

**Problem:** `Cannot find module '../pdas/storageAccount'`

**Solution:**
- Check that the PDA file exists in the correct location
- Verify the import path in `addFragmentImports` uses relative path `../pdas/`
- Make sure camelCase conversion is correct

### Issue 3: PDA addresses don't match

**Problem:** Generated PDA doesn't match on-chain address.

**Solution:**
- Check string seed encoding - must include u32 length prefix
- Verify seed order matches on-chain program
- Compare with your working manual derivation code
- Use `console.log` to inspect seed buffers

### Issue 4: TypeScript errors

**Problem:** Generated code has TypeScript errors.

**Solution:**
- Run `pnpm run test:types` to see all errors
- Check that all imports are included
- Verify variable names match between derivation and keys array

---

## Summary Checklist

After completing all phases, verify:

- [ ] `extractPdasFromInstructions` function added to `getRenderMapVisitor.ts`
- [ ] `visitProgram` updated to extract and visit PDAs
- [ ] String seed encoding fixed in `pdaFunction.ts`
- [ ] Accounts with PDA defaults are optional in `instructionFunction-v2.ts`
- [ ] `getPdaDerivationFragment` helper added
- [ ] PDA derivation integrated into instruction builder
- [ ] Keys array uses derived variables for PDA accounts
- [ ] Unit test added for PDA functionality
- [ ] All unit tests pass
- [ ] Project builds without errors
- [ ] PDA files generated in `pdas/` folder
- [ ] Instructions import and use PDA functions
- [ ] Manual PDA derivation matches generated code
- [ ] Integration tests pass

---

## Learning Resources

### Key Concepts

1. **Visitor Pattern:** Used to traverse the AST and generate code
2. **Fragment System:** Builds code with tracked imports
3. **PDA (Program Derived Address):** On-chain addresses derived from seeds
4. **Seed Encoding:** How different types are serialized to buffers

### Useful Commands

```bash
# Run specific test
pnpm run test:unit -- test/fragments/instructionFunction-v2.test.ts

# Check types
pnpm run test:types

# Rebuild everything
pnpm build

# Regenerate test fixtures
cd test/e2e/system && pnpm test

# View generated file
cat test/e2e/system/docs/instructions/create.ts
```

### Code Patterns

**Adding imports:**
```typescript
addFragmentImports(
    fragment`code here`,
    'import-path',
    'importName'
)
```

**Merging fragments:**
```typescript
mergeFragments([frag1, frag2], cs => cs.join('\n'))
```

**Visiting nodes:**
```typescript
visit(node.type, typeVisitor)
```

---

## Next Steps

After implementing PDA derivation:

1. **Add PDA index file** - Generate `pdas/index.ts` to export all PDA functions
2. **Support custom default values** - Handle more types of default values
3. **Optimize seed encoding** - Cache common patterns
4. **Add documentation** - Generate JSDoc for PDA functions
5. **Support complex seeds** - Handle nested structs, arrays, etc.

---

**Good luck with the implementation! Take it one phase at a time and test after each phase.**
