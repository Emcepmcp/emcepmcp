import { MCPConfig } from "../types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Tool } from "../core/tool";
import { GudTekMCP } from "../core/gudtekmcp";
import { z } from "zod";
import { zodToMCPShape } from "../utils/zodToMCPShape";

type MCPToolResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
};

export class MCPClient {
  private config: MCPConfig;
  private server?: McpServer;
  private registeredTools: string[] = [];

  constructor(config: MCPConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    // Initialize MCP client
    this.server = new McpServer({
      name: this.config.name || "GudTekMCP-mcp",
      version: this.config.version || "0.1.0",
    });
  }

  public async registerTools(
    tools: Map<string, Tool>,
    GudTekMCP: GudTekMCP
  ): Promise<void> {
    if (!this.server) {
      throw new Error("MCP client not initialized");
    }

    for (const [name, tool] of tools.entries()) {
      // Convert Zod schema to MCP shape
      const { result } = zodToMCPShape(tool.getSchema());

      this.server.tool(name, tool.description, result, async (params) => {
        try {
          // Execute the tool with the context from the GudTekMCP instance
          const result = await tool.execute(params, GudTekMCP.getContext());
          const response: MCPToolResponse = {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
          return response;
        } catch (error) {
          console.error("Error executing tool:", error);
          const response: MCPToolResponse = {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  error instanceof Error
                    ? error.message
                    : "Unknown error occurred",
              },
            ],
          };
          return response;
        }
      });

      this.registeredTools.push(name);
    }
  }

  public async startServer(): Promise<void> {
    if (!this.server) {
      throw new Error("MCP client not initialized");
    }

    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log("MCP server started successfully");
      console.log(`Registered tools: ${this.registeredTools.join(", ")}`);
    } catch (error) {
      console.error("Error starting MCP server:", error);
      throw error;
    }
  }

  public getRegisteredTools(): string[] {
    return this.registeredTools;
  }
}

export * from "./types";
