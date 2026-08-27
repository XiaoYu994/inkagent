export class InkAgentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InkAgentError';
  }
}

export function formatError(error: unknown, options?: { verbose?: boolean }): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  if (!options?.verbose) {
    return error.message;
  }

  const lines = [error.stack ?? error.message];
  let cause = error.cause;
  while (cause instanceof Error) {
    lines.push(`Caused by: ${cause.message}`);
    cause = cause.cause;
  }
  return lines.join('\n');
}
