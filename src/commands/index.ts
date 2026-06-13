import { Command } from 'commander';
import type { CommandDefinition, GlobalOptions } from '../core/types.js';
import { GSCClient } from '../core/client.js';
import { output, outputError } from '../core/output.js';
import { formatInputValidationError, normalizeGlobalOptions } from '../core/validation.js';

// Special commands (no API client needed at registration time)
import { registerLoginCommand } from './auth/login.js';
import { registerLogoutCommand } from './auth/logout.js';
import { registerStatusCommand } from './auth/status.js';
import { registerConfigCommand } from './config.js';
import { registerMcpCommand } from './mcp/index.js';

// Command definitions — the single source of truth for CLI + MCP
import { sitesListCommand } from './sites/list.js';
import { sitesGetCommand } from './sites/get.js';
import { sitesAddCommand } from './sites/add.js';
import { sitesDeleteCommand } from './sites/delete.js';
import { sitemapsListCommand } from './sitemaps/list.js';
import { sitemapsGetCommand } from './sitemaps/get.js';
import { sitemapsSubmitCommand } from './sitemaps/submit.js';
import { sitemapsDeleteCommand } from './sitemaps/delete.js';
import { searchAnalyticsQueryCommand } from './search-analytics/query.js';
import { topQueriesCommand } from './search-analytics/top-queries.js';
import { topPagesCommand } from './search-analytics/top-pages.js';
import { inspectUrlCommand } from './inspect/url.js';
import { indexingReportCommand } from './indexing/report.js';
import { cruxQueryCommand } from './crux/query.js';
import { pagespeedRunCommand } from './pagespeed/run.js';
import { snapshotSiteCommand } from './snapshot/site.js';

/** Every API-backed command. Iterated by both the CLI and the MCP server. */
export const allCommands: CommandDefinition[] = [
  // Sites
  sitesListCommand,
  sitesGetCommand,
  sitesAddCommand,
  sitesDeleteCommand,
  // Sitemaps
  sitemapsListCommand,
  sitemapsGetCommand,
  sitemapsSubmitCommand,
  sitemapsDeleteCommand,
  // Search analytics
  searchAnalyticsQueryCommand,
  topQueriesCommand,
  topPagesCommand,
  // URL inspection
  inspectUrlCommand,
  // Composite indexing report
  indexingReportCommand,
  // Outside GSC: real-user + lab performance
  cruxQueryCommand,
  pagespeedRunCommand,
  // Holistic composite
  snapshotSiteCommand,
];

/** Commands exposed to MCP agents. */
export const agentCommands: CommandDefinition[] = allCommands;

export function registerAllCommands(program: Command): void {
  // Special commands
  registerLoginCommand(program);
  registerLogoutCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);
  registerMcpCommand(program);

  // Group API commands by their `group` field
  const groups = new Map<string, CommandDefinition[]>();
  for (const cmd of allCommands) {
    if (!groups.has(cmd.group)) groups.set(cmd.group, []);
    groups.get(cmd.group)!.push(cmd);
  }

  for (const [groupName, commands] of groups) {
    const groupCmd = program.command(groupName).description(`Manage ${groupName}`);
    for (const cmdDef of commands) {
      registerCommand(groupCmd, cmdDef);
    }
    groupCmd.on('command:*', (operands: string[]) => {
      const available = commands.map((c) => c.subcommand).join(', ');
      console.error(`error: unknown command '${operands[0]}' for '${groupName}'`);
      console.error(`Available commands: ${available}`);
      process.exitCode = 1;
    });
  }
}

function registerCommand(parent: Command, cmdDef: CommandDefinition): void {
  const cmd = parent.command(cmdDef.subcommand).description(cmdDef.description);

  if (cmdDef.cliMappings.args) {
    for (const arg of cmdDef.cliMappings.args) {
      cmd.argument(arg.required ? `<${arg.name}>` : `[${arg.name}]`, arg.field);
    }
  }
  if (cmdDef.cliMappings.options) {
    for (const opt of cmdDef.cliMappings.options) {
      cmd.option(opt.flags, opt.description ?? '');
    }
  }
  if (cmdDef.examples?.length) {
    cmd.addHelpText('after', '\nExamples:\n' + cmdDef.examples.map((e) => `  $ ${e}`).join('\n'));
  }

  cmd.action(async (...actionArgs: any[]) => {
    const globalOpts = normalizeGlobalOptions(
      cmd.optsWithGlobals() as GlobalOptions & Record<string, any>,
    );
    try {
      const input: Record<string, any> = {};

      // Positional args
      if (cmdDef.cliMappings.args) {
        for (let i = 0; i < cmdDef.cliMappings.args.length; i++) {
          const argDef = cmdDef.cliMappings.args[i];
          if (actionArgs[i] !== undefined) input[argDef.field] = actionArgs[i];
        }
      }
      // Options (commander camelCases flag names)
      if (cmdDef.cliMappings.options) {
        for (const opt of cmdDef.cliMappings.options) {
          const match = opt.flags.match(/--([a-z][a-z-]+)/);
          if (match) {
            const optName = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            if (globalOpts[optName] !== undefined) input[opt.field] = globalOpts[optName];
          }
        }
      }

      const parsed = cmdDef.inputSchema.safeParse(input);
      if (!parsed.success) throw formatInputValidationError(parsed.error);

      const client = new GSCClient({ keyFile: globalOpts.keyFile });
      const result = await cmdDef.handler(parsed.data as Record<string, any>, client);
      output(result, globalOpts);
    } catch (error) {
      outputError(error, globalOpts);
      process.exit(1);
    }
  });
}
