import {
    argumentValueNode,
    instructionAccountNode,
    instructionArgumentNode,
    instructionNode,
    instructionRemainingAccountsNode,
    numberTypeNode,
} from '@codama/nodes';
import { expect, test } from 'vitest';

import { getInstructionFunctionFragment } from '../../src/fragments/instructionFunction-v2';
import { getBorshSchemaVisitor, getTypeVisitor } from '../../src/visitors';

test('it generates instruction with accounts and args', () => {
    const node = instructionNode({
        accounts: [
            instructionAccountNode({ isSigner: false, isWritable: true, name: 'from' }),
            instructionAccountNode({ isSigner: false, isWritable: true, name: 'to' }),
            instructionAccountNode({ isSigner: true, isWritable: false, name: 'authority' }),
        ],
        arguments: [instructionArgumentNode({ name: 'amount', type: numberTypeNode('u64') })],
        name: 'transfer',
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    expect(result.content).toContain('export interface TransferInstructionAccounts');
    expect(result.content).toContain('from: PublicKey');
    expect(result.content).toContain('to: PublicKey');
    expect(result.content).toContain('authority: PublicKey');
    expect(result.content).toContain('export interface TransferInstructionArgs');
    expect(result.content).toContain('amount: bigint');
    expect(result.content).toContain('const TransferInstructionDataCodec');
    expect(result.content).toContain('export function createTransferInstruction');
    expect(result.content).toContain('accounts: TransferInstructionAccounts');
    expect(result.content).toContain('args: TransferInstructionArgs');
    expect(result.content).toContain('programId: PublicKey = DUMMYPRG_PROGRAM_ID');
    expect(result.content).toContain("import { DUMMYPRG_PROGRAM_ID } from '..';");
    expect(result.content).toContain('TransactionInstruction');
    expect(result.content).toContain('const keys: AccountMeta[]');
    expect(result.content).toContain('isSigner: false, isWritable: true'); // from and to
    expect(result.content).toContain('isSigner: true, isWritable: false'); // authority
    expect(result.content).toContain('Buffer.from(TransferInstructionDataCodec.encode(args))');

    // Check imports in content (getCodeFileFragment bakes imports into content)
    expect(result.content).toContain('import {');
    expect(result.content).toContain('PublicKey');
    expect(result.content).toContain('TransactionInstruction');
    expect(result.content).toContain('AccountMeta');
});

test('it generates instruction with no arguments', () => {
    const node = instructionNode({
        accounts: [instructionAccountNode({ isSigner: false, isWritable: true, name: 'account' })],
        arguments: [],
        name: 'initialize',
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    expect(result.content).toContain('export interface InitializeInstructionAccounts');
    expect(result.content).not.toContain('InstructionArgs');
    expect(result.content).not.toContain('InstructionDataSchema');
    expect(result.content).toContain('export function createInitializeInstruction');
    expect(result.content).toContain(
        'accounts: InitializeInstructionAccounts, programId: PublicKey = DUMMYPRG_PROGRAM_ID',
    );
    expect(result.content).toContain('Buffer.alloc(0)'); // Empty buffer for no args
});

test('it generates instruction with no accounts', () => {
    const node = instructionNode({
        accounts: [],
        arguments: [instructionArgumentNode({ name: 'message', type: numberTypeNode('u32') })],
        name: 'log',
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    expect(result.content).not.toContain('InstructionAccounts');
    expect(result.content).toContain('export interface LogInstructionArgs');
    expect(result.content).toContain('const LogInstructionDataCodec');
    expect(result.content).toContain('export function createLogInstruction');
    expect(result.content).toContain('args: LogInstructionArgs, programId: PublicKey = DUMMYPRG_PROGRAM_ID');
    expect(result.content).toContain('const keys: AccountMeta[] = []');
    expect(result.content).toContain('Buffer.from(LogInstructionDataCodec.encode(args))');
});

test('it handles optional accounts', () => {
    const node = instructionNode({
        accounts: [
            instructionAccountNode({ isSigner: false, isWritable: false, name: 'source' }),
            instructionAccountNode({ isOptional: true, isSigner: false, isWritable: false, name: 'delegate' }),
        ],
        arguments: [],
        name: 'approve',
        optionalAccountStrategy: 'omitted',
    });

    const result = getInstructionFunctionFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('source: PublicKey');
    expect(result.content).toContain('delegate?: PublicKey'); // Optional in interface
    expect(result.content).toContain('...(accounts.delegate ? ['); // Spread operator pattern
});

test('it preserves non-trailing optional account order with program id placeholders', () => {
    const node = instructionNode({
        accounts: [
            instructionAccountNode({ isSigner: false, isWritable: false, name: 'source' }),
            instructionAccountNode({ isOptional: true, isSigner: false, isWritable: true, name: 'delegate' }),
            instructionAccountNode({ isSigner: true, isWritable: false, name: 'authority' }),
        ],
        arguments: [],
        name: 'approve',
        optionalAccountStrategy: 'programId',
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    const sourceIndex = result.content.indexOf('{ pubkey: accounts.source');
    const delegateIndex = result.content.indexOf('accounts.delegate');
    const authorityIndex = result.content.indexOf('{ pubkey: accounts.authority');

    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    expect(delegateIndex).toBeGreaterThan(sourceIndex);
    expect(delegateIndex).toBeLessThan(authorityIndex);
    expect(result.content).toContain(': { pubkey: programId, isSigner: false, isWritable: false }');
    expect(result.content).not.toContain('...(accounts.delegate ? [');
});

test('it generates remaining account inputs when remaining accounts are argument-based', () => {
    const node = instructionNode({
        accounts: [],
        arguments: [instructionArgumentNode({ name: 'memo', type: numberTypeNode('u32') })],
        name: 'addMemo',
        remainingAccounts: [
            instructionRemainingAccountsNode(argumentValueNode('signers'), {
                isOptional: true,
                isSigner: true,
                isWritable: false,
            }),
        ],
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    expect(result.content).toContain('signers?: Array<Keypair>;');
    expect(result.content).toContain('args: AddMemoInstructionArgs, programId: PublicKey = DUMMYPRG_PROGRAM_ID');
    expect(result.content).toContain('keys.push(...(args.signers ?? []).map((signer) => ({');
    expect(result.content).toContain('pubkey: signer.publicKey');
    expect(result.content).toContain('isSigner: true');
});

test('it generates correct semicolons for multiple remaining account fields', () => {
    const node = instructionNode({
        accounts: [],
        arguments: [],
        name: 'multiRemaining',
        remainingAccounts: [
            instructionRemainingAccountsNode(argumentValueNode('signers'), {
                isOptional: true,
                isSigner: true,
                isWritable: false,
            }),
            instructionRemainingAccountsNode(argumentValueNode('accounts'), {
                isOptional: false,
                isSigner: false,
                isWritable: true,
            }),
        ],
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    // Each field must have its own semicolon (not just one at the end)
    expect(result.content).toContain('signers?: Array<Keypair>;');
    expect(result.content).toContain('accounts: Array<PublicKey>;');
});

test('it skips remaining accounts when name matches existing instruction argument', () => {
    const node = instructionNode({
        accounts: [],
        arguments: [instructionArgumentNode({ name: 'signers', type: numberTypeNode('u32') })],
        name: 'duplicateArg',
        remainingAccounts: [
            instructionRemainingAccountsNode(argumentValueNode('signers'), {
                isOptional: true,
                isSigner: true,
                isWritable: false,
            }),
        ],
    });

    const result = getInstructionFunctionFragment(
        node,
        getTypeVisitor(),
        getBorshSchemaVisitor(),
        [],
        'DUMMYPRG_PROGRAM_ID',
    );

    // Should NOT generate keys.push for signers from remaining accounts (would duplicate)
    expect(result.content).not.toContain('keys.push(...(args.signers');
});
