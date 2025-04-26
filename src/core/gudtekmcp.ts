import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  GudTekMCPConfig,
  GudTekMCPContext,
  AgentConfig,
  ToolConfig,
} from "../types";
import { Agent } from "./agent";
import { Tool, BaseTool } from "./tool";
import { z } from "zod";
import { Logger } from "../utils/logger";

/**
 * GudTekMCP is the main class that manages agents, tools, and the execution context.
 * It provides a unified interface for creating and managing agents, registering tools,
 * and executing operations on the Solana blockchain.
 */
export class GudTekMCP {
  private agents: Map<string, Agent>;
  private tools: Map<string, Tool>;
  private context: GudTekMCPContext;
  private logger: Logger;
  private config: GudTekMCPConfig;
  private marketAnalysisInterval?: NodeJS.Timeout;
  private memoLoggingInterval?: NodeJS.Timeout;

  /**
   * Creates a new GudTekMCP instance with the provided configuration.
   *
   * @param config - The configuration for the GudTekMCP instance
   */
  constructor(config: GudTekMCPConfig) {
    this.config = config;
    this.agents = new Map();
    this.tools = new Map();
    this.logger = new Logger("GudTekMCP");
    this.context = {
      connection: config.connection,
      wallet: config.wallet,
      mcp: config.mcp
        ? {
            endpoint: config.mcp.endpoint,
            apiKey: config.mcp.apiKey,
            model: "gpt-4",
          }
        : undefined,
    };

    this.logger.info("GudTekMCP initialized with connection to Solana network");
  }

  /**
   * Creates a new agent with the specified configuration.
   *
   * @param config - The configuration for the agent
   * @returns The created agent
   */
  public createAgent(config: GudTekMCPConfig): Agent {
    try {
      const agent = new Agent(config, this);
      this.agents.set(config.name || `agent-${this.agents.size}`, agent);
      this.logger.info(
        `Created agent: ${config.name || `agent-${this.agents.size}`}`
      );
      return agent;
    } catch (error) {
      this.logger.error(
        `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Gets an agent by name.
   *
   * @param name - The name of the agent to retrieve
   * @returns The agent, or undefined if not found
   */
  public getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * Gets all registered agents.
   *
   * @returns A map of all registered agents
   */
  public getAgents(): Map<string, Agent> {
    return this.agents;
  }

  /**
   * Registers a tool with the GudTekMCP instance.
   *
   * @param tool - The tool to register
   */
  public registerTool(tool: Tool): void {
    this.tools.set(tool.getName(), tool);
    this.logger.info(`Tool registered: ${tool.getName()}`);
  }

  /**
   * Creates and registers a tool from a configuration.
   *
   * @param config - The tool configuration
   * @returns The created tool
   */
  public createTool(config: ToolConfig): Tool {
    try {
      const tool = new (class extends BaseTool {
        private handler: (
          params: any,
          context: GudTekMCPContext
        ) => Promise<any>;

        constructor(
          name: string,
          description: string,
          parameters: z.ZodType<any>,
          handler: (params: any, context: GudTekMCPContext) => Promise<any>
        ) {
          super(name, description, parameters);
          this.handler = handler;
        }

        public async execute(
          params: any,
          context: GudTekMCPContext
        ): Promise<any> {
          // Validate parameters against schema
          const validatedParams = this.parameters.parse(params);
          return this.handler(validatedParams, context);
        }
      })(config.name, config.description, config.parameters, config.handler);

      this.registerTool(tool);
      return tool;
    } catch (error) {
      this.logger.error(
        `Failed to create tool: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Gets a tool by name.
   *
   * @param name - The name of the tool to retrieve
   * @returns The tool, or undefined if not found
   */
  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Gets all registered tools.
   *
   * @returns A map of all registered tools
   */
  public getTools(): Map<string, Tool> {
    return this.tools;
  }

  /**
   * Gets the execution context.
   *
   * @returns The execution context
   */
  public getContext(): GudTekMCPContext {
    return this.context;
  }

  /**
   * Sets the wallet for the execution context.
   *
   * @param wallet - The wallet to set
   */
  public setWallet(wallet: Keypair): void {
    this.context.wallet = wallet;
    this.logger.info(`Wallet set to: ${wallet.publicKey.toBase58()}`);
  }

  /**
   * Gets the wallet from the execution context.
   *
   * @returns The wallet, or undefined if not set
   */
  public getWallet(): Keypair | undefined {
    return this.context.wallet;
  }

  /**
   * Gets the Solana connection.
   *
   * @returns The Solana connection
   */
  public getConnection(): Connection {
    return this.context.connection;
  }

  /**
   * Executes a tool with the specified parameters.
   *
   * @param toolName - The name of the tool to execute
   * @param params - The parameters for the tool
   * @returns The result of the tool execution
   */
  public async executeTool(toolName: string, params: any): Promise<any> {
    try {
      const tool = this.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      this.logger.info(`Executing tool: ${toolName}`);
      const result = await tool.execute(params, this.context);
      this.logger.info(`Tool execution completed: ${toolName}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Initializes all agents.
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing all agents");
      for (const agent of this.agents.values()) {
        await agent.initialize();
      }
      this.logger.info("All agents initialized");
    } catch (error) {
      this.logger.error(
        `Failed to initialize agents: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Starts the market analysis process
   */
  public async startMarketAnalysis(): Promise<void> {
    if (this.marketAnalysisInterval) {
      this.logger.warn("Market analysis is already running");
      return;
    }

    this.logger.info("Starting market analysis");

    // Initial analysis
    await this.analyzeMarkets();

    // Set up interval for periodic analysis
    this.marketAnalysisInterval = setInterval(
      () => this.analyzeMarkets(),
      this.config.marketConfig.interval * 1000
    );
  }

  /**
   * Stops the market analysis process
   */
  public stopMarketAnalysis(): void {
    if (this.marketAnalysisInterval) {
      clearInterval(this.marketAnalysisInterval);
      this.marketAnalysisInterval = undefined;
      this.logger.info("Stopped market analysis");
    }
  }

  /**
   * Analyzes all configured markets
   */
  private async analyzeMarkets(): Promise<void> {
    try {
      const { dex, markets } = this.config.marketConfig;

      for (const marketAddress of markets) {
        const analysis = await this.executeTool("analyzeMarket", {
          dex,
          marketAddress,
        });

        // Write memo with analysis results
        await this.executeTool("writeMemo", {
          programId: this.config.memoConfig.programId,
          content: JSON.stringify(analysis),
        });
      }
    } catch (error) {
      this.logger.error(
        `Market analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Starts the memo logging process
   */
  public async startMemoLogging(): Promise<void> {
    if (this.memoLoggingInterval) {
      this.logger.warn("Memo logging is already running");
      return;
    }

    this.logger.info("Starting memo logging");

    // Initial logging
    await this.logMemo();

    // Set up interval for periodic logging
    this.memoLoggingInterval = setInterval(
      () => this.logMemo(),
      this.config.memoConfig.interval * 1000
    );
  }

  /**
   * Stops the memo logging process
   */
  public stopMemoLogging(): void {
    if (this.memoLoggingInterval) {
      clearInterval(this.memoLoggingInterval);
      this.memoLoggingInterval = undefined;
      this.logger.info("Stopped memo logging");
    }
  }

  /**
   * Logs a memo with current market analysis
   */
  private async logMemo(): Promise<void> {
    try {
      const analysis = await this.analyzeMarkets();
      await this.executeTool("writeMemo", {
        programId: this.config.memoConfig.programId,
        content: JSON.stringify(analysis),
      });
    } catch (error) {
      this.logger.error(
        `Memo logging failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
