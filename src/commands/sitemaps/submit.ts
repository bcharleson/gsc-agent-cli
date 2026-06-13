import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';

export const sitemapsSubmitCommand: CommandDefinition = {
  name: 'sitemaps_submit',
  group: 'sitemaps',
  subcommand: 'submit',
  description: 'Submit (or resubmit) a sitemap for a property so Google re-fetches it.',
  examples: ['gsc sitemaps submit https://www.example.com/sitemap.xml --site sc-domain:example.com'],
  readOnly: false,
  inputSchema: z.object({
    feedpath: z.string().describe('Full URL of the sitemap to submit.'),
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
  }),
  cliMappings: {
    args: [{ name: 'feedpath', field: 'feedpath', required: true }],
    options: [{ field: 'site', flags: '--site <siteUrl>', description: 'Property URL' }],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    await client.call((sc) => sc.sitemaps.submit({ siteUrl, feedpath: input.feedpath }));
    return { submitted: true, siteUrl, feedpath: input.feedpath };
  },
};
