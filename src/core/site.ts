import { loadConfig } from './config.js';
import { ValidationError } from './errors.js';

/**
 * Resolves the target property URL. GSC accepts two forms:
 *   - URL-prefix property:  "https://www.example.com/"
 *   - Domain property:      "sc-domain:example.com"
 * Falls back to `default_site` in ~/.gsc/config.json when not supplied.
 */
export async function resolveSite(site?: string): Promise<string> {
  if (site) return site;
  const config = await loadConfig();
  if (config?.default_site) return config.default_site;
  throw new ValidationError(
    'No site specified. Pass --site <siteUrl> (e.g. "sc-domain:example.com" or ' +
      '"https://www.example.com/") or set a default with: gsc config set-site <siteUrl>',
  );
}
