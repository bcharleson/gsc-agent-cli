# gsc-agent-cli: agent guide

This tool exposes the **Google Search Console API** to AI agents. Use it to read
a site's search performance, check indexing, and manage sitemaps: everything a
human sees in the Search Console UI that has an API.

## Identity & output

- Every command prints **JSON to stdout**. Parse it directly. Errors print
  `{"error","code"}` to stderr with exit code 1.
- All commands are also MCP tools (run `gsc mcp`). Tool names are the snake_case
  `name` of each command (e.g. `search_analytics_query`, `inspect_url`,
  `indexing_report`).

## Property URLs (siteUrl)

Two forms, always pass one or rely on the configured default:
- Domain property: `sc-domain:example.com`
- URL-prefix property: `https://www.example.com/` (trailing slash matters)

Set a default once: `gsc config set-site sc-domain:example.com`, then omit `--site`.

## Common flows

- **What's ranking?** `search_analytics_query` with `dimensions: "query"` (or
  `top_queries`). Returns clicks, impressions, ctr, position.
- **Which pages get traffic?** `top_pages` or `dimensions: "page"`.
- **Is a URL indexed?** `inspect_url` → read
  `inspectionResult.indexStatusResult.coverageState` and `.verdict` (PASS =
  indexed).
- **How much of the site is indexed?** `indexing_report` fans out URL
  inspection over the sitemap and tallies. Respect the 2000/day inspection
  quota; use `limit`.

## Date handling

`search_analytics_query` defaults to the last 28 days ending ~2 days ago (GSC
data lags). Override with `days`, or explicit `startDate`/`endDate`
(YYYY-MM-DD). Pass `dataState: "all"` to include fresh, still-incomplete data.

## Gotchas

- A service account must be **added as a user on the property** or every call
  returns 403. `gsc status` verifies access.
- `urlInspection` is rate limited (2000/day, 600/min per property).
- "Recommendations" and Core Web Vitals are **not** in this API.
