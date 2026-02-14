import {
    instructionArgumentNode,
    instructionNode,
    instructionAccountNode,
    numberTypeNode,
    publicKeyTypeNode,
} from '@codama/nodes';
import { expect, test } from 'vitest';

import { getInstructionFunctionFragment } from '../../src/fragments/instructionFunction-v2';
import { getBorshSchemaVisitor, getTypeVisitor } from '../../src/visitors';

test('it generates instruction with accounts and args', () => {
    const node = instructionNode({
        name: 'transfer',
        accounts: [
            instructionAccountNode({ name: 'from', isSigner: false, isWritable: true }),
            instructionAccountNode({ name: 'to', isSigner: false, isWritable: true }),
            instructionAccountNode({ name: 'authority', isSigner: true, isWritable: false }),
        ],
        arguments: [instructionArgumentNode({ name: 'amount', type: numberTypeNode('u64') })],
    });

    const result = getInstructionFunctionFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export interface TransferInstructionAccounts');
    expect(result.content).toContain('from: PublicKey');
    expect(result.content).toContain('to: PublicKey');
    expect(result.content).toContain('authority: PublicKey');
    expect(result.content).toContain('export interface TransferInstructionArgs');
    expect(result.content).toContain('amount: bigint');
    expect(result.content).toContain('const TransferInstructionDataSchema');
    expect(result.content).toContain('export function createTransferInstruction');
    expect(result.content).toContain('accounts: TransferInstructionAccounts');
    expect(result.content).toContain('args: TransferInstructionArgs');
    expect(result.content).toContain('programId: PublicKey');
    expect(result.content).toContain('TransactionInstruction');
    expect(result.content).toContain('const keys: AccountMeta[]');
    expect(result.content).toContain('isSigner: false, isWritable: true'); // from and to
    expect(result.content).toContain('isSigner: true, isWritable: false'); // authority
    expect(result.content).toContain('TransferInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer)');
    expect(result.content).toContain('TransferInstructionDataSchema.getSpan(buffer)');

    // Check imports in content (getCodeFileFragment bakes imports into content)
    expect(result.content).toContain("import {");
    expect(result.content).toContain("PublicKey");
    expect(result.content).toContain("TransactionInstruction");
    expect(result.content).toContain("AccountMeta");
});

test('it generates instruction with no arguments', () => {
    const node = instructionNode({
        name: 'initialize',
        accounts: [instructionAccountNode({ name: 'account', isSigner: false, isWritable: true })],
        arguments: [],
    });

    const result = getInstructionFunctionFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('export interface InitializeInstructionAccounts');
    expect(result.content).not.toContain('InstructionArgs');
    expect(result.content).not.toContain('InstructionDataSchema');
    expect(result.content).toContain('export function createInitializeInstruction');
    expect(result.content).toContain('accounts: InitializeInstructionAccounts, programId: PublicKey');
    expect(result.content).toContain('Buffer.alloc(0)'); // Empty buffer for no args
});

test('it generates instruction with no accounts', () => {
    const node = instructionNode({
        name: 'log',
        accounts: [],
        arguments: [instructionArgumentNode({ name: 'message', type: numberTypeNode('u32') })],
    });

    const result = getInstructionFunctionFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).not.toContain('InstructionAccounts');
    expect(result.content).toContain('export interface LogInstructionArgs');
    expect(result.content).toContain('const LogInstructionDataSchema');
    expect(result.content).toContain('export function createLogInstruction');
    expect(result.content).toContain('args: LogInstructionArgs, programId: PublicKey');
    expect(result.content).toContain('const keys: AccountMeta[] = []');
    expect(result.content).toContain('LogInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer)');
    expect(result.content).toContain('LogInstructionDataSchema.getSpan(buffer)');
});

test('it handles optional accounts', () => {
    const node = instructionNode({
        name: 'approve',
        accounts: [
            instructionAccountNode({ name: 'source', isSigner: false, isWritable: false }),
            instructionAccountNode({ name: 'delegate', isSigner: false, isWritable: false, isOptional: true }),
        ],
        arguments: [],
    });

    const result = getInstructionFunctionFragment(node, getTypeVisitor(), getBorshSchemaVisitor());

    expect(result.content).toContain('source: PublicKey');
    expect(result.content).toContain('delegate?: PublicKey'); // Optional in interface
    expect(result.content).toContain('...(accounts.delegate ? ['); // Spread operator pattern
});
