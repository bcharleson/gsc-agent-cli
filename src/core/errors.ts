export class GSCError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code = 'GSC_ERROR', status?: number) {
    super(message);
    this.name = 'GSCError';
    this.code = code;
    this.status = status;
  }
}

export class AuthError extends GSCError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends GSCError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends GSCError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends GSCError {
  retryAfter?: number;
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Normalizes errors thrown by the googleapis library (GaxiosError) and our
 * own error classes into a consistent {message, code} shape.
 */
export function formatError(error: unknown): { message: string; code: string } {
  if (error instanceof GSCError) {
    return { message: error.message, code: error.code };
  }

  // googleapis / gaxios errors carry a `.response.data.error`
  const anyErr = error as any;
  const apiError = anyErr?.response?.data?.error;
  if (apiError) {
    const message =
      typeof apiError === 'string'
        ? apiError
        : apiError.message ?? JSON.stringify(apiError);
    const status = anyErr?.response?.status ?? apiError.code;
    return { message, code: codeForStatus(status) };
  }

  if (error instanceof Error) {
    return { message: error.message, code: 'UNKNOWN_ERROR' };
  }

  return { message: String(error), code: 'UNKNOWN_ERROR' };
}

/**
 * Maps a googleapis error onto one of our typed error classes so callers
 * (and the retry layer) can branch on it.
 */
export function wrapApiError(error: unknown): GSCError {
  if (error instanceof GSCError) return error;
  const { message } = formatError(error);
  const status = (error as any)?.response?.status ?? (error as any)?.code;
  switch (status) {
    case 401:
    case 403:
      return new AuthError(message);
    case 404:
      return new NotFoundError(message);
    case 400:
    case 422:
      return new ValidationError(message);
    case 429:
      return new RateLimitError(message);
    default:
      return new GSCError(message, codeForStatus(status), typeof status === 'number' ? status : undefined);
  }
}

function codeForStatus(status: unknown): string {
  switch (status) {
    case 401:
    case 403:
      return 'AUTH_ERROR';
    case 404:
      return 'NOT_FOUND';
    case 400:
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMIT';
    default:
      return 'API_ERROR';
  }
}
