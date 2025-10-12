# Simple Fragment Adaptation Guide

## Core Concept

Transform fragments that generate @solana/kit code to generate @solana/web3.js v1.x code by changing imports, types, and patterns.

## Import System Changes

### Update `importMap.ts`

Replace module mappings:

```typescript
// OLD (@solana/kit)
const DEFAULT_MODULE_MAP = {
    solanaAddresses: '@solana/kit',
    solanaInstructions: '@solana/kit',
    solanaCodecsCore: '@solana/kit',
    // ... other @solana/* modules
};

// NEW (@solana/web3.js)
const DEFAULT_MODULE_MAP = {
    web3: '@solana/web3.js',
    borsh: '@coral-xyz/borsh',
};
```

## Type Replacements

Create a mapping table for quick reference:

| Old Type | New Type |

|----------|----------|

| `type Address` | `PublicKey` |

| `type TransactionSigner` | `PublicKey` (for addresses) |

| `type Instruction` | `TransactionInstruction` |

| `ReadonlyUint8Array` | `Buffer` |

| `type AccountMeta` (typed) | `AccountMeta` (simple) |

## Fragment Changes (Priority Order)

### 1. Instruction Fragment (`instructionFunction.ts`)

**Change function signature:**

```typescript
// OLD
export function get{Name}Instruction<TAccounts...>(
  input: {accounts, args},
  config?: {programAddress}
): {Name}Instruction<...>

// NEW
export function create{Name}Instruction(
  accounts: {
    account1: PublicKey,
    account2: PublicKey
  },
  args: {Name}Args,
  programId = {PROGRAM}_ID
): TransactionInstruction
```

**Change account handling:**

```typescript
// OLD
const originalAccounts = {...};
const accounts = originalAccounts as Record<..., ResolvedAccount>;

// NEW
const keys: AccountMeta[] = [
  { pubkey: accounts.account1, isSigner: true, isWritable: false },
  { pubkey: accounts.account2, isSigner: false, isWritable: true },
];
```

**Change data serialization:**

```typescript
// OLD
data: get{Name}InstructionDataEncoder().encode(args)

// NEW
const data = Buffer.from(
  serialize({Name}InstructionSchema, { discriminator: X, ...args })
);
```

**Change return statement:**

```typescript
// OLD
return Object.freeze({
  accounts: [...],
  data: ...,
  programAddress
});

// NEW
return new TransactionInstruction({
  keys,
  programId,
  data
});
```

### 2. Serialization Fragments (`typeCodec.ts`, `typeEncoder.ts`, `typeDecoder.ts`)

**Replace codec functions with Borsh schemas:**

```typescript
// OLD (typeEncoder.ts)
export function get{Name}Encoder(): Encoder<{Name}Args> {
  return getStructEncoder([
    ['field1', getU64Encoder()],
    ['field2', getU32Encoder()],
  ]);
}

// NEW (single file approach)
import { struct, u64, u32 } from '@coral-xyz/borsh';

export const {Name}Schema = struct([
  ['field1', u64()],
  ['field2', u32()],
]);

export function serialize{Name}(data: {Name}Args): Buffer {
  return Buffer.from(serialize({Name}Schema, data));
}

export function deserialize{Name}(buffer: Buffer): {Name} {
  return deserialize({Name}Schema, buffer);
}
```

**Borsh type mapping:**

- `getU8Encoder()` → `u8()`
- `getU16Encoder()` → `u16()`
- `getU32Encoder()` → `u32()`
- `getU64Encoder()` → `u64()`
- `getBytesEncoder()` → `bytes()`
- `getStructEncoder([...])` → `struct([...])`
- `getArrayEncoder()` → `array()`
- `getOptionEncoder()` → `option()`

### 3. Account Fetch Fragment (`accountFetchHelpers.ts`)

**Change fetch function signature:**

```typescript
// OLD
export async function fetch{Name}(
  rpc: Rpc<GetAccountInfoApi>,
  address: Address
): Promise<Account<{Name}AccountData>>

// NEW
export async function fetch{Name}(
  connection: Connection,
  address: PublicKey
): Promise<{Name}Account>
```

**Change implementation:**

```typescript
// OLD
const maybeAccount = await fetchEncodedAccount(rpc, address);
const account = assertAccountExists(maybeAccount);
return decode{Name}Account(account);

// NEW
const accountInfo = await connection.getAccountInfo(address);
if (!accountInfo) {
  throw new Error('{Name} account not found');
}
return deserialize{Name}Account(accountInfo.data);
```

### 4. PDA Fragment (`pdaFunction.ts`)

**Change PDA derivation:**

