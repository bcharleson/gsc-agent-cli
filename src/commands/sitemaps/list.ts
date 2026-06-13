import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';

export const sitemapsListCommand: CommandDefinition = {
  name: 'sitemaps_list',
  group: 'sitemaps',
  subcommand: 'list',
  description:
    'List sitemaps submitted for a property, with last-downloaded time, warnings, errors, and indexed counts per content type.',
  examples: ['gsc sitemaps list --site sc-domain:example.com', 'gsc sitemaps list'],
  readOnly: true,
  inputSchema: z.object({
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
    sitemapIndex: z.string().optional().describe('Only list sitemaps contained in this sitemap index URL.'),
  }),
  cliMappings: {
    options: [
      { field: 'site', flags: '--site <siteUrl>', description: 'Property URL' },
      { field: 'sitemapIndex', flags: '--sitemap-index <url>', description: 'Filter to a sitemap index' },
    ],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    return client.call((sc) =>
      sc.sitemaps.list({ siteUrl, sitemapIndex: input.sitemapIndex }),
    );
  },
};
