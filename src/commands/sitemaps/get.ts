import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';

export const sitemapsGetCommand: CommandDefinition = {
  name: 'sitemaps_get',
  group: 'sitemaps',
  subcommand: 'get',
  description: 'Get full status for a single submitted sitemap (errors, warnings, indexed counts, last download).',
  examples: ['gsc sitemaps get https://www.example.com/sitemap.xml --site sc-domain:example.com'],
  readOnly: true,
  inputSchema: z.object({
    feedpath: z.string().describe('Full URL of the sitemap.'),
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
  }),
  cliMappings: {
    args: [{ name: 'feedpath', field: 'feedpath', required: true }],
    options: [{ field: 'site', flags: '--site <siteUrl>', description: 'Property URL' }],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    return client.call((sc) => sc.sitemaps.get({ siteUrl, feedpath: input.feedpath }));
  },
};
