import type { z } from 'zod';
import type { GSCClient } from './client.js';

export type { GSCClient };

/** Global options available on every command (CLI flags + MCP defaults). */
export interface GlobalOptions {
  output?: 'json' | 'pretty';
  pretty?: boolean;
  quiet?: boolean;
  fields?: string;
  keyFile?: string;
  [key: string]: unknown;
}

/** A positional CLI argument. */
export interface CommandArg {
  name: string;
  field: string;
  required: boolean;
}

/** A CLI option flag mapped onto an input field. */
export interface CommandOption {
  field: string;
  flags: string;
  description?: string;
}

/**
 * A single command definition — the source of truth shared by the CLI
 * registrar and the MCP server. Add one of these and the function is
 * instantly available to humans (terminal) and agents (MCP).
 */
export interface CommandDefinition {
  /** MCP tool name, snake_case (e.g. "search_analytics_query"). */
  name: string;
  /** CLI command group (e.g. "sites"). */
  group: string;
  /** CLI subcommand within the group (e.g. "list"). */
  subcommand: string;
  /** Human + agent facing description. */
  description: string;
  /** Example invocations shown in CLI help. */
  examples?: string[];
  /** Zod schema validating the input object. */
  inputSchema: z.ZodObject<any>;
  /** How CLI args/options map onto input fields. */
  cliMappings: {
    args?: CommandArg[];
    options?: CommandOption[];
  };
  /** Does this command only read data? Used for MCP safety annotation. */
  readOnly?: boolean;
  /** The actual work: receives validated input + an authed client. */
  handler: (input: Record<string, any>, client: GSCClient) => Promise<unknown>;
}
