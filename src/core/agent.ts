import { GudTekMCPConfig, GudTekMCPContext } from "../types";
import { Tool } from "./tool";
import { MCPClient } from "../mcp";
import { GudTekMCP } from "./gudtekmcp";

export class Agent {
  private config: GudTekMCPConfig;
  private tools: Map<string, Tool>;
  private context: GudTekMCPContext;
  private mcpClient?: MCPClient;
  private GudTekMCP: GudTekMCP;

  constructor(config: GudTekMCPConfig, GudTekMCP: GudTekMCP) {
    this.config = config;
    this.GudTekMCP = GudTekMCP;
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
  }

  public async initialize(): Promise<void> {
    // Initialize MCP client if endpoint is configured
    if (this.config.mcp) {
      this.mcpClient = new MCPClient({
        endpoint: this.config.mcp.endpoint,
        apiKey: this.config.mcp.apiKey,
        model: "gpt-4",
        name: "GudTekMCP-agent",
        version: "0.1.0",
      });
      await this.mcpClient.initialize();
      await this.mcpClient.registerTools(this.tools, this.GudTekMCP);
      await this.mcpClient.startServer();
    }
  }

  public registerTool(tool: Tool): void {
    this.tools.set(tool.getName(), tool);
  }

  public getTools(): Map<string, Tool> {
    return this.tools;
  }

  public getContext(): GudTekMCPContext {
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
