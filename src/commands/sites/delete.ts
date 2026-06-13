import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const sitesDeleteCommand: CommandDefinition = {
  name: 'sites_delete',
  group: 'sites',
  subcommand: 'delete',
  description: 'Remove a property from the account. Does not un-verify it; only removes it from this account.',
  examples: ['gsc sites delete https://www.example.com/'],
  readOnly: false,
  inputSchema: z.object({
    site: z.string().describe('Property URL to remove (sc-domain:... or https://...).'),
  }),
  cliMappings: {
    args: [{ name: 'site', field: 'site', required: true }],
    options: [{ field: 'site', flags: '--site <siteUrl>', description: 'Property URL to remove' }],
  },
  handler: async (input, client) => {
    await client.call((sc) => sc.sites.delete({ siteUrl: input.site }));
    return { deleted: true, siteUrl: input.site };
  },
};
