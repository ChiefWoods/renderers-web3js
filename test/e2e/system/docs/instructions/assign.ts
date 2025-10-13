import { AccountMeta, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { publicKey, serialize, struct, u32 } from '@coral-xyz/borsh';

export interface AssignInstructionAccounts {
    account: PublicKey;
}

export interface AssignInstructionArgs {
    programAddress: PublicKey;
}

const AssignInstructionDataSchema = struct([['discriminator', u32()], ['programAddress', publicKey()]]);

export function createAssignInstruction(accounts: AssignInstructionAccounts, args: AssignInstructionArgs, programId: PublicKey): TransactionInstruction {
    const keys: AccountMeta[] = [
        { pubkey: accounts.account, isSigner: true, isWritable: true },
    ];
    const data = Buffer.from(serialize(AssignInstructionDataSchema, { discriminator: undefined, ...args }));
    
    return new TransactionInstruction({ keys, programId, data });
}