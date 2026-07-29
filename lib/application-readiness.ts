export type ReadinessCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type ApplicationReadiness = {
  status: 'ready' | 'degraded';
  checkedAt: string;
  version: string;
  checks: ReadinessCheck[];
};

export function evaluateApplicationReadiness(input: {
  checkedAt: string;
  version: string;
  checks: ReadinessCheck[];
}): ApplicationReadiness {
  const checkedAt = new Date(input.checkedAt);
  if (Number.isNaN(checkedAt.getTime())) throw new Error('checkedAt must be a valid ISO timestamp.');
  if (!input.version.trim()) throw new Error('version must not be empty.');
  if (input.checks.length === 0) throw new Error('checks must not be empty.');
  if (input.checks.some(check => !check.name.trim() || !check.detail.trim())) {
    throw new Error('check name and detail must not be empty.');
  }

  return {
    status: input.checks.every(check => check.ok) ? 'ready' : 'degraded',
    checkedAt: checkedAt.toISOString(),
    version: input.version,
    checks: input.checks
  };
}
