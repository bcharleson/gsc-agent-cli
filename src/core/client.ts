import { google, type searchconsole_v1 } from 'googleapis';
import { resolveAuth } from './auth.js';
import { wrapApiError } from './errors.js';

/**
 * Wrapper over the official Search Console API v1 client. The v1 discovery doc
 * covers the entire owned-property surface: sites, sitemaps, searchanalytics,
 * and urlInspection.
 *
 * Auth is resolved **lazily** on first `.call()`. This matters because the CLI
 * also hosts key-based commands (CrUX, PageSpeed Insights) that need no OAuth —
 * constructing the client for those must never trigger GSC credential lookup.
 */
export class GSCClient {
  private keyFile?: string;
  private scPromise?: Promise<searchconsole_v1.Searchconsole>;

  constructor(opts: { keyFile?: string } = {}) {
    this.keyFile = opts.keyFile;
  }

  /** Back-compat factory; auth still resolves lazily on first call. */
  static async create(keyFile?: string): Promise<GSCClient> {
    return new GSCClient({ keyFile });
  }

  private sc(): Promise<searchconsole_v1.Searchconsole> {
    if (!this.scPromise) {
      this.scPromise = resolveAuth(this.keyFile).then((auth) =>
        google.searchconsole({ version: 'v1', auth }),
      );
    }
    return this.scPromise;
  }

  /**
   * Runs a Search Console API call, returning the response body and converting
   * any googleapis/gaxios error into a typed GSCError.
   */
  async call<T>(fn: (sc: searchconsole_v1.Searchconsole) => Promise<{ data: T }>): Promise<T> {
    try {
      const sc = await this.sc();
      const res = await fn(sc);
      return res.data;
    } catch (error) {
      throw wrapApiError(error);
    }
  }
}
