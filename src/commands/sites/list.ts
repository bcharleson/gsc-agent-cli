import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';

export const sitesListCommand: CommandDefinition = {
  name: 'sites_list',
  group: 'sites',
  subcommand: 'list',
  description:
    'List all Search Console properties the authenticated account/service account can access, with permission level for each.',
  examples: ['gsc sites list', 'gsc sites list --pretty'],
  readOnly: true,
  inputSchema: z.object({}),
  cliMappings: {},
  handler: (_input, client) => client.call((sc) => sc.sites.list()),
};