```typescript
// OLD
export async function find{Name}Pda(
  seeds: {...}
): Promise<ProgramDerivedAddress> {
  return await getProgramDerivedAddress({
    programAddress,
    seeds: [...]
  });
}

// NEW
export function find{Name}Pda(
  seeds: {...},
  programId = {PROGRAM}_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('prefix'),
      seeds.field1.toBuffer(),
      // serialize other seeds
    ],
    programId
  );
}
```

**Seed encoding:**

- `PublicKey` → `publicKey.toBuffer()`
- `string` → `Buffer.from(string, 'utf8')`
- `number` (u8) → `Buffer.from([number])`
- `bigint` (u64) → Use BN or Buffer.alloc(8) with manual encoding

### 5. Instruction Types (`instructionType.ts`)

**Simplify types:**

```typescript
// OLD (complex generics)
export type {Name}Instruction<
  TProgram extends string,
  TAccount1 extends string | AccountMeta,
  ...
> = Instruction<TProgram> & InstructionWithData<...> & ...

// NEW (simple)
export interface {Name}InstructionAccounts {
  account1: PublicKey;
  account2: PublicKey;
}

export interface {Name}InstructionArgs {
  field1: number | bigint;
  field2: string;
}
```

### 6. Account Types (`accountType.ts`)

**Simplify account types:**

```typescript
// OLD
export type {Name}AccountData = {...};
export type {Name}Account<TAddress extends string = string> =
  Account<{Name}AccountData, TAddress>;

// NEW
export interface {Name}AccountData {
  field1: bigint;
  field2: PublicKey;
}

export interface {Name}Account {
  address: PublicKey;
  data: {Name}AccountData;
}
```

## Name Convention Changes (`nameTransformers.ts`)

Update function naming:

```typescript
// OLD
instructionSyncFunction: name => `get${pascalCase(name)}Instruction`;
encoderFunction: name => `get${pascalCase(name)}Encoder`;
decoderFunction: name => `get${pascalCase(name)}Decoder`;

// NEW
instructionSyncFunction: name => `create${pascalCase(name)}Instruction`;
serializeFunction: name => `serialize${pascalCase(name)}`;
deserializeFunction: name => `deserialize${pascalCase(name)}`;
```

## Visitor Changes (`getTypeManifestVisitor.ts`)

**Update TypeManifest structure:**

```typescript
// OLD
interface TypeManifest {
    encoder: Fragment;
    decoder: Fragment;
    strictType: Fragment;
    looseType: Fragment;
}

// NEW
interface TypeManifest {
    schema: Fragment; // Borsh schema
    serialize: Fragment; // Serialize function
    deserialize: Fragment; // Deserialize function
    type: Fragment; // TypeScript type
    argsType: Fragment; // Input args type
}
```

**Change codec generation to schema generation:**

```typescript
// OLD: Generate encoder/decoder calls
encoder: `getStructEncoder([...])`,
decoder: `getStructDecoder([...])`

// NEW: Generate Borsh schema
schema: `struct([...])`,
serialize: `(data) => Buffer.from(serialize(schema, data))`,
deserialize: `(buf) => deserialize(schema, buf)`
```

## Quick Reference: Common Patterns

### Instructions

- Remove generic type parameters
- Change `programAddress` → `programId`
- Change `accounts` object → separate `accounts` + `args` params
- Use `TransactionInstruction` constructor
- Build `AccountMeta[]` array explicitly

### Accounts

- Add `connection: Connection` parameter
- Use `connection.getAccountInfo()`
- Return plain objects, not wrapped `Account<T>`
- Manual deserialization with Borsh

### PDAs

- Use `PublicKey.findProgramAddressSync()`
- Return `[PublicKey, number]` tuple
- Manually encode seeds to `Buffer[]`

### Serialization

- Define Borsh schemas as constants
- Use `serialize(schema, data)` / `deserialize(schema, buffer)`
- Wrap results in `Buffer.from()` / unwrap with `.data`

## Testing Checklist

After adapting fragments, verify:

- [ ] Generated code has correct imports
- [ ] Types use `PublicKey` instead of `Address`
- [ ] Instructions return `TransactionInstruction`
- [ ] Borsh schemas are valid
- [ ] PDAs derive correctly
- [ ] Account fetching works with `Connection`

## Common Pitfalls

1. **Don't forget** to change `Address` → `PublicKey` everywhere
2. **Remember** `Buffer` vs `Uint8Array` - web3.js uses Buffer
3. **Watch out** for async/sync differences (PDA findSync vs async)
4. **Be careful** with number types: `number | bigint` for args, `bigint` for data
5. **Remove** complex TypeScript generics - keep it simple
