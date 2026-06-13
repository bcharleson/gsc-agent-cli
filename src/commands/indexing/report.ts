import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import type { GSCClient } from '../../core/client.js';
import { resolveSite } from '../../core/site.js';
import { fetchSitemapUrls } from '../../core/sitemap-urls.js';
import { GSCError } from '../../core/errors.js';

/** Inspects URLs with a small concurrency pool, tolerating per-URL failures. */
async function inspectAll(
  client: GSCClient,
  siteUrl: string,
  urls: string[],
  concurrency: number,
): Promise<Array<{ url: string; coverageState?: string; verdict?: string; error?: string }>> {
  const results: Array<{ url: string; coverageState?: string; verdict?: string; error?: string }> = [];
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      const url = urls[i];
      try {
        const data: any = await client.call((sc) =>
          sc.urlInspection.index.inspect({
            requestBody: { inspectionUrl: url, siteUrl, languageCode: 'en-US' },
          }),
        );
        const index = data?.inspectionResult?.indexStatusResult ?? {};
        results.push({ url, coverageState: index.coverageState, verdict: index.verdict });
      } catch (err) {
        results.push({ url, error: err instanceof GSCError ? err.message : String(err) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}

export const indexingReportCommand: CommandDefinition = {
  name: 'indexing_report',
  group: 'indexing',
  subcommand: 'report',
  description:
    'Reconstruct the "indexed vs not indexed" overview: fetches the property\'s sitemap URLs, inspects each via the URL Inspection API, and tallies coverageState. Reproduces the GSC Indexing chart, which has no direct API. Respects URL Inspection rate limits — cap with --limit.',
  examples: [
    'gsc indexing report --site sc-domain:example.com --sitemap https://www.example.com/sitemap.xml',
    'gsc indexing report --limit 50 --details',
  ],
  readOnly: true,
  inputSchema: z.object({
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
    sitemap: z.string().optional().describe('Sitemap URL to pull page URLs from. If omitted, the first listed sitemap is used.'),
    limit: z.coerce.number().int().positive().max(2000).optional().describe('Max URLs to inspect (default 100; API cap 2000/day).'),
    concurrency: z.coerce.number().int().positive().max(10).optional().describe('Parallel inspections (default 5).'),
    details: z.coerce.boolean().optional().describe('Include the per-URL breakdown, not just the summary.'),
  }),
  cliMappings: {
    options: [
      { field: 'site', flags: '--site <siteUrl>', description: 'Property URL' },
      { field: 'sitemap', flags: '--sitemap <url>', description: 'Sitemap URL to read page URLs from' },
      { field: 'limit', flags: '-l, --limit <number>', description: 'Max URLs to inspect (default 100)' },
      { field: 'concurrency', flags: '--concurrency <number>', description: 'Parallel inspections (default 5)' },
      { field: 'details', flags: '--details', description: 'Include per-URL breakdown' },
    ],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    const limit = input.limit ?? 100;

    // Determine which sitemap to read.
    let sitemapUrl: string | undefined = input.sitemap;
    if (!sitemapUrl) {
      const list: any = await client.call((sc) => sc.sitemaps.list({ siteUrl }));
      sitemapUrl = list?.sitemap?.[0]?.path;
      if (!sitemapUrl) {
        throw new GSCError(
          'No sitemap found for property. Pass --sitemap <url> explicitly.',
          'NO_SITEMAP',
        );
      }
    }

    const urls = await fetchSitemapUrls(sitemapUrl, limit);
    const inspected = await inspectAll(client, siteUrl, urls, input.concurrency ?? 5);

    // Tally by coverageState.
    const byState: Record<string, number> = {};
    let indexed = 0;
    let notIndexed = 0;
    let errors = 0;
    for (const r of inspected) {
      if (r.error) {
        errors++;
        continue;
      }
      const state = r.coverageState ?? 'Unknown';
      byState[state] = (byState[state] ?? 0) + 1;
      // PASS verdict ~ indexed; everything else counts as not indexed.
      if (r.verdict === 'PASS') indexed++;
      else notIndexed++;
    }

    const summary = {
      siteUrl,
      sitemapUrl,
      inspected: inspected.length,
      indexed,
      notIndexed,
      errors,
      byCoverageState: byState,
    };

    return input.details ? { ...summary, urls: inspected } : summary;
  },
};
