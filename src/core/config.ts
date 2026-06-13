import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.gsc');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/** Persisted auth config. Either OAuth tokens or a service-account key path. */
export interface GSCConfig {
  /** OAuth installed-app client id. */
  oauth_client_id?: string;
  /** OAuth installed-app client secret. */
  oauth_client_secret?: string;
  /** OAuth refresh token obtained from `gsc auth login`. */
  oauth_refresh_token?: string;
  /** Path to a service-account JSON key file. */
  service_account_key_file?: string;
  /** Default siteUrl so commands can omit --site. */
  default_site?: string;
  /** Google API key for key-based APIs (CrUX, PageSpeed Insights). */
  google_api_key?: string;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export async function loadConfig(): Promise<GSCConfig | null> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as GSCConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: GSCConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', {
    mode: 0o600,
  });
}

export async function patchConfig(patch: Partial<GSCConfig>): Promise<GSCConfig> {
  const current = (await loadConfig()) ?? {};
  const next = { ...current, ...patch };
  await saveConfig(next);
  return next;
}

export async function deleteConfig(): Promise<void> {
  try {
    await rm(CONFIG_FILE);
  } catch {
    // already gone
  }
}
