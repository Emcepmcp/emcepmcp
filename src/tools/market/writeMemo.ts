import {
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { z } from "zod";
import { BaseTool } from "../../core/tool";
import { GudTekMCPContext } from "../../types";

export const writeMemoTool = new (class extends BaseTool {
  constructor() {
    super(
      "writeMemo",
      "Write a memo to the on-chain memo program",
      z.object({
        programId: z.string().describe("The memo program ID"),
        content: z.string().describe("The memo content to write"),
      })
    );
  }

  async execute(
    params: { programId: string; content: string },
    context: GudTekMCPContext
  ): Promise<any> {
    if (!context.wallet) {
      throw new Error("No wallet available in context");
    }

    const programPubkey = new PublicKey(params.programId);

    // Generate a new keypair for the memo account
    const memoAccount = Keypair.generate();

    // Calculate required space for the memo
    const space = params.content.length + 8; // 8 bytes for the length prefix

    // Get minimum rent for the account
    const rentExemption =
      await context.connection.getMinimumBalanceForRentExemption(space);

    // Create a transaction to write the memo
    const transaction = new Transaction()
      .add(
        // Create the memo account
        SystemProgram.createAccount({
          fromPubkey: context.wallet.publicKey,
          newAccountPubkey: memoAccount.publicKey,
          lamports: rentExemption,
          space,
          programId: programPubkey,
        })
      )
      .add(
        // Write the memo content
        {
          keys: [
            { pubkey: memoAccount.publicKey, isSigner: true, isWritable: true },
            {
              pubkey: context.wallet.publicKey,
              isSigner: true,
              isWritable: false,
            },
          ],
          programId: programPubkey,
          data: Buffer.from(params.content),
        }
      );

    const signature = await context.connection.sendTransaction(transaction, [
      context.wallet,
      memoAccount,
    ]);

    return {
      signature,
      programId: params.programId,
      memoAccount: memoAccount.publicKey.toString(),
      content: params.content,
    };
  }
})();
