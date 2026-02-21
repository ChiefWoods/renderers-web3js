# Codama Web3.js Legacy Renderer - Claude Context Document

## Project Overview

This is a **Codama renderer** project that generates TypeScript client code for Solana programs. It takes Solana IDL (Interface Definition Language) files and generates type-safe instruction builders, account fetchers, and type definitions for web3.js.

### What This Project Does

1. **Reads Solana IDLs** - Takes JSON IDL files describing on-chain programs
2. **Generates TypeScript Code** - Creates client-side code with:
    - Instruction builder functions (e.g., `createCreateInstruction`)
    - Account data interfaces and fetch functions
    - Borsh serialization schemas
    - Type definitions

3. **Supports Multiple Targets** - Builds for Node, Browser, and React Native

## Project Structure

```
src/
├── fragments/           # Code generation fragments
│   ├── instructionFunction-v2.ts    # Main instruction generator
│   ├── accountType.ts               # Account type generator
│   └── definedType.ts               # Custom type generator
├── visitors/            # AST visitors for type conversion
│   ├── getBorshSchemaVisitor.ts     # Generates @coral-xyz/borsh schemas
│   ├── getTypeVisitor.ts            # Generates TypeScript types
│   └── getValueVisitor.ts           # Generates value literals
└── utils/               # Utility functions
    ├── fragment.ts      # Fragment system for code generation
    └── importMap.ts     # Import tracking and generation

test/
├── fragments/           # Unit tests for fragments
├── visitors/            # Unit tests for visitors
├── e2e/                 # End-to-end tests
│   ├── system/          # System program tests
│   │   ├── idl.json     # IDL input
│   │   ├── codama.json  # Codama config
│   │   └── docs/        # Generated output
│   └── token/           # Token program tests
└── generated/           # Integration tests for generated code
    └── system.test.ts   # Tests actual devnet transactions
```

## Key Architectural Concepts

### 1. Fragment System

The **Fragment** is the core building block for code generation:

```typescript
type Fragment = {
    content: string; // The generated code
    imports: ImportMap; // Tracked imports
};
```

**Key Functions:**

- `fragment` - Template literal tag for creating fragments
- `mergeFragments` - Combines multiple fragments
- `addFragmentImports` - Adds imports to a fragment
- `getCodeFileFragment` - Converts fragments to final file content (bakes imports into content)

**Important**: Once `getCodeFileFragment` is called, imports are baked into the content string and the imports map becomes empty. Tests should check `result.content` for import statements, not `result.imports`.

### 2. Visitor Pattern

Codama uses the **Visitor pattern** to traverse AST nodes and generate code:

- **TypeVisitor** - Converts Codama type nodes → TypeScript types
- **BorshSchemaVisitor** - Converts Codama type nodes → Borsh schema calls
- **ValueVisitor** - Converts value nodes → TypeScript literals

### 3. Instruction Generation Pipeline

```
InstructionNode
    ↓
getInstructionFunctionFragment()
    ↓
├─→ getAccountsInterfaceFragment()     // Creates accounts interface
├─→ getArgsInterfaceFragment()         // Creates args interface
├─→ getInstructionSchemaFragment()     // Creates Borsh schema
└─→ getInstructionBuilderFragment()    // Creates builder function
    ↓
Final TypeScript File
```

## The Discriminator Bug (Fixed)

### Problem

Generated instructions had a **double discriminator bug**:

```typescript
// WRONG - Before fix:
const Schema = struct([
    array(u8(), 8, 'discriminator'), // ❌ Discriminator in schema
    str('text'),
    str('uuid'),
]);

// Then later:
const discriminator = Buffer.from('181ec828051c0777', 'hex');
const data = Buffer.concat([discriminator, instructionData]); // ❌ Prepended again
```

**Result**: Schema expected 3 fields but args only had 2 → encoding failure.

### Root Cause

In `getInstructionSchemaFragment()` at line 94:

```typescript
// WRONG:
const argsStruct = structTypeNodeFromInstructionArgumentNodes(node.arguments);
// This included ALL arguments, including omitted ones like discriminator
```

### Solution

Filter out arguments with `defaultValueStrategy: 'omitted'`:

```typescript
// CORRECT:
const userArgs = node.arguments.filter(arg => arg.defaultValueStrategy !== 'omitted');
const argsStruct = structTypeNodeFromInstructionArgumentNodes(userArgs);
```

Now the generated code is correct:

```typescript
// After fix:
const Schema = struct([str('text'), str('uuid')]); // ✅ No discriminator

const discriminator = Buffer.from('181ec828051c0777', 'hex');
const data = Buffer.concat([discriminator, instructionData]); // ✅ Only prepended once
```

## Key Learnings

### 1. Omitted Arguments

Codama uses `defaultValueStrategy: 'omitted'` for values that should NOT appear in user-facing interfaces:

- Discriminators (instruction identifiers)
- Version numbers
- Magic bytes

**Rule**: Always filter these out when generating:

- Argument interfaces
- Borsh schemas
- Function parameters

### 2. Optional Accounts

Optional accounts should use the **spread operator pattern** for cleaner code:

```typescript
// GOOD:
const keys: AccountMeta[] = [
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    ...(accounts.payer ? [{ pubkey: accounts.payer, isSigner: true, isWritable: true }] : []),
    { pubkey: accounts.storageAccount, isSigner: false, isWritable: true },
];

// AVOID:
keys.push({ pubkey: accounts.payer ?? defaultValue, isSigner: accounts.payer !== undefined, ... });
```

### 3. Borsh Encoding Pattern

Use the `.encode()` + `.getSpan()` pattern with @coral-xyz/borsh:

```typescript
const buffer = Buffer.alloc(1000);
schema.encode(args, buffer);
const data = buffer.subarray(0, schema.getSpan(buffer));
```

**Don't** use the old `serialize()` function from borsh.

### 4. Testing Strategy

**Three levels of tests:**

1. **Unit Tests** (`test/fragments/`, `test/visitors/`)
    - Test individual fragments and visitors
    - Fast feedback loop
    - Run with: `pnpm run test:unit`

2. **Code Generation Tests** (`test/e2e/`)
    - Generate code from real IDLs
    - Verify output structure
    - Run with: `cd test/e2e/system && pnpm test`

3. **Integration Tests** (`test/generated/system.test.ts`)
    - Test generated code against real Solana devnet
    - End-to-end validation
    - Requires wallet and RPC access

## Working with the Codebase

### Making Changes to Code Generation

1. **Identify the fragment** you need to modify (e.g., `instructionFunction-v2.ts`)
2. **Update the fragment logic** carefully
3. **Update corresponding tests** in `test/fragments/`
4. **Run unit tests**: `pnpm run test:unit`
5. **Rebuild the project**: `pnpm build`
6. **Regenerate test fixtures**: `cd test/e2e/system && pnpm test`
7. **Verify generated output** in `test/e2e/system/docs/`
8. **Run integration tests** if possible

### Common Patterns

#### Adding Imports to a Fragment

```typescript
const result = addFragmentImports(
    fragment`publicKey()`,
    'borsh',
    'publicKey', // or ['publicKey', 'str'] for multiple
);
```

#### Conditional Code Generation

```typescript
if (node.accounts.length > 0) {
    fragments.push(getAccountsInterfaceFragment(node));
}
```

#### Visiting Child Nodes

```typescript
const fieldType = visit(arg.type, typeVisitor);
const fieldSchema = visit(arg.type, borshSchemaVisitor);
```

### Debugging Tips

1. **Console logs are your friend** - The codebase has extensive logging:

    ```typescript
    console.log(`🔧 [Field] ${fieldName} - type: ${field.type.kind}`);
    ```

2. **Check generated files** in `test/e2e/system/docs/` to see actual output

3. **Use the test files** as examples of correct usage

4. **Fragment content inspection** - Log `fragment.content` to see what's generated

## Common Gotchas

### 1. Fragment Imports Disappear

After calling `getCodeFileFragment()`, the imports map is empty because imports are baked into the content. Don't test `result.imports` - test `result.content` instead.

### 2. Node Arguments vs User Arguments

Always distinguish between:

- `node.arguments` - All arguments including omitted ones
- `userArgs` - Filtered list excluding omitted arguments

### 3. Account Order Matters

The order of accounts in the keys array must match the on-chain program's expectations. Optional accounts should typically come after required ones.

### 4. Borsh Field Names

When generating Borsh schemas, field names must be passed as the last parameter:

```typescript
// CORRECT:
u64('amount');
option(publicKey(), 'owner');

// WRONG:
u64(); // Missing field name
```

### 5. TypeScript vs Borsh Types

- TypeScript: `bigint`, `string`, `PublicKey`
- Borsh: `u64()`, `str()`, `publicKey()`

Don't mix them up!

## Build System

**Build Command**: `pnpm build`

Outputs:

- `dist/index.node.mjs` - Node ESM
- `dist/index.node.cjs` - Node CommonJS
- `dist/index.browser.mjs` - Browser ESM
- `dist/index.browser.cjs` - Browser CommonJS
- `dist/index.react-native.mjs` - React Native
- `dist/types/` - TypeScript declarations

## Test Scripts

```bash
# Run all tests
pnpm test

# Run only unit tests
pnpm run test:unit

# Run unit tests for specific file
pnpm run test:unit -- test/fragments/instructionFunction-v2.test.ts

# Run type checking
pnpm run test:types

# Regenerate e2e fixtures
cd test/e2e/system && pnpm test
```

## Best Practices

1. **Always filter omitted arguments** when generating schemas and interfaces
2. **Use the spread operator** for optional accounts
3. **Log at key decision points** to help with debugging
4. **Update tests when changing fragments** - tests are documentation
5. **Check generated output** after making changes
6. **Keep fragments focused** - one responsibility per fragment function
7. **Preserve imports** when merging fragments
8. **Follow the existing patterns** - consistency matters

## Future Improvements

### Potential Enhancements

1. **Better Error Messages** - Add validation for common mistakes
2. **Schema Validation** - Verify schema matches args at generation time
3. **Default Values** - Better handling of system accounts (SystemProgram, etc.)
4. **Documentation Generation** - Generate JSDoc comments from IDL docs
5. **Custom Serialization** - Support for non-Borsh serialization
6. **PDA Helpers** - Generate PDA derivation functions automatically

### Known Limitations

1. Complex enum types need manual implementation
2. Map types not supported by @coral-xyz/borsh
3. Some edge cases with nested optional types
4. Limited support for custom serialization strategies

## Quick Reference

### File to Edit for Common Tasks

- **Change instruction generation** → `src/fragments/instructionFunction-v2.ts`
- **Change account generation** → `src/fragments/accountType.ts`
- **Change type mapping** → `src/visitors/getTypeVisitor.ts`
- **Change Borsh schema** → `src/visitors/getBorshSchemaVisitor.ts`
- **Add new fragment type** → `src/fragments/` + update render map

### Important Functions

- `getInstructionFunctionFragment()` - Main instruction generator
- `getAccountsInterfaceFragment()` - Generates accounts interface
- `getArgsInterfaceFragment()` - Generates args interface
- `getInstructionSchemaFragment()` - Generates Borsh schema
- `getKeysArrayFragment()` - Generates AccountMeta[] array
- `getInstructionBuilderFragment()` - Generates builder function

## Questions to Ask When Making Changes

1. Does this affect omitted arguments?
2. Do I need to filter `defaultValueStrategy: 'omitted'`?
3. Are imports being properly tracked?
4. Does the generated code compile?
5. Does it work with real on-chain programs?
6. Are the tests updated?
7. Is the pattern consistent with existing code?

---

**Last Updated**: 2025-10-26
**Major Changes**: Fixed double discriminator bug, improved optional account handling
