/**
 * @file mcp-server.ts
 * @brief The Railway Drawer MCP server (official SDK `@modelcontextprotocol/server`): the same
 *        tools as the in-app chat (tool-defs.ts), each input validated against its JSON Schema,
 *        executed by `execute` (remote: relayed to the paired browser tab by the Worker's Durable
 *        Object; local: by the Node server's bridge or its headless .drawio mode). Used by
 *        worker/index.ts and tools/mcp-local; never part of the browser bundle.
 */
import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult, StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import type { RelayCallResult } from '../bridge/relay';
import { checkInput } from '../schema-check';
import type { ToolSchema } from '../schema-check';
import { buildSystemPrompt } from '../system-prompt';
import { AI_TOOLS } from '../tool-defs';

export const MCP_SERVER_NAME = 'railway-drawer';

export type McpExecutor = (tool: string, input: Record<string, unknown>) => Promise<RelayCallResult>;

/** A JSON Schema as a Standard Schema (validation by schema-check.ts, JSON Schema advertised as is). */
export function jsonSchemaInput(schema: ToolSchema): StandardSchemaWithJSON<Record<string, unknown>> {
  return {
    '~standard': {
      version: 1,
      vendor: 'railway-drawer',
      validate(value: unknown) {
        const problems = checkInput(value ?? {}, schema);
        if (problems.length === 0) return { value: (value ?? {}) as Record<string, unknown> };
        return { issues: problems.map((p) => ({ message: `${p.path || 'input'} ${p.message}`, path: p.path ? p.path.split(/[.[\]]+/).filter(Boolean) : [] })) };
      },
      jsonSchema: {
        input: () => schema,
        output: () => schema,
      },
    },
  } as StandardSchemaWithJSON<Record<string, unknown>>;
}

/** MCP result of a relayed call (text JSON, plus the PNG for png exports). */
export function toCallToolResult(r: RelayCallResult): CallToolResult {
  const content: CallToolResult['content'] = [{ type: 'text', text: JSON.stringify(r.result ?? null) }];
  if (r.image) content.push({ type: 'image', data: r.image.data, mimeType: r.image.mediaType });
  return { content, ...(r.ok ? {} : { isError: true }) };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export function createRailwayMcpServer(execute: McpExecutor, version = '1'): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version }, { instructions: buildSystemPrompt() });
  for (const def of AI_TOOLS) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: jsonSchemaInput(def.input_schema),
        annotations: {
          title: def.title,
          readOnlyHint: !def.mutating,
          destructiveHint: def.name === 'delete_cells' || def.name === 'apply_railway_script',
          idempotentHint: def.name === 'apply_railway_script',
          openWorldHint: false,
        },
      },
      async (args: Record<string, unknown>) => {
        try {
          return toCallToolResult(await execute(def.name, args));
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : String(error));
        }
      }
    );
  }
  return server;
}
