import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { z } from "zod";
import { BaseTool } from "../../core/tool";
import { GudTekMCPContext } from "../../types";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";

class GetTokenBalancesTool extends BaseTool {
  constructor() {
    super(
      "getTokenBalances",
      "Get all token balances (including SOL) for a given wallet address",
      z.object({
        address: z.string().describe("The wallet address to check"),
      })
    );
  }

  async execute(
    params: { address: string },
    context: GudTekMCPContext
  ): Promise<any> {
    const walletAddress = new PublicKey(params.address);

    // Get SOL balance
    const solBalance = await context.connection.getBalance(walletAddress);

    // Get all token accounts
    const tokenAccounts = await context.connection.getTokenAccountsByOwner(
      walletAddress,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );

    // Process token balances
    const tokenBalances = await Promise.all(
      tokenAccounts.value.map(async (tokenAccount) => {
        const accountData = AccountLayout.decode(tokenAccount.account.data);
        const mint = new PublicKey(accountData.mint);
        const amount = accountData.amount;

        // Get token metadata if available
        let name = mint.toString();
        let symbol = "UNKNOWN";
        let decimals = 0;

        try {
          const tokenInfo = await context.connection.getParsedAccountInfo(mint);
          if (tokenInfo.value?.data) {
            const data = tokenInfo.value.data as any;
            if (data.parsed?.type === "mint") {
              decimals = data.parsed.info.decimals;
              name = data.parsed.info.name || name;
              symbol = data.parsed.info.symbol || symbol;
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch metadata for token ${mint.toString()}`);
        }

        return {
          tokenAddress: mint.toString(),
          name,
          symbol,
          balance: Number(amount) / Math.pow(10, decimals),
          decimals,
        };
      })
    );

    return {
      sol: solBalance / LAMPORTS_PER_SOL,
      tokens: tokenBalances,
    };
  }
}

export const getTokenBalancesTool = new GetTokenBalancesTool();
