import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import type { GSCClient } from '../../core/client.js';
import { resolveSite } from '../../core/site.js';
import { resolveDateRange } from '../../core/dates.js';
import { resolveApiKey, webPostJson } from '../../core/web.js';
import { formatError } from '../../core/errors.js';

const CRUX_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

/** Best-effort sub-fetch: never throws, returns `{ error }` on failure. */
async function tryStep<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: formatError(e).message };
  }
}

/** Derives a concrete CrUX origin from a GSC siteUrl. */
function deriveOrigin(siteUrl: string): string {
  if (siteUrl.startsWith('sc-domain:')) {
    return `https://${siteUrl.slice('sc-domain:'.length)}`;
  }
  try {
    return new URL(siteUrl).origin;
  } catch {
    return siteUrl;
  }
}

/**
 * Holistic health snapshot: one command, the whole picture. Fuses owned-property
 * GSC data (permissions, sitemap health, search totals, top queries) with
 * outside-GSC real-user Core Web Vitals (CrUX). Each section is best-effort, so
 * a single failing source (e.g. no API key) never sinks the rest.
 */
export const snapshotSiteCommand: CommandDefinition = {
  name: 'snapshot_site',
  group: 'snapshot',
  subcommand: 'site',
  description:
    'Holistic health snapshot of a property: permission level, sitemap health, search totals + top queries (last N days), and real-user Core Web Vitals (CrUX). Combines GSC and outside-GSC sources; each section is best-effort.',
  examples: ['gsc snapshot site --pretty', 'gsc snapshot site --site sc-domain:topoffunnel.com --days 28'],
  readOnly: true,
  inputSchema: z.object({
    site: z.string().optional().describe('Property URL. Defaults to configured site.'),
    origin: z.string().optional().describe('Origin for CrUX (derived from site if omitted).'),
    days: z.coerce.number().int().positive().optional().describe('Lookback for search totals (default 28).'),
    topLimit: z.coerce.number().int().positive().optional().describe('How many top queries to include (default 10).'),
    apiKey: z.string().optional().describe('Google API key for the CrUX section.'),
  }),
  cliMappings: {
    options: [
      { field: 'site', flags: '--site <siteUrl>', description: 'Property URL' },
      { field: 'origin', flags: '--origin <origin>', description: 'CrUX origin (derived if omitted)' },
      { field: 'days', flags: '--days <number>', description: 'Lookback window (default 28)' },
      { field: 'topLimit', flags: '--top-limit <number>', description: 'Top queries to include (default 10)' },
      { field: 'apiKey', flags: '--api-key <key>', description: 'Google API key for CrUX' },
    ],
  },
  handler: async (input, client: GSCClient) => {
    const siteUrl = await resolveSite(input.site);
    const origin = input.origin ?? deriveOrigin(siteUrl);
    const { startDate, endDate } = resolveDateRange({ days: input.days });
    const topLimit = input.topLimit ?? 10;

    const [property, sitemaps, totals, topQueries, cwv] = await Promise.all([
      // GSC: permission level
      tryStep(() => client.call((sc) => sc.sites.get({ siteUrl }))),
      // GSC: sitemap health summary
      tryStep(async () => {
        const list: any = await client.call((sc) => sc.sitemaps.list({ siteUrl }));
        const maps = list?.sitemap ?? [];
        return {
          count: maps.length,
          sitemaps: maps.map((m: any) => ({
            path: m.path,
            lastDownloaded: m.lastDownloaded,
            errors: Number(m.errors ?? 0),
            warnings: Number(m.warnings ?? 0),
            isPending: m.isPending ?? false,
          })),
        };
      }),
      // GSC: overall search totals (no dimensions = single aggregate row)
      tryStep(async () => {
        const res: any = await client.call((sc) =>
          sc.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate } }),
        );
        const row = res?.rows?.[0];
        return {
          range: { startDate, endDate },
          clicks: row?.clicks ?? 0,
          impressions: row?.impressions ?? 0,
          ctr: row?.ctr ?? 0,
          position: row?.position ?? null,
        };
      }),
      // GSC: top queries by clicks
      tryStep(async () => {
        const res: any = await client.call((sc) =>
          sc.searchanalytics.query({
            siteUrl,
            requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: topLimit },
          }),
        );
        return (res?.rows ?? []).map((r: any) => ({
          query: r.keys?.[0],
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        }));
      }),
      // Outside GSC: real-user Core Web Vitals (CrUX) for the origin
      tryStep(async () => {
        const apiKey = await resolveApiKey(input.apiKey);
        const data: any = await webPostJson(
          CRUX_ENDPOINT,
          { origin, formFactor: 'ALL_FORM_FACTORS' },
          apiKey,
        );
        const metrics = data?.record?.metrics ?? {};
        const p75 = (k: string) => metrics[k]?.percentiles?.p75 ?? null;
        return {
          origin,
          LCP_ms: p75('largest_contentful_paint'),
          INP_ms: p75('interaction_to_next_paint'),
          CLS: p75('cumulative_layout_shift'),
          FCP_ms: p75('first_contentful_paint'),
          TTFB_ms: p75('experimental_time_to_first_byte'),
        };
      }),
    ]);

    return {
      siteUrl,
      generatedFor: { startDate, endDate },
      property,
      sitemapHealth: sitemaps,
      searchTotals: totals,
      topQueries,
      coreWebVitals: cwv,
    };
  },
};
