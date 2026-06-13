import { Command } from 'commander';
import { deleteConfig } from '../../core/config.js';
import { output, outputError } from '../../core/output.js';
import { normalizeGlobalOptions } from '../../core/validation.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Remove stored credentials (~/.gsc/config.json).')
    .action(async () => {
      const globalOpts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
      try {
        await deleteConfig();
        output({ loggedOut: true }, globalOpts);
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });
}
