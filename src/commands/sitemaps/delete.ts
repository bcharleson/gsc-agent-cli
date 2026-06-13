import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';

export const sitemapsDeleteCommand: CommandDefinition = {
  name: 'sitemaps_delete',
  group: 'sitemaps',
  subcommand: 'delete',
  description: 'Delete (unsubmit) a sitemap from a property.',
  examples: ['gsc sitemaps delete https://www.example.com/old-sitemap.xml --site sc-domain:example.com'],
  readOnly: false,
  inputSchema: z.object({
    feedpath: z.string().describe('Full URL of the sitemap to delete.'),
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
  }),
  cliMappings: {
    args: [{ name: 'feedpath', field: 'feedpath', required: true }],
    options: [{ field: 'site', flags: '--site <siteUrl>', description: 'Property URL' }],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    await client.call((sc) => sc.sitemaps.delete({ siteUrl, feedpath: input.feedpath }));
    return { deleted: true, siteUrl, feedpath: input.feedpath };
  },
};
