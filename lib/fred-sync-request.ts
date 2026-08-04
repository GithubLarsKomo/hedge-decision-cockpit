export class InvalidFredSyncPayloadError extends Error {
  constructor(message = 'Invalid payload') {
    super(message);
    this.name = 'InvalidFredSyncPayloadError';
  }
}

export type FredSyncRequestBody = {
  observationStart?: string;
  observationEnd?: string;
};

export function parseFredSyncRequestBody(rawBody: string): FredSyncRequestBody {
  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new InvalidFredSyncPayloadError();
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidFredSyncPayloadError();
  }

  const candidate = body as Record<string, unknown>;
  return {
    ...(typeof candidate.observationStart === 'string' ? { observationStart: candidate.observationStart } : {}),
    ...(typeof candidate.observationEnd === 'string' ? { observationEnd: candidate.observationEnd } : {})
  };
}
