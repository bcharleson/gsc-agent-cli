# gsc-agent-cli

CLI **and** MCP server for the [Google Search Console API](https://developers.google.com/webmaster-tools/v1/api_reference_index) — sites, sitemaps, search analytics, URL inspection, and a composite indexing report. Built so a human at the terminal and an AI agent over MCP see the exact same capabilities.

```bash
npm install -g gsc-agent-cli
```

## What it covers

The entire public Search Console API surface, one command per function:

| Command | API method | Mode |
|---|---|---|
| `gsc sites list` | `sites.list` | read |
| `gsc sites get [site]` | `sites.get` | read |
| `gsc sites add <site>` | `sites.add` | write |
| `gsc sites delete <site>` | `sites.delete` | write |
| `gsc sitemaps list` | `sitemaps.list` | read |
| `gsc sitemaps get <feedpath>` | `sitemaps.get` | read |
| `gsc sitemaps submit <feedpath>` | `sitemaps.submit` | write |
| `gsc sitemaps delete <feedpath>` | `sitemaps.delete` | write |
| `gsc search-analytics query` | `searchanalytics.query` | read |
| `gsc search-analytics top-queries` | wrapper | read |
| `gsc search-analytics top-pages` | wrapper | read |
| `gsc inspect url <url>` | `urlInspection.index.inspect` | read |
| `gsc indexing report` | composite (sitemap + inspection) | read |

> **Not available in any Google API:** the "Recommendations" cards and the Experience / Core Web Vitals report. `gsc indexing report` reconstructs the indexed-vs-not overview by inspecting sitemap URLs individually, since that aggregate has no direct endpoint.

## Auth

Two methods, resolved in this order: `--key-file` → `GOOGLE_APPLICATION_CREDENTIALS` → `GSC_SERVICE_ACCOUNT_JSON` → stored service-account path → stored OAuth token.

### Service account (recommended for agents / cron)

1. Google Cloud Console → create a service account → download its JSON key.
2. Enable the **Google Search Console API** for the project.
3. In Search Console → Settings → Users and permissions → add the service account's email as a **Full** (or Restricted) user.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
gsc status
gsc config set-site sc-domain:topoffunnel.com
```

### OAuth (acts as your Google account, sees all your properties)

1. Google Cloud Console → Credentials → OAuth client ID → **Desktop app**.
2. Add `http://localhost:4280/oauth2callback` as an authorized redirect URI.

```bash
gsc login --client-id <id> --client-secret <secret>
```

## Examples

```bash
# Top 25 queries over the last 28 days
gsc search-analytics top-queries --days 28 --row-limit 25 --pretty

# Clicks/impressions by page and query for a fixed range
gsc search-analytics query -d page,query --start-date 2026-05-01 --end-date 2026-05-31

# Filter to one country
gsc search-analytics query -d query \
  --filters '[{"filters":[{"dimension":"country","expression":"usa"}]}]'

# Is this URL indexed?
gsc inspect url https://www.topoffunnel.com/resources/clay-cli

# Reconstruct the "indexed vs not" overview from the sitemap
gsc indexing report --limit 100 --details --pretty

# Sitemap health
gsc sitemaps list
gsc sitemaps submit https://www.topoffunnel.com/sitemap.xml
```

Every command outputs JSON by default (`--pretty` for indented, `--quiet` for exit-code-only, `--fields a,b` to project fields).

## MCP

```bash
gsc mcp   # stdio MCP server exposing every command as a tool
```

```json
{
  "mcpServers": {
    "gsc": {
      "command": "gsc",
      "args": ["mcp"],
      "env": { "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/key.json" }
    }
  }
}
```

## License

MIT
