import { USER_AGENT } from './version.js';
import { GSCError } from './errors.js';

/** Extracts <loc> URLs from sitemap XML text (handles sitemap indexes too). */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new GSCError(`Failed to fetch sitemap ${url}: HTTP ${res.status}`, 'SITEMAP_FETCH', res.status);
  }
  return res.text();
}

/**
 * Fetches a sitemap (or sitemap index) and returns the page URLs it lists.
 * Recurses one level into child sitemaps when the top level is an index.
 * `max` caps the total returned to avoid runaway inspection fan-out.
 */
export async function fetchSitemapUrls(sitemapUrl: string, max = 200): Promise<string[]> {
  const xml = await fetchText(sitemapUrl);
  const locs = extractLocs(xml);

  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  if (!isIndex) {
    return locs.slice(0, max);
  }

  // Sitemap index: each <loc> is a child sitemap. Fetch children until full.
  const urls: string[] = [];
  for (const child of locs) {
    if (urls.length >= max) break;
    try {
      const childXml = await fetchText(child);
      urls.push(...extractLocs(childXml));
    } catch {
      // skip unreadable child sitemap
    }
  }
  return urls.slice(0, max);
}
