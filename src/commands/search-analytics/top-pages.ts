import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';
import { buildQueryBody } from './query.js';

export const topPagesCommand: CommandDefinition = {
  name: 'top_pages',
  group: 'search-analytics',
  subcommand: 'top-pages',
  description: 'Convenience wrapper: top pages by clicks for a date range (dimensions=page).',
  examples: ['gsc search-analytics top-pages --days 28 --row-limit 25'],
  readOnly: true,
  inputSchema: z.object({
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
    days: z.coerce.number().int().positive().optional().describe('Lookback window (default 28).'),
    startDate: z.string().optional().describe('Start date YYYY-MM-DD.'),
    endDate: z.string().optional().describe('End date YYYY-MM-DD.'),
    rowLimit: z.coerce.number().int().positive().max(25000).optional().describe('Max rows (default 25).'),
  }),
  cliMappings: {
    options: [
      { field: 'site', flags: '--site <siteUrl>', description: 'Property URL' },
      { field: 'days', flags: '--days <number>', description: 'Lookback window (default 28)' },
      { field: 'startDate', flags: '--start-date <YYYY-MM-DD>', description: 'Start date' },
      { field: 'endDate', flags: '--end-date <YYYY-MM-DD>', description: 'End date' },
      { field: 'rowLimit', flags: '-l, --row-limit <number>', description: 'Max rows (default 25)' },
    ],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    const requestBody = buildQueryBody({ ...input, dimensions: 'page', rowLimit: input.rowLimit ?? 25 });
    return client.call((sc) => sc.searchanalytics.query({ siteUrl, requestBody }));
  },
};
