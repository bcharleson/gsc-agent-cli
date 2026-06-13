import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';
import { resolveDateRange } from '../../core/dates.js';
import { parseJsonField } from '../../core/validation.js';

const DIMENSIONS = ['query', 'page', 'country', 'device', 'date', 'searchAppearance'] as const;

/** Shared input schema so the wrappers (top-queries/top-pages) can reuse it. */
export const searchAnalyticsInput = z.object({
  site: z.string().optional().describe('Property URL. Defaults to configured site.'),
  startDate: z.string().optional().describe('Start date YYYY-MM-DD. Defaults via --days.'),
  endDate: z.string().optional().describe('End date YYYY-MM-DD. Defaults to ~2 days ago (data lag).'),
  days: z.coerce.number().int().positive().optional().describe('Lookback window in days (default 28). Ignored if startDate given.'),
  dimensions: z.string().optional().describe(`Comma-separated dimensions: ${DIMENSIONS.join(', ')}.`),
  type: z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']).optional().describe('Search type (default web).'),
  filters: z.union([z.array(z.any()), z.string()]).optional().describe('dimensionFilterGroups as JSON.'),
  rowLimit: z.coerce.number().int().positive().max(25000).optional().describe('Max rows (default 1000, max 25000).'),
  startRow: z.coerce.number().int().nonnegative().optional().describe('Pagination offset.'),
  aggregationType: z.enum(['auto', 'byPage', 'byProperty']).optional().describe('Aggregation type.'),
  dataState: z.enum(['final', 'all']).optional().describe('"all" includes fresh (incomplete) data.'),
});

/** Builds the searchanalytics.query requestBody from validated input. */
export function buildQueryBody(input: Record<string, any>) {
  const { startDate, endDate } = resolveDateRange({
    startDate: input.startDate,
    endDate: input.endDate,
    days: input.days,
  });

  const body: Record<string, unknown> = { startDate, endDate };

  if (input.dimensions) {
    body.dimensions = String(input.dimensions)
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }
  if (input.type) body.type = input.type;
  if (input.filters !== undefined) body.dimensionFilterGroups = parseJsonField(input.filters);
  body.rowLimit = input.rowLimit ?? 1000;
  if (input.startRow !== undefined) body.startRow = input.startRow;
  if (input.aggregationType) body.aggregationType = input.aggregationType;
  if (input.dataState) body.dataState = input.dataState;

  return body;
}

export const searchAnalyticsQueryCommand: CommandDefinition = {
  name: 'search_analytics_query',
  group: 'search-analytics',
  subcommand: 'query',
  description:
    'Query the Performance report: clicks, impressions, CTR, and average position, broken down by any dimensions (query, page, country, device, date, searchAppearance). The core SEO data source.',
  examples: [
    'gsc search-analytics query --dimensions query --days 28 --row-limit 25',
    'gsc search-analytics query --dimensions page,query --start-date 2026-05-01 --end-date 2026-05-31',
    'gsc search-analytics query --dimensions query --filters \'[{"filters":[{"dimension":"country","expression":"usa"}]}]\'',
  ],
  readOnly: true,
  inputSchema: searchAnalyticsInput,
  cliMappings: {
    options: [
      { field: 'site', flags: '--site <siteUrl>', description: 'Property URL' },
      { field: 'startDate', flags: '--start-date <YYYY-MM-DD>', description: 'Start date' },
      { field: 'endDate', flags: '--end-date <YYYY-MM-DD>', description: 'End date' },
      { field: 'days', flags: '--days <number>', description: 'Lookback window (default 28)' },
      { field: 'dimensions', flags: '-d, --dimensions <list>', description: 'Comma-separated dimensions' },
      { field: 'type', flags: '--type <type>', description: 'web|image|video|news|discover|googleNews' },
      { field: 'filters', flags: '--filters <json>', description: 'dimensionFilterGroups JSON' },
      { field: 'rowLimit', flags: '-l, --row-limit <number>', description: 'Max rows (default 1000)' },
      { field: 'startRow', flags: '--start-row <number>', description: 'Pagination offset' },
      { field: 'aggregationType', flags: '--aggregation-type <type>', description: 'auto|byPage|byProperty' },
      { field: 'dataState', flags: '--data-state <state>', description: 'final|all (all = include fresh data)' },
    ],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    const requestBody = buildQueryBody(input);
    return client.call((sc) => sc.searchanalytics.query({ siteUrl, requestBody }));
  },
};
