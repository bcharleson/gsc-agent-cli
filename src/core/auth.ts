import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { loadConfig } from './config.js';
import { AuthError } from './errors.js';

/**
 * Full read-write scope. Covers sites, sitemaps, search analytics, and URL
 * inspection. Use this single scope so `gsc sitemaps submit` etc. work.
 */
export const SCOPES = ['https://www.googleapis.com/auth/webmasters'];

/** Loopback redirect used by the installed-app OAuth flow. */
export const OAUTH_REDIRECT = 'http://localhost:4280/oauth2callback';

/**
 * Resolves an authenticated Google auth client using this priority:
 *   1. --key-file <path> flag                (service account)
 *   2. GOOGLE_APPLICATION_CREDENTIALS env     (service account)
 *   3. GSC_SERVICE_ACCOUNT_JSON env (inline)  (service account)
 *   4. stored service_account_key_file        (service account)
 *   5. stored OAuth refresh token             (acts as your account)
 *
 * Service accounts must be added as a user on the property in Search Console
 * (Settings → Users and permissions). OAuth sees every property the
 * authenticated Google account can access.
 */
export async function resolveAuth(flagKeyFile?: string): Promise<OAuth2Client> {
  // 1. explicit --key-file
  if (flagKeyFile) {
    return serviceAccountFromFile(flagKeyFile);
  }

  // 2. GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return serviceAccountFromFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  // 3. inline service-account JSON
  if (process.env.GSC_SERVICE_ACCOUNT_JSON) {
    return serviceAccountFromJson(process.env.GSC_SERVICE_ACCOUNT_JSON);
  }

  const config = await loadConfig();

  // 4. stored service-account key file
  if (config?.service_account_key_file) {
    return serviceAccountFromFile(config.service_account_key_file);
  }

  // 5. stored OAuth refresh token
  if (config?.oauth_refresh_token && config.oauth_client_id && config.oauth_client_secret) {
    const oauth2 = new google.auth.OAuth2(
      config.oauth_client_id,
      config.oauth_client_secret,
      OAUTH_REDIRECT,
    );
    oauth2.setCredentials({ refresh_token: config.oauth_refresh_token });
    return oauth2;
  }

  throw new AuthError(
    'No credentials found. Provide a service account (--key-file <path>, ' +
      'GOOGLE_APPLICATION_CREDENTIALS, or GSC_SERVICE_ACCOUNT_JSON) or run: gsc login',
  );
}

async function serviceAccountFromFile(path: string): Promise<OAuth2Client> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    throw new AuthError(`Could not read service account key file: ${path}`);
  }
  return serviceAccountFromJson(raw);
}

async function serviceAccountFromJson(json: string): Promise<OAuth2Client> {
  let creds: { client_email?: string; private_key?: string };
  try {
    creds = JSON.parse(json);
  } catch {
    throw new AuthError('Service account JSON is not valid JSON.');
  }
  if (!creds.client_email || !creds.private_key) {
    throw new AuthError('Service account JSON missing client_email or private_key.');
  }
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  });
  return jwt as unknown as OAuth2Client;
}

/** Describes which credential source is active, for `gsc auth status`. */
export async function describeAuth(flagKeyFile?: string): Promise<{
  method: 'service_account' | 'oauth' | 'none';
  source: string;
}> {
  if (flagKeyFile) return { method: 'service_account', source: `--key-file ${flagKeyFile}` };
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS)
    return { method: 'service_account', source: 'GOOGLE_APPLICATION_CREDENTIALS' };
  if (process.env.GSC_SERVICE_ACCOUNT_JSON)
    return { method: 'service_account', source: 'GSC_SERVICE_ACCOUNT_JSON' };
  const config = await loadConfig();
  if (config?.service_account_key_file)
    return { method: 'service_account', source: config.service_account_key_file };
  if (config?.oauth_refresh_token)
    return { method: 'oauth', source: '~/.gsc/config.json (oauth)' };
  return { method: 'none', source: 'none' };
}
