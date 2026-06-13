import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const sitesAddCommand: CommandDefinition = {
  name: 'sites_add',
  group: 'sites',
  subcommand: 'add',
  description:
    'Add a property to the account. The property must still be verified separately (DNS TXT, meta tag, etc.) before data is available.',
  examples: ['gsc sites add https://www.example.com/', 'gsc sites add sc-domain:example.com'],
  readOnly: false,
  inputSchema: z.object({
    site: z.string().describe('Property URL to add (sc-domain:... or https://...).'),
  }),
  cliMappings: {
    args: [{ name: 'site', field: 'site', required: true }],
    options: [{ field: 'site', flags: '--site <siteUrl>', description: 'Property URL to add' }],
  },
  handler: (input, client) => client.call((sc) => sc.sites.add({ siteUrl: input.site })),
};
