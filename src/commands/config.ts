import { Command } from 'commander';
import { patchConfig, loadConfig, getConfigPath } from '../core/config.js';
import { output, outputError } from '../core/output.js';
import { normalizeGlobalOptions } from '../core/validation.js';

/**
 * Local config management: persist a default property and/or a service-account
 * key file path so commands can omit --site / --key-file.
 */
export function registerConfigCommand(program: Command): void {
  const cfg = program.command('config').description('Manage local gsc config (~/.gsc/config.json)');

  cfg
    .command('set-site <siteUrl>')
    .description('Set the default property so commands can omit --site.')
    .action(async (siteUrl: string) => {
      const globalOpts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
      try {
        await patchConfig({ default_site: siteUrl });
        output({ default_site: siteUrl }, globalOpts);
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });

  cfg
    .command('use-key-file <path>')
    .description('Persist a service-account JSON key path as the default credential.')
    .action(async (path: string) => {
      const globalOpts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
      try {
        await patchConfig({ service_account_key_file: path });
        output({ service_account_key_file: path }, globalOpts);
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });

  cfg
    .command('set-api-key <key>')
    .description('Persist a Google API key for key-based APIs (CrUX, PageSpeed Insights).')
    .action(async (key: string) => {
      const globalOpts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
      try {
        await patchConfig({ google_api_key: key });
        output({ google_api_key: 'set' }, globalOpts);
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });

  cfg
    .command('show')
    .description('Show current config (secrets redacted).')
    .action(async () => {
      const globalOpts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
      try {
        const config = (await loadConfig()) ?? {};
        output(
          {
            path: getConfigPath(),
            default_site: config.default_site ?? null,
            service_account_key_file: config.service_account_key_file ?? null,
            oauth: config.oauth_refresh_token ? 'configured' : null,
            google_api_key: config.google_api_key ? 'set' : null,
          },
          globalOpts,
        );
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });
}
