import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';

export const sitesGetCommand: CommandDefinition = {
  name: 'sites_get',
  group: 'sites',
  subcommand: 'get',
  description: 'Get information about a specific property, including your permission level.',
  examples: [
    'gsc sites get --site sc-domain:example.com',
    'gsc sites get https://www.example.com/',
  ],
  readOnly: true,
  inputSchema: z.object({
    site: z.string().optional().describe('Property URL (sc-domain:... or https://...). Defaults to configured site.'),
  }),
  cliMappings: {
    args: [{ name: 'site', field: 'site', required: false }],
    options: [{ field: 'site', flags: '--site <siteUrl>', description: 'Property URL' }],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    return client.call((sc) => sc.sites.get({ siteUrl }));
  },
};
