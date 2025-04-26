import { Connection } from "@solana/web3.js";
import { z } from "zod";
import { Keypair } from "@solana/web3.js";

export type MCPShape = {
  type: string;
  properties?: Record<string, MCPShape>;
  items?: MCPShape;
  enum?: string[];
  options?: MCPShape[];
  left?: MCPShape;
  right?: MCPShape;
  valueType?: MCPShape;
};

export interface MarketConfig {
  dex: "raydium" | "meteora" | "orca" | "pumpfun";
  markets: string[]; // Array of market addresses to watch
  interval: number; // Analysis interval in seconds
}

export interface MemoConfig {
  programId: string; // The deployed memo program ID
  interval: number; // Memo logging interval in seconds
}

export interface GudTekMCPConfig {
  name?: string;
  version?: string;
  wallet?: Keypair;
  debug?: boolean;
  connection: Connection;
  rpcEndpoint: string;
  mcp?: MCPConfig;
  marketConfig: MarketConfig;
  memoConfig: MemoConfig;
}

export interface AgentConfig {
  name: string;
  description: string;
  tools: string[];
  model: string;
  temperature?: number;
}

export interface ToolConfig {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  handler: (params: any, context: GudTekMCPContext) => Promise<any>;
}

export interface MCPConfig {
  name?: string;
  version?: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface GudTekMCPContext {
  connection: Connection;
  wallet?: Keypair;
  mcp?: MCPConfig;
}
