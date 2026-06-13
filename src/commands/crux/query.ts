import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveApiKey, webPostJson } from '../../core/web.js';
import { ValidationError } from '../../core/errors.js';

const CRUX_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

/**
 * Chrome UX Report (CrUX) — real-user (field) Core Web Vitals. This is the data
 * behind Search Console's "Experience" report, which the Search Console API
 * itself does NOT expose. Lives OUTSIDE the owned-property GSC surface: it works
 * for any public origin/URL with enough traffic, using a Google API key.
 */
export const cruxQueryCommand: CommandDefinition = {
  name: 'crux_query',
  group: 'crux',
  subcommand: 'query',
  description:
    'Real-user Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from the Chrome UX Report — the field data behind GSC\'s Experience report. Query a specific --url or a whole --origin. Requires a Google API key.',
  examples: [
    'gsc crux query --origin https://www.topoffunnel.com --form-factor PHONE',
    'gsc crux query --url https://www.topoffunnel.com/resources/clay-cli --pretty',
  ],
  readOnly: true,
  inputSchema: z.object({
    url: z.string().optional().describe('Specific page URL to query (page-level data).'),
    origin: z.string().optional().describe('Origin to query (site-level data), e.g. https://www.example.com.'),
    formFactor: z.enum(['PHONE', 'TABLET', 'DESKTOP', 'ALL_FORM_FACTORS']).optional().describe('Device class (default ALL_FORM_FACTORS).'),
    apiKey: z.string().optional().describe('Google API key (else GOOGLE_API_KEY / stored config).'),
  }),
  cliMappings: {
    options: [
      { field: 'url', flags: '--url <url>', description: 'Specific page URL (page-level)' },
      { field: 'origin', flags: '--origin <origin>', description: 'Origin (site-level)' },
      { field: 'formFactor', flags: '--form-factor <type>', description: 'PHONE|TABLET|DESKTOP|ALL_FORM_FACTORS' },
      { field: 'apiKey', flags: '--api-key <key>', description: 'Google API key' },
    ],
  },
  handler: async (input) => {
    if (!input.url && !input.origin) {
      throw new ValidationError('Provide either --url (page-level) or --origin (site-level).');
    }
    const apiKey = await resolveApiKey(input.apiKey);
    const body: Record<string, unknown> = {
      formFactor: input.formFactor ?? 'ALL_FORM_FACTORS',
    };
    if (input.url) body.url = input.url;
    else body.origin = input.origin;

    return webPostJson(CRUX_ENDPOINT, body, apiKey);
  },
};
