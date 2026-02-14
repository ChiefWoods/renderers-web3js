import { AccountMeta, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { BN } from 'bn.js';
import { publicKey, struct } from '@coral-xyz/borsh';

export interface AssignInstructionAccounts {
    account: PublicKey;
}

export interface AssignInstructionArgs {
    programAddress: PublicKey;
}

const AssignInstructionDataSchema = struct([publicKey("programAddress")]);

export function createAssignInstruction(accounts: AssignInstructionAccounts, args: AssignInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: true, isWritable: true },
    ];
    const mapBigIntToBn = (value: unknown): unknown => {
        if (typeof value === 'bigint') return new BN(value.toString());
        if (Array.isArray(value)) return value.map(mapBigIntToBn);
        if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, mapBigIntToBn(nested)])
            );
        }
        return value;
    };
    const borshArgs = mapBigIntToBn(args);
    const buffer = Buffer.alloc(1000);
    AssignInstructionDataSchema.encode(borshArgs as Record<string, unknown>, buffer);
    const instructionData = buffer.subarray(0, AssignInstructionDataSchema.getSpan(buffer));
    const discriminator = Buffer.alloc(4);
    discriminator.writeUInt32LE(Number(1), 0);
    const data = Buffer.concat([discriminator, instructionData]);
    
    return new TransactionInstruction({ keys, programId, data });
    }