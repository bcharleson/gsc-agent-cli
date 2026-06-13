import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { resolveSite } from '../../core/site.js';

export const inspectUrlCommand: CommandDefinition = {
  name: 'inspect_url',
  group: 'inspect',
  subcommand: 'url',
  description:
    'Inspect a single URL: index status (coverageState), last crawl time, canonical, robots/indexability verdict, mobile usability, and rich-results status. Rate limited to 2000/day, 600/min per property.',
  examples: [
    'gsc inspect url https://www.example.com/pricing --site sc-domain:example.com',
    'gsc inspect url https://www.example.com/blog/post --language en-US',
  ],
  readOnly: true,
  inputSchema: z.object({
    inspectionUrl: z.string().describe('The fully-qualified URL to inspect. Must be within the property.'),
    site: z.string().optional().describe('Property URL the inspectionUrl belongs to. Defaults to configured site.'),
    language: z.string().optional().describe('BCP-47 language code for the result (e.g. en-US).'),
  }),
  cliMappings: {
    args: [{ name: 'inspectionUrl', field: 'inspectionUrl', required: true }],
    options: [
      { field: 'site', flags: '--site <siteUrl>', description: 'Property URL' },
      { field: 'language', flags: '--language <code>', description: 'BCP-47 language code (default en-US)' },
    ],
  },
  handler: async (input, client) => {
    const siteUrl = await resolveSite(input.site);
    return client.call((sc) =>
      sc.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: input.inspectionUrl,
          siteUrl,
          languageCode: input.language ?? 'en-US',
        },
      }),
    );
  },
};
