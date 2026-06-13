import { Command } from 'commander';
import { describeAuth } from '../../core/auth.js';
import { GSCClient } from '../../core/client.js';
import { loadConfig } from '../../core/config.js';
import { output, outputError } from '../../core/output.js';
import { normalizeGlobalOptions } from '../../core/validation.js';

/**
 * Reports which credential source is active and, if able, verifies it by
 * listing accessible properties.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show active credential source and verify it by listing accessible properties.')
    .option('--key-file <path>', 'Service account key file to test')
    .action(async (opts) => {
      const globalOpts = normalizeGlobalOptions({
        ...program.opts(),
        ...opts,
      } as Record<string, unknown>);
      try {
        const auth = await describeAuth(opts.keyFile);
        const config = await loadConfig();

        let verified = false;
        let siteCount: number | undefined;
        let error: string | undefined;

        if (auth.method !== 'none') {
          try {
            const client = await GSCClient.create(opts.keyFile);
            const res: any = await client.call((sc) => sc.sites.list());
            verified = true;
            siteCount = res?.siteEntry?.length ?? 0;
          } catch (e: any) {
            error = e.message ?? String(e);
          }
        }

        output(
          {
            method: auth.method,
            source: auth.source,
            defaultSite: config?.default_site ?? null,
            verified,
            ...(siteCount !== undefined ? { accessibleProperties: siteCount } : {}),
            ...(error ? { error } : {}),
          },
          globalOpts,
        );
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });
}
