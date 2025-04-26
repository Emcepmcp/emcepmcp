import {
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import { z } from "zod";
import { BaseTool } from "../../core/tool";
import { GudTekMCPContext } from "../../types";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

class TransferTool extends BaseTool {
  constructor() {
    super(
      "transfer",
      "Transfer SOL or SPL tokens to another wallet",
      z.object({
        to: z.string().describe("The recipient wallet address"),
        amount: z.number().positive().describe("The amount to transfer"),
        tokenAddress: z
          .string()
          .optional()
          .describe(
            "Optional SPL token mint address. If not provided, transfers SOL"
          ),
      })
    );
  }

  async execute(
    params: { to: string; amount: number; tokenAddress?: string },
    context: GudTekMCPContext
  ): Promise<any> {
    if (!context.wallet) {
      throw new Error("No wallet available in context");
    }

    const recipientAddress = new PublicKey(params.to);

    if (!params.tokenAddress) {
      // Transfer SOL
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: context.wallet.publicKey,
          toPubkey: recipientAddress,
          lamports: params.amount * LAMPORTS_PER_SOL,
        })
      );

      const signature = await context.connection.sendTransaction(
        transaction,
        []
      );
      return {
        signature,
        token: "SOL",
        amount: params.amount,
      };
    }

    // Transfer SPL token
    const tokenMint = new PublicKey(params.tokenAddress);
    const fromTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      context.wallet.publicKey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      recipientAddress
    );

    // Check if recipient token account exists
    const toTokenAccountInfo =
      await context.connection.getAccountInfo(toTokenAccount);

    const transaction = new Transaction();

    if (!toTokenAccountInfo) {
      // Create recipient token account if it doesn't exist
      transaction.add(
        createAssociatedTokenAccountInstruction(
          context.wallet.publicKey,
          toTokenAccount,
          recipientAddress,
          tokenMint
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        context.wallet.publicKey,
        params.amount
      )
    );

    const signature = await context.connection.sendTransaction(transaction, []);
    return {
      signature,
      token: params.tokenAddress,
      amount: params.amount,
    };
  }
}

export const transferTool = new TransferTool();
