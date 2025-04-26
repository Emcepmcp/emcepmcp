export interface MCPRequest {
  input: string;
  tools?: string[];
  model?: string;
}

export interface MCPResponse {
  output: string;
  toolCalls?: MCPToolCall[];
}

export interface MCPToolCall {
  name: string;
  parameters: Record<string, any>;
} 