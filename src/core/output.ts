import type { GlobalOptions } from './types.js';
import { formatError } from './errors.js';

/** Prints a result as JSON (default) or pretty-printed JSON. */
export function output(data: unknown, options: GlobalOptions = {}): void {
  if (options.quiet) return;

  let result = data;
  if (options.fields && typeof data === 'object' && data !== null) {
    const fields = options.fields.split(',').map((f) => f.trim());
    result = applyFieldsFilter(data, fields);
  }

  if (options.output === 'pretty') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(JSON.stringify(result));
  }
}

/** Prints an error to stderr and sets exit code 1. */
export function outputError(error: unknown, options: GlobalOptions = {}): void {
  const formatted = formatError(error);
  if (options.quiet) {
    process.exitCode = 1;
    return;
  }
  if (options.output === 'pretty') {
    console.error(`Error: ${formatted.message}`);
  } else {
    console.error(JSON.stringify({ error: formatted.message, code: formatted.code }));
  }
  process.exitCode = 1;
}

/** Picks a subset of top-level fields, recursing into common array wrappers. */
function applyFieldsFilter(data: unknown, fields: string[]): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => pickFields(item, fields));
  }
  if (typeof data !== 'object' || data === null) return data;

  const record = data as Record<string, unknown>;
  // GSC list responses wrap rows in known array keys
  for (const key of ['rows', 'siteEntry', 'sitemap']) {
    if (Array.isArray(record[key])) {
      return { ...record, [key]: (record[key] as unknown[]).map((i) => pickFields(i, fields)) };
    }
  }
  return pickFields(record, fields);
}

function pickFields(item: unknown, fields: string[]): unknown {
  if (typeof item !== 'object' || item === null) return item;
  const obj = item as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
  }
  return result;
}
