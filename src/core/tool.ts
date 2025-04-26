import { z } from "zod";
import { GudTekMCPContext } from "../types";

export interface Tool {
  name: string;
  description: string;
  getSchema(): z.ZodType<any>;
  execute(params: any, context: GudTekMCPContext): Promise<any>;
  getName(): string;
}

export class BaseTool implements Tool {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly parameters: z.ZodType<any>
  ) {}

  public getSchema(): z.ZodType<any> {
    return this.parameters;
  }

  public async execute(params: any, context: GudTekMCPContext): Promise<any> {
    throw new Error("execute method must be implemented by subclasses");
  }

  public getName(): string {
    return this.name;
  }
}
