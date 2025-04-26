import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { z } from "zod";
import { BaseTool } from "../../core/tool";
import { GudTekMCPContext } from "../../types";

class GetBalanceTool extends BaseTool {
  constructor() {
    super(
      "getBalance",
      "Get the balance of SOL or an SPL token for a given wallet address",
      z.object({
        address: z.string().describe("The wallet address to check"),
        tokenAddress: z
          .string()
          .optional()
          .describe("Optional SPL token mint address"),
      })
    );
  }

  async execute(
    params: { address: string; tokenAddress?: string },
    context: GudTekMCPContext
  ): Promise<any> {
    const walletAddress = new PublicKey(params.address);

    if (!params.tokenAddress) {
      // Get SOL balance
      const balance = await context.connection.getBalance(walletAddress);
      return {
        balance: balance / LAMPORTS_PER_SOL,
        token: "SOL",
      };
    }

    // Get SPL token balance
    const tokenAddress = new PublicKey(params.tokenAddress);
    const tokenAccounts = await context.connection.getTokenAccountsByOwner(
      walletAddress,
      {
        mint: tokenAddress,
      }
    );

    if (tokenAccounts.value.length === 0) {
      return {
        balance: 0,
        token: params.tokenAddress,
      };
    }

    const tokenAccount = await context.connection.getTokenAccountBalance(
      tokenAccounts.value[0].pubkey
    );
    return {
      balance: tokenAccount.value.uiAmount || 0,
      token: params.tokenAddress,
    };
  }
}

export const getBalanceTool = new GetBalanceTool();
