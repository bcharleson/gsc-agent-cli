import { createServer } from 'node:http';
import { Command } from 'commander';
import { google } from 'googleapis';
import { SCOPES, OAUTH_REDIRECT } from '../../core/auth.js';
import { patchConfig } from '../../core/config.js';
import { output, outputError } from '../../core/output.js';
import { normalizeGlobalOptions } from '../../core/validation.js';
import { ValidationError } from '../../core/errors.js';

const REDIRECT_PORT = 4280;
const REDIRECT_PATH = '/oauth2callback';

/**
 * Installed-app OAuth flow: opens a consent URL, runs a one-shot loopback
 * server to catch the redirect, exchanges the code for a refresh token, and
 * persists it. Requires an OAuth client (Desktop app type) from Google Cloud.
 */
export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate via OAuth (acts as your Google account; sees all your properties).')
    .option('--client-id <id>', 'OAuth client ID (Desktop app type)')
    .option('--client-secret <secret>', 'OAuth client secret')
    .addHelpText(
      'after',
      `
Setup:
  1. Google Cloud Console → APIs & Services → Credentials
  2. Create OAuth client ID → Application type: Desktop app
  3. Add ${OAUTH_REDIRECT} as an authorized redirect URI
  4. gsc login --client-id <id> --client-secret <secret>

For headless/agent use, prefer a service account instead (see: gsc status).`,
    )
    .action(async (opts) => {
      const globalOpts = normalizeGlobalOptions(program.opts() as Record<string, unknown>);
      try {
        const clientId = opts.clientId ?? process.env.GSC_OAUTH_CLIENT_ID;
        const clientSecret = opts.clientSecret ?? process.env.GSC_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new ValidationError(
            'Missing OAuth client. Pass --client-id and --client-secret (Desktop app type). Run `gsc login --help` for setup.',
          );
        }

        const oauth2 = new google.auth.OAuth2(clientId, clientSecret, OAUTH_REDIRECT);
        const authUrl = oauth2.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: SCOPES,
        });

        console.error('\nOpen this URL in your browser to authorize:\n');
        console.error(`  ${authUrl}\n`);

        const code = await waitForCode();
        const { tokens } = await oauth2.getToken(code);

        if (!tokens.refresh_token) {
          throw new ValidationError(
            'No refresh token returned. Revoke prior access at https://myaccount.google.com/permissions and retry.',
          );
        }

        await patchConfig({
          oauth_client_id: clientId,
          oauth_client_secret: clientSecret,
          oauth_refresh_token: tokens.refresh_token,
          // clearing any prior service-account preference keeps resolution unambiguous
          service_account_key_file: undefined,
        });

        output({ authenticated: true, method: 'oauth' }, globalOpts);
      } catch (error) {
        outputError(error, globalOpts);
        process.exit(1);
      }
    });
}

/** One-shot loopback server that resolves with the OAuth `code` param. */
function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url?.startsWith(REDIRECT_PATH)) {
        res.writeHead(404).end();
        return;
      }
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        `<html><body style="font-family:system-ui;padding:3rem"><h2>${
          code ? 'Authorized. You can close this tab.' : 'Authorization failed.'
        }</h2></body></html>`,
      );
      server.close();
      if (code) resolve(code);
      else reject(new ValidationError(`OAuth failed: ${err ?? 'no code returned'}`));
    });
    server.on('error', reject);
    server.listen(REDIRECT_PORT);
  });
}
