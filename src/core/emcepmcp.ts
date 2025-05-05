import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  EmcepMCPConfig,
  EmcepMCPContext,
  AgentConfig,
  ToolConfig,
} from "../types";
import { Agent } from "./agent";
import { Tool, BaseTool } from "./tool";
import { z } from "zod";
import { Logger } from "../utils/logger";
import { MCPClient } from "../mcp";

/**
 * EmcepMCP is the main class that manages agents, tools, and the execution context.
 * It provides a framework for building and executing AI-powered analysis tools
 * on the Solana blockchain.
 */
export class EmcepMCP {
  private agents: Map<string, Agent>;
  private tools: Map<string, Tool>;
  private context: EmcepMCPContext;
  private logger: Logger;
  private config: EmcepMCPConfig;
  private marketAnalysisInterval?: NodeJS.Timeout;
  private memoLoggingInterval?: NodeJS.Timeout;

  /**
   * Creates a new EmcepMCP instance with the provided configuration.
   *
   * @param config - The configuration for the EmcepMCP instance
   */
  constructor(config: EmcepMCPConfig) {
    this.config = config;
    this.agents = new Map();
    this.tools = new Map();
    this.logger = new Logger("EmcepMCP");
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

    this.logger.info("EmcepMCP initialized with connection to Solana network");
  }

  /**
   * Creates a new agent with the specified configuration.
   *
   * @param config - The configuration for the agent
   * @returns The created agent
   */
  public createAgent(config: EmcepMCPConfig): Agent {
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
   * Registers a tool with the EmcepMCP instance.
   *
   * @param name - The name of the tool
   * @param tool - The tool instance to register
   */
  public registerTool(name: string, tool: Tool): void {
    this.tools.set(name, tool);
    this.logger.info(`Tool registered: ${name}`);
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
          context: EmcepMCPContext
        ) => Promise<any>;

        constructor(
          name: string,
          description: string,
          parameters: z.ZodType<any>,
          handler: (params: any, context: EmcepMCPContext) => Promise<any>
        ) {
          super(name, description, parameters);
          this.handler = handler;
        }

        public async execute(
          params: any,
          context: EmcepMCPContext
        ): Promise<any> {
          // Validate parameters against schema
          const validatedParams = this.parameters.parse(params);
          return this.handler(validatedParams, context);
        }
      })(config.name, config.description, config.parameters, config.handler);

      this.registerTool(config.name, tool);
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
  public getContext(): EmcepMCPContext {
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
   * @param name - The name of the tool to execute
   * @param params - The parameters for the tool
   * @returns The result of the tool execution
   */
  public async executeTool(name: string, params: any): Promise<any> {
    try {
      const tool = this.getTool(name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      this.logger.info(`Executing tool: ${name}`);
      const result = await tool.execute(params, this.context);
      this.logger.info(`Tool execution completed: ${name}`);
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