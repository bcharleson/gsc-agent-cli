import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { agentCommands } from '../commands/index.js';
import { GSCClient } from '../core/client.js';
import { CLI_VERSION } from '../core/version.js';

/**
 * Exposes every command in `agentCommands` as an MCP tool. The same
 * CommandDefinition that powers the CLI powers the agent here — one source of
 * truth, so a human and an AI agent see identical capabilities.
 */
export async function startMcpServer(): Promise<void> {
  // Lazy client: GSC auth resolves on first owned-property call, so key-based
  // tools (CrUX, PageSpeed Insights) work even without GSC credentials.
  const client = new GSCClient();

  const server = new McpServer({ name: 'gsc', version: CLI_VERSION });

  for (const cmdDef of agentCommands) {
    server.registerTool(
      cmdDef.name,
      {
        description: cmdDef.description,
        inputSchema: cmdDef.inputSchema.shape,
        annotations: { readOnlyHint: cmdDef.readOnly ?? false },
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await cmdDef.handler(args, client);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: error.message ?? String(error),
                  code: error.code ?? 'UNKNOWN_ERROR',
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GSC MCP server started. Tools registered:', agentCommands.length);
}
