import { Command, CommanderError } from 'commander';
import { registerAllCommands } from './commands/index.js';
import { outputError } from './core/output.js';
import { assertValidOutputFormat, normalizeGlobalOptions } from './core/validation.js';
import { CLI_VERSION } from './core/version.js';

const program = new Command();

program
  .name('gsc')
  .description('CLI and MCP server for the Google Search Console API — built for humans and AI agents.')
  .version(CLI_VERSION)
  .option('--key-file <path>', 'Service account JSON key file (overrides env + stored config)')
  .option('--output <format>', 'Output format: json (default) or pretty', 'json')
  .option('--pretty', 'Shorthand for --output pretty')
  .option('--quiet', 'Suppress output, exit codes only');

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals() as { output?: string; pretty?: boolean };
  if (opts.pretty) opts.output = 'pretty';
  assertValidOutputFormat(opts.output);
});

registerAllCommands(program);

program.exitOverride();

try {
  program.parse();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exit(error.exitCode);
  }
  const opts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
  outputError(error, opts);
  process.exit(1);
}
