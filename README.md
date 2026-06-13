# gsc-agent-cli

> **Headless Google Search Console for humans and AI agents.** Everything you can see and do in the Search Console UI (search performance, indexing, sitemaps, URL inspection) as plain JSON from the terminal, plus the Core Web Vitals and PageSpeed data the Search Console UI shows but its API never exposes. One binary, one MCP server, the whole search-visibility picture.

```bash
npm install -g gsc-agent-cli
gsc snapshot site --site sc-domain:example.com --pretty
```

- 🤖 **Built for agents.** Every command is also an [MCP](https://modelcontextprotocol.io) tool. Point Claude, Cursor, or any MCP client at `gsc mcp` and it can monitor and optimize a site's search presence autonomously.
- 🧑‍💻 **Built for humans.** Sensible defaults, copy-paste recipes, JSON you can pipe into `jq`.
- 🔭 **Holistic.** Combines *owned-property* GSC data (rankings, indexing, sitemaps) with *outside-GSC* signals (real-user Core Web Vitals via CrUX, lab performance via PageSpeed Insights): the two halves of "are we discoverable, and are we fast?"
- 🪪 **Headless-first auth.** Service-account JSON for cron/agents, or OAuth to act as your own Google account.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [What it covers](#what-it-covers)
- [Install](#install)
- [Setup (step by step)](#setup-step-by-step)
  - [Option A: Service account (recommended for agents & automation)](#option-a-service-account-recommended-for-agents--automation)
  - [Option B: OAuth (act as your own Google account)](#option-b-oauth-act-as-your-own-google-account)
  - [API key for Core Web Vitals & PageSpeed](#api-key-for-core-web-vitals--pagespeed)
  - [Verify your setup](#verify-your-setup)
- [Command reference](#command-reference)
- [Recipes](#recipes)
- [Using it from an AI agent (MCP)](#using-it-from-an-ai-agent-mcp)
- [How it helps you get discovered & optimized](#how-it-helps-you-get-discovered--optimized)
- [Output, flags & exit codes](#output-flags--exit-codes)
- [Rate limits & gotchas](#rate-limits--gotchas)
- [What is *not* possible](#what-is-not-possible)
- [Architecture](#architecture)
- [License](#license)

---

## Why this exists

The Search Console web UI is great for clicking around. It is terrible for **automation**: you can't put "is this URL indexed?" in a script, you can't diff last week's rankings in CI, and an AI agent can't read a chart. The official APIs *can* do these things, but they're split across several services with different auth models and awkward request shapes.

`gsc-agent-cli` collapses all of that into one tool with one mental model: **one command per capability, JSON in and out, the same surface for a human typing and an agent calling MCP tools.** That means an autonomous agent can now run the full loop a human SEO would: pull the performance report → find pages losing position → inspect their index status → check their Core Web Vitals → resubmit a sitemap → re-measure. Headlessly. On a schedule.

---

## What it covers

Two planes of data behind one binary:

### Plane 1: Inside Search Console (your verified properties)

Requires OAuth or a service account with access to the property.

| Command | Search Console API method | What you get |
|---|---|---|
| `gsc sites list` | `sites.list` | Every property you can access + permission level |
| `gsc sites get` | `sites.get` | One property's details |
| `gsc sites add` / `delete` | `sites.add` / `delete` | Manage properties in the account |
| `gsc sitemaps list` | `sitemaps.list` | All sitemaps + errors, warnings, indexed counts |
| `gsc sitemaps get` | `sitemaps.get` | One sitemap's full status |
| `gsc sitemaps submit` / `delete` | `sitemaps.submit` / `delete` | (Re)submit or remove a sitemap |
| `gsc search-analytics query` | `searchanalytics.query` | Clicks, impressions, CTR, position by query/page/country/device/date |
| `gsc search-analytics top-queries` | wrapper | Top queries by clicks |
| `gsc search-analytics top-pages` | wrapper | Top pages by clicks |
| `gsc inspect url` | `urlInspection.index.inspect` | Index status, last crawl, canonical, mobile usability, rich results |
| `gsc indexing report` | composite | Reconstructs the "indexed vs not indexed" overview by inspecting sitemap URLs |

### Plane 2: Outside Search Console (any public URL, just an API key)

These fill the gaps the Search Console API leaves open, most importantly the **Experience / Core Web Vitals** section the UI shows but the API does not return.

| Command | API | What you get |
|---|---|---|
| `gsc crux query` | Chrome UX Report | **Real-user** Core Web Vitals (LCP, INP, CLS, FCP, TTFB) for an origin or page |
| `gsc pagespeed run` | PageSpeed Insights | **Lab** Lighthouse scores (performance, SEO, accessibility, best-practices) + field data |

### Plane 1 + 2 fused

| Command | What you get |
|---|---|
| `gsc snapshot site` | One call → permission level, sitemap health, search totals, top queries, **and** real-user Core Web Vitals. The whole health picture, degrading gracefully if any source is missing. |

---

## Install

**Global (recommended):**
```bash
npm install -g gsc-agent-cli
gsc --version
```

**Without installing (npx):**
```bash
npx gsc-agent-cli sites list
```

**From source (for development / before npm publish):**
```bash
git clone https://github.com/bcharleson/gsc-agent-cli.git
cd gsc-agent-cli
npm install
npm run build
npm link            # makes `gsc` available globally
```

Requires Node.js ≥ 18.

---

## Setup (step by step)

You need **credentials for the property you want to read**. Pick one of two methods. For agents, cron jobs, and CI, use a **service account**. For interactive use as yourself, use **OAuth**.

> **First, know your property URL format.** Search Console has two kinds of property, and the string you pass as `--site` differs:
> - **Domain property** → `sc-domain:example.com` (covers all subdomains + http/https)
> - **URL-prefix property** → `https://www.example.com/` (exact prefix, trailing slash matters)
>
> Run `gsc sites list` after setup to see the exact strings you have access to.

### Option A: Service account (recommended for agents & automation)

A service account is a non-human Google identity with its own key file. No browser, no token refresh, works headless forever. **~3 minutes.**

**1. Create a Google Cloud project** (or reuse one)
- Go to **[console.cloud.google.com](https://console.cloud.google.com)** → project picker (top bar) → **New Project** → name it (e.g. `seo-tools`) → **Create**.

**2. Enable the APIs**
- **APIs & Services → Library**, then enable each of these (search the name, click **Enable**):
  - **Google Search Console API** for all Plane 1 commands
  - **Chrome UX Report API** for `gsc crux query`
  - **PageSpeed Insights API** for `gsc pagespeed run`

**3. Create the service account**
- **APIs & Services → Credentials → Create credentials → Service account**.
- Name it (e.g. `gsc-cli`) → **Create and continue** → skip the optional role/grant steps → **Done**.

**4. Download its JSON key**
- Click the new service account → **Keys → Add key → Create new key → JSON → Create**.
- A `.json` file downloads. Keep it private. Move it somewhere stable, e.g.:
  ```bash
  mkdir -p ~/.config/gsc-keys
  mv ~/Downloads/seo-tools-*.json ~/.config/gsc-keys/gsc-sa.json
  chmod 600 ~/.config/gsc-keys/gsc-sa.json
  ```

**5. ⚠️ Grant the service account access to your property** *(the step everyone forgets)*
- Copy the service account's email (it looks like `gsc-cli@seo-tools.iam.gserviceaccount.com`, visible on the Credentials page).
- Go to **[Search Console](https://search.google.com/search-console)** → select your property → **Settings (gear) → Users and permissions → Add user**.
- Paste the service account email, set permission to **Full** (or **Restricted** for read-only), → **Add**.
- *Without this, every Plane 1 call returns `403`. Plane 2 (CrUX/PageSpeed) does not need it.*

**6. Point the CLI at the key**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gsc-keys/gsc-sa.json
# Or persist it so you don't need the env var every shell:
gsc config use-key-file ~/.config/gsc-keys/gsc-sa.json
```

**7. Set a default property** so you can omit `--site` everywhere
```bash
gsc config set-site sc-domain:example.com
```

Done. Jump to [Verify your setup](#verify-your-setup).

### Option B: OAuth (act as your own Google account)

Use this when you want the tool to see **every property your Google login can access**, with no per-property grant. Involves a one-time browser consent.

**1. Create an OAuth client**
- Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID**.
- If prompted, configure the consent screen (External, add your email as a test user).
- Application type: **Desktop app** → **Create**.
- Add this authorized redirect URI: `http://localhost:4280/oauth2callback`.
- Copy the **Client ID** and **Client secret**.

**2. Log in**
```bash
gsc login --client-id <CLIENT_ID> --client-secret <CLIENT_SECRET>
```
A URL prints; open it, approve, and the loopback server captures the token automatically. The refresh token is stored in `~/.gsc/config.json` (mode `600`).

> Tip: set `GSC_OAUTH_CLIENT_ID` / `GSC_OAUTH_CLIENT_SECRET` and just run `gsc login`.

### API key for Core Web Vitals & PageSpeed

`crux query` and `pagespeed run` use a simple **API key**, independent of the GSC auth above.

- Google Cloud Console → **APIs & Services → Credentials → Create credentials → API key** → copy it.
- Make sure the **Chrome UX Report API** and **PageSpeed Insights API** are enabled (step A.2).
```bash
export GOOGLE_API_KEY=<your-key>
# or persist it:
gsc config set-api-key <your-key>
```
*(PageSpeed works without a key but is heavily rate-limited; CrUX requires one.)*

### Verify your setup

```bash
gsc status              # shows active credential source and confirms it by listing properties
gsc sites list --pretty # lists every property you can access (and the exact --site strings)
gsc config show         # shows default site, key file, oauth, api key state
```

If `gsc status` reports `verified: true` with an `accessibleProperties` count, you're ready.

---

## Command reference

All commands print JSON to stdout. Global flags (below) work on every command.

### Auth & config
```bash
gsc login [--client-id <id>] [--client-secret <secret>]   # OAuth flow
gsc logout                                                # remove stored credentials
gsc status [--key-file <path>]                            # show + verify active credentials
gsc config set-site <siteUrl>                             # default property
gsc config use-key-file <path>                            # default service-account key
gsc config set-api-key <key>                              # default Google API key (CrUX/PSI)
gsc config show                                           # current config (secrets redacted)
```

### Sites
```bash
gsc sites list
gsc sites get [site] [--site <siteUrl>]
gsc sites add <site>
gsc sites delete <site>
```

### Sitemaps
```bash
gsc sitemaps list [--site <siteUrl>] [--sitemap-index <url>]
gsc sitemaps get <feedpath> [--site <siteUrl>]
gsc sitemaps submit <feedpath> [--site <siteUrl>]
gsc sitemaps delete <feedpath> [--site <siteUrl>]
```

### Search analytics (the performance report)
```bash
gsc search-analytics query [options]
  --site <siteUrl>             # property (or use default)
  -d, --dimensions <list>      # query,page,country,device,date,searchAppearance
  --days <n>                   # lookback window (default 28)
  --start-date <YYYY-MM-DD>    # explicit start (overrides --days)
  --end-date <YYYY-MM-DD>      # explicit end (default ~2 days ago for data lag)
  --type <type>                # web|image|video|news|discover|googleNews
  --filters <json>             # dimensionFilterGroups as JSON
  -l, --row-limit <n>          # max rows (default 1000, max 25000)
  --start-row <n>              # pagination offset
  --aggregation-type <type>    # auto|byPage|byProperty
  --data-state <state>         # final|all  (all = include fresh, incomplete data)

gsc search-analytics top-queries [--days <n>] [-l <n>] [--site <siteUrl>]
gsc search-analytics top-pages   [--days <n>] [-l <n>] [--site <siteUrl>]
```

### URL inspection
```bash
gsc inspect url <url> [--site <siteUrl>] [--language <bcp47>]
```

### Indexing report (composite)
```bash
gsc indexing report [options]
  --site <siteUrl>
  --sitemap <url>        # which sitemap to read URLs from (defaults to first listed)
  -l, --limit <n>        # max URLs to inspect (default 100; API cap 2000/day)
  --concurrency <n>      # parallel inspections (default 5, max 10)
  --details              # include the per-URL breakdown, not just the summary
```

### Core Web Vitals (CrUX) & PageSpeed
```bash
gsc crux query (--origin <origin> | --url <url>) [--form-factor PHONE|TABLET|DESKTOP|ALL_FORM_FACTORS] [--api-key <key>]
gsc pagespeed run --url <url> [--strategy mobile|desktop] [--category <list>] [--raw] [--api-key <key>]
```

### Holistic snapshot
```bash
gsc snapshot site [--site <siteUrl>] [--origin <origin>] [--days <n>] [--top-limit <n>] [--api-key <key>]
```

### MCP server
```bash
gsc mcp     # start the stdio MCP server (exposes every command as a tool)
```

---

## Recipes

```bash
# Top 25 queries last 28 days, pretty-printed
gsc search-analytics top-queries --days 28 -l 25 --pretty

# Clicks/impressions by page AND query for a fixed month
gsc search-analytics query -d page,query --start-date 2026-05-01 --end-date 2026-05-31

# Only US traffic, by query
gsc search-analytics query -d query \
  --filters '[{"filters":[{"dimension":"country","expression":"usa"}]}]'

# Which of my queries are stuck on page 2? (position 11-20), with jq
gsc search-analytics query -d query -l 1000 \
  | jq '.rows[] | select(.position > 10 and .position <= 20) | {query: .keys[0], position, impressions}'

# Is a specific page indexed?
gsc inspect url https://www.example.com/pricing \
  | jq '.inspectionResult.indexStatusResult.coverageState'

# What share of my sitemap is actually indexed?
gsc indexing report --limit 200 --pretty

# Real-user Core Web Vitals for the whole site (mobile)
gsc crux query --origin https://www.example.com --form-factor PHONE --pretty

# Lab performance + SEO score for the homepage
gsc pagespeed run --url https://www.example.com --category performance,seo --pretty

# The whole health picture in one call
gsc snapshot site --pretty

# Resubmit a sitemap after a deploy
gsc sitemaps submit https://www.example.com/sitemap.xml
```

---

## Using it from an AI agent (MCP)

Every command is exposed as an MCP tool by `gsc mcp`. Add it to your MCP client config:

```json
{
  "mcpServers": {
    "gsc": {
      "command": "gsc",
      "args": ["mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/gsc-sa.json",
        "GOOGLE_API_KEY": "your-crux-pagespeed-key"
      }
    }
  }
}
```
*(Or `"command": "npx", "args": ["gsc-agent-cli", "mcp"]` if not installed globally.)*

**Tool names** (snake_case) map 1:1 to the commands:

| Tool | Tool | Tool |
|---|---|---|
| `sites_list` | `sitemaps_list` | `search_analytics_query` |
| `sites_get` | `sitemaps_get` | `top_queries` |
| `sites_add` | `sitemaps_submit` | `top_pages` |
| `sites_delete` | `sitemaps_delete` | `inspect_url` |
| `indexing_report` | `crux_query` | `pagespeed_run` |
| `snapshot_site` | | |

**Contract for agents:**
- Inputs are JSON objects matching each tool's schema (e.g. `{"dimensions": "query", "days": 28}`). Read-only tools are annotated `readOnlyHint: true`.
- Every tool returns a JSON string. Errors return `{"error": "...", "code": "..."}` with `isError: true`.
- Property URLs use `sc-domain:example.com` or `https://www.example.com/`. Set a default with `gsc config set-site` so the agent can omit `site`.
- See [`AGENTS.md`](./AGENTS.md) for a condensed agent playbook.

---

## How it helps you get discovered & optimized

The point of Search Console is the two questions every site owner actually cares about. This tool answers both, end to end, without a human in the loop:

**1. "Is Google finding and indexing my content?" (discovery)**
- `sitemaps submit` + `sitemaps list` → make sure Google has your URL inventory and it's downloading cleanly.
- `indexing report` → know what fraction of your sitemap is actually indexed, and *why* the rest isn't (`coverageState`).
- `inspect url` → debug any single page: crawled? indexed? canonical correct? blocked by robots?

**2. "Am I ranking, and is the experience good enough to keep ranking?" (optimization)**
- `search-analytics query` → the raw signal: which queries and pages drive clicks/impressions, and at what position. Diff it over time to catch decay.
- `top-pages` / `top-queries` → where to focus.
- `crux query` → real-user Core Web Vitals, a confirmed ranking input. The GSC API hides this; this tool surfaces it.
- `pagespeed run` → lab diagnosis of *why* a page is slow, with concrete Lighthouse opportunities.

Because all of this is headless JSON, an agent can run it on a cron, store the history, and act: detect a page dropping from position 4 to 9, confirm it's indexed, notice its LCP regressed after a deploy, and open a ticket (or fix it). `snapshot site` is the one-shot version of that whole sweep.

---

## Output, flags & exit codes

**Global flags** (work on every command):

| Flag | Effect |
|---|---|
| `--pretty` | Indented JSON (default is compact, one line) |
| `--output json\|pretty` | Same as above, explicit |
| `--quiet` | Suppress stdout; rely on exit code |
| `--fields <a,b,c>` | Keep only these fields (projects into `rows`/`siteEntry`/`sitemap` arrays) |
| `--key-file <path>` | Service-account key for this invocation (overrides env + config) |

**Exit codes:** `0` success, `1` error. Errors print `{"error","code"}` to **stderr**. Codes include `AUTH_ERROR`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMIT`, `API_ERROR`.

**Credential resolution order:** `--key-file` → `GOOGLE_APPLICATION_CREDENTIALS` → `GSC_SERVICE_ACCOUNT_JSON` (inline) → stored key file → stored OAuth token.

**Environment variables:** `GOOGLE_APPLICATION_CREDENTIALS`, `GSC_SERVICE_ACCOUNT_JSON`, `GOOGLE_API_KEY`, `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`. Config lives at `~/.gsc/config.json`.

---

## Rate limits & gotchas

- **Service account must be added as a property user** or every Plane 1 call returns `403`. (Setup step A.5.)
- **URL Inspection** is limited to **2,000 queries/day and 600/min per property**. `indexing report` fans out over it, so always cap with `--limit`.
- **Search analytics data lags ~2 days.** Defaults end the range 2 days ago; use `--data-state all` to include fresh (incomplete) data.
- **CrUX needs enough traffic.** Low-traffic origins/pages return no record. That's a data-availability limit, not an error.
- **CrUX requires an API key;** PageSpeed works keyless but is rate-limited (you'll see a quota error fast without a key).

---

## What is *not* possible

Honesty about the gaps, because they shape what you can automate:

- **The "Recommendations" cards** in the GSC UI have no public API. Not available here.
- **The Experience / Core Web Vitals report inside the Search Console API** does not exist, which is exactly why this tool reaches out to CrUX and PageSpeed instead.
- **The aggregate "why not indexed" breakdown** isn't a single endpoint; `indexing report` reconstructs it by inspecting URLs individually (hence the rate limit).
- **Live SERP positions / rank tracking for arbitrary keywords** is not a Google API. Search Console only reports queries your site already appears for.

---

## Architecture

For contributors and agents reading the source:

- **One source of truth.** Every capability is a `CommandDefinition` (in `src/commands/**`). The array in `src/commands/index.ts` is iterated by *both* the CLI registrar and the MCP server (`src/mcp/server.ts`), so a command added once appears in both surfaces automatically.
- **Two auth planes, lazily resolved.** `src/core/client.ts` resolves GSC OAuth/service-account auth only on first owned-property call; key-based commands (`src/core/web.ts`) never trigger it. This is why `gsc pagespeed run` works with just an API key.
- **Stack:** TypeScript, [commander](https://github.com/tj/commander.js), [zod](https://zod.dev) (schemas drive both CLI validation and MCP tool input schemas), [googleapis](https://github.com/googleapis/google-api-nodejs-client), [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk), built with [tsup](https://tsup.egoist.dev).

```bash
npm run dev          # run from source (tsx)
npm run typecheck    # tsc --noEmit
npm run build        # bundle to dist/
npm test             # vitest
```

---

## License

MIT © Top of Funnel
