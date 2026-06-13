import { Command } from 'commander';
import { startMcpServer } from '../../mcp/server.js';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the MCP server (stdio) for AI assistant integration (Claude, Cursor, VS Code).')
    .addHelpText(
      'after',
      `
MCP Configuration:

  Service account (recommended for agents):
  {
    "mcpServers": {
      "gsc": {
        "command": "npx",
        "args": ["gsc-agent-cli", "mcp"],
        "env": { "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json" }
      }
    }
  }

  Or if installed globally and logged in via OAuth:
  {
    "mcpServers": {
      "gsc": { "command": "gsc", "args": ["mcp"] }
    }
  }`,
    )
    .action(async () => {
      process.on('SIGINT', () => process.exit(0));
      process.on('SIGTERM', () => process.exit(0));
      try {
        await startMcpServer();
      } catch (error: any) {
        console.error('Failed to start MCP server:', error.message ?? error);
        process.exit(1);
      }
    });
}
