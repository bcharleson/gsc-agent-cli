import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveApiKey, webGetJson } from '../../core/web.js';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * PageSpeed Insights — lab (Lighthouse) performance plus field data for a single
 * URL. Complements CrUX: CrUX is purely field/real-user, PSI adds a controlled
 * lab run with category scores and opportunities. Outside the GSC surface; uses
 * a Google API key (works keyless too, but rate-limited).
 */
export const pagespeedRunCommand: CommandDefinition = {
  name: 'pagespeed_run',
  group: 'pagespeed',
  subcommand: 'run',
  description:
    'Run PageSpeed Insights (Lighthouse) on a URL: performance/accessibility/SEO/best-practices scores plus lab + field metrics. By default returns a trimmed summary; use --raw for the full Lighthouse report.',
  examples: [
    'gsc pagespeed run --url https://www.topoffunnel.com --strategy mobile',
    'gsc pagespeed run --url https://www.topoffunnel.com --category performance,seo --raw',
  ],
  readOnly: true,
  inputSchema: z.object({
    url: z.string().describe('The URL to analyze.'),
    strategy: z.enum(['mobile', 'desktop']).optional().describe('Analysis strategy (default mobile).'),
    category: z.string().optional().describe('Comma-separated: performance,accessibility,best-practices,seo,pwa (default performance).'),
    raw: z.coerce.boolean().optional().describe('Return the full Lighthouse report instead of a trimmed summary.'),
    apiKey: z.string().optional().describe('Google API key (else GOOGLE_API_KEY / stored config).'),
  }),
  cliMappings: {
    options: [
      { field: 'url', flags: '--url <url>', description: 'URL to analyze' },
      { field: 'strategy', flags: '--strategy <type>', description: 'mobile|desktop (default mobile)' },
      { field: 'category', flags: '--category <list>', description: 'performance,accessibility,best-practices,seo,pwa' },
      { field: 'raw', flags: '--raw', description: 'Return full Lighthouse report' },
      { field: 'apiKey', flags: '--api-key <key>', description: 'Google API key' },
    ],
  },
  handler: async (input) => {
    const apiKey = await resolveApiKey(input.apiKey).catch(() => undefined);
    const categories = (input.category ?? 'performance')
      .split(',')
      .map((c: string) => c.trim())
      .filter(Boolean);

    const data: any = await webGetJson(
      PSI_ENDPOINT,
      {
        url: input.url,
        strategy: input.strategy ?? 'mobile',
        category: categories,
      },
      // PSI tolerates a missing key (rate-limited); pass empty string if none.
      apiKey ?? '',
    );

    if (input.raw) return data;
    return summarize(data, input.url, input.strategy ?? 'mobile');
  },
};

/** Trims the large Lighthouse payload to category scores + core metrics. */
function summarize(data: any, url: string, strategy: string) {
  const lh = data?.lighthouseResult ?? {};
  const scores: Record<string, number | null> = {};
  for (const [key, cat] of Object.entries<any>(lh.categories ?? {})) {
    scores[key] = cat?.score != null ? Math.round(cat.score * 100) : null;
  }

  const audits = lh.audits ?? {};
  const labMetric = (id: string) => audits[id]?.displayValue ?? audits[id]?.numericValue ?? null;

  const field = data?.loadingExperience?.metrics ?? {};
  const fieldP75 = (key: string) => field[key]?.percentile ?? null;

  return {
    url,
    strategy,
    scores,
    labMetrics: {
      firstContentfulPaint: labMetric('first-contentful-paint'),
      largestContentfulPaint: labMetric('largest-contentful-paint'),
      totalBlockingTime: labMetric('total-blocking-time'),
      cumulativeLayoutShift: labMetric('cumulative-layout-shift'),
      speedIndex: labMetric('speed-index'),
    },
    fieldMetrics: {
      LCP_ms: fieldP75('LARGEST_CONTENTFUL_PAINT_MS'),
      INP_ms: fieldP75('INTERACTION_TO_NEXT_PAINT'),
      CLS: fieldP75('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
      FCP_ms: fieldP75('FIRST_CONTENTFUL_PAINT_MS'),
      overall: data?.loadingExperience?.overall_category ?? null,
    },
  };
}
