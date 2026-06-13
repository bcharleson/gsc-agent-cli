import { google, type searchconsole_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { resolveAuth } from './auth.js';
import { wrapApiError } from './errors.js';

/**
 * Thin wrapper over the official Search Console API v1 client. The v1
 * discovery doc covers the entire public surface: sites, sitemaps,
 * searchanalytics, and urlInspection — so one service object is all we need.
 *
 * Every handler receives an instance and calls `client.sc.<resource>.<method>`.
 * `call()` unwraps the `{ data }` envelope and normalizes errors.
 */
export class GSCClient {
  readonly sc: searchconsole_v1.Searchconsole;

  constructor(auth: OAuth2Client) {
    this.sc = google.searchconsole({ version: 'v1', auth });
  }

  /** Resolve credentials and build a client in one step. */
  static async create(keyFile?: string): Promise<GSCClient> {
    const auth = await resolveAuth(keyFile);
    return new GSCClient(auth);
  }

  /**
   * Runs an API call, returning the response body and converting any
   * googleapis/gaxios error into a typed GSCError.
   */
  async call<T>(fn: (sc: searchconsole_v1.Searchconsole) => Promise<{ data: T }>): Promise<T> {
    try {
      const res = await fn(this.sc);
      return res.data;
    } catch (error) {
      throw wrapApiError(error);
    }
  }
}
