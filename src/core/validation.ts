import { z } from 'zod';
import type { GlobalOptions } from './types.js';
import { ValidationError } from './errors.js';

/** Positive integer limit with a sane default, accepts string input from CLI. */
export const positiveLimit = z.coerce
  .number()
  .int()
  .positive()
  .optional();

export function assertValidOutputFormat(output: string | undefined): void {
  if (output && output !== 'json' && output !== 'pretty') {
    throw new ValidationError(`Invalid --output format "${output}". Use "json" or "pretty".`);
  }
}

/** Normalizes commander's mixed-case option bag into GlobalOptions. */
export function normalizeGlobalOptions(opts: Record<string, unknown>): GlobalOptions {
  const normalized: GlobalOptions = { ...opts };
  if (opts.pretty) normalized.output = 'pretty';
  if (!normalized.output) normalized.output = 'json';
  return normalized;
}

/** Turns a Zod error into a single readable ValidationError. */
export function formatInputValidationError(error: z.ZodError): ValidationError {
  const issues = error.issues
    .map((i) => {
      const path = i.path.join('.');
      return path ? `${path}: ${i.message}` : i.message;
    })
    .join('; ');
  return new ValidationError(`Invalid input — ${issues}`);
}

/**
 * Parses fields declared as JSON-string-or-object so a CLI user can pass
 * `--filters '{"...":...}'` while an MCP agent can pass a real object.
 */
export function parseJsonField(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new ValidationError(`Expected valid JSON but got: ${value}`);
    }
  }
  return value;
}
