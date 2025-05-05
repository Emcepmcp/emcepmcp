import { EmcepMCPConfig, EmcepMCPContext } from "../types";
import { Tool } from "./tool";
import { MCPClient } from "../mcp";
import { EmcepMCP } from "./emcepmcp";
import { Logger } from "./logger";

export class Agent {
  private config: EmcepMCPConfig;
  private tools: Map<string, Tool>;
  private context: EmcepMCPContext;
  private mcpClient: MCPClient;
  private EmcepMCP: EmcepMCP;
  private logger: Logger;

  constructor(config: EmcepMCPConfig, EmcepMCP: EmcepMCP) {
    this.config = config;
    this.EmcepMCP = EmcepMCP;
    this.tools = new Map();
    this.context = {
      connection: config.connection,
      wallet: undefined,
      mcp: config.mcp
        ? {
            endpoint: config.mcp.endpoint,
            apiKey: config.mcp.apiKey,
            model: "gpt-4",
          }
        : undefined,
    };
    this.logger = new Logger("Agent");
    this.mcpClient = new MCPClient({
      name: "EmcepMCP-agent",
      version: config.version || "1.0.0",
    });
  }

  public async initialize(): Promise<void> {
    await this.mcpClient.registerTools(this.tools, this.EmcepMCP);
  }

  public registerTool(tool: Tool): void {
    this.tools.set(tool.getName(), tool);
  }

  public getTools(): Map<string, Tool> {
    return this.tools;
  }

  public getContext(): EmcepMCPContext {
    return this.context;
  }

  public async execute(input: string): Promise<string> {
    // If MCP is configured, the tools are already registered with the MCP server
    // The MCP server will handle tool execution through its stdio transport
    if (this.mcpClient) {
      return "MCP server is running and handling tool execution";
    }

    // If no MCP is configured, execute tools directly
    try {
      const inputObj = JSON.parse(input);
      const toolName = inputObj.tool;
      const params = inputObj.params || {};

      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      const result = await tool.execute(params, this.context);
      return JSON.stringify(result);
    } catch (error) {
      console.error("Error executing tool:", error);
      return JSON.stringify({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }
}
