import { z } from "zod";

// Define the raw shape type that MCP tools expect
export type MCPSchemaShape = {
  [key: string]: z.ZodType<any>;
};

export type MCPShape = {
  result: MCPSchemaShape;
  keys: string[];
};

// Type guards for Zod schema types
function isZodOptional(schema: z.ZodTypeAny): schema is z.ZodOptional<any> {
  return schema instanceof z.ZodOptional;
}

function isZodObject(schema: z.ZodTypeAny): schema is z.ZodObject<any> {
  // Check both instanceof and the typeName property
  return (
    schema instanceof z.ZodObject || schema?._def?.typeName === "ZodObject"
  );
}

/**
 * Converts a Zod schema to an MCP shape
 * @param schema The Zod schema to convert
 * @returns An object with the MCP shape
 */
export function zodToMCPShape(schema: z.ZodType): MCPShape {
  if (!isZodObject(schema)) {
    throw new Error("MCP tools require an object schema at the top level");
  }

  const shape = schema.shape;
  const result: MCPSchemaShape = {};

  for (const [key, value] of Object.entries(shape)) {
    result[key] = isZodOptional(value as any) ? (value as any).unwrap() : value;
  }

  return {
    result,
    keys: Object.keys(result),
  };
}
