import express from "express";
import { GudTekMCP } from "./src";
import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize GudTekMCP
const gudTekMCP = new GudTekMCP({
  connection: new Connection(
    process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com"
  ),
  rpcEndpoint:
    process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com",
  mcp: process.env.MCP_ENDPOINT
    ? {
        endpoint: process.env.MCP_ENDPOINT,
        apiKey: process.env.MCP_API_KEY || "",
        model: "gpt-4",
      }
    : undefined,
  marketConfig: {
    dex: "raydium",
    markets: [], // Will be populated based on token
    interval: 60,
  },
  memoConfig: {
    programId: process.env.MEMO_PROGRAM_ID || "",
    interval: 300,
  },
});

// API Endpoints
app.post("/api/analyze-token", async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    console.log(req.body);

    if (!tokenAddress) {
      return res.status(400).json({ error: "Token address is required" });
    }

    // Create a new agent for this analysis
    const agent = gudTekMCP.createAgent({
      name: "token-analyzer",
      connection: gudTekMCP.getConnection(),
      rpcEndpoint:
        process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com",
      mcp: process.env.MCP_ENDPOINT
        ? {
            endpoint: process.env.MCP_ENDPOINT,
            apiKey: process.env.MCP_API_KEY || "",
            model: "gpt-4",
          }
        : undefined,
      marketConfig: {
        dex: "raydium",
        markets: [tokenAddress],
        interval: 60,
      },
      memoConfig: {
        programId: process.env.MEMO_PROGRAM_ID || "",
        interval: 300,
      },
    });

    // Initialize the agent
    await agent.initialize();

    // Execute the analysis
    const result = await agent.execute(
      `Analyze token ${tokenAddress} on Raydium`
    );

    res.json({
      success: true,
      analysis: result,
    });
  } catch (error) {
    console.error("Analysis failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
