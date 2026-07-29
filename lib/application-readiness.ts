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
  databaseReachable: boolean;
  ingestTokenConfigured: boolean;
  dashboardAuthConfigured: boolean;
}): ApplicationReadiness {
  const checkedAt = new Date(input.checkedAt);
  if (Number.isNaN(checkedAt.getTime())) throw new Error('checkedAt must be a valid ISO timestamp.');
  if (!input.version.trim()) throw new Error('version must not be empty.');

  const checks: ReadinessCheck[] = [
    {
      name: 'database',
      ok: input.databaseReachable,
      detail: input.databaseReachable ? 'Database connection available.' : 'Database connection unavailable.'
    },
    {
      name: 'ingest-token',
      ok: input.ingestTokenConfigured,
      detail: input.ingestTokenConfigured ? 'N8N ingest token configured.' : 'N8N ingest token missing.'
    },
    {
      name: 'dashboard-auth',
      ok: input.dashboardAuthConfigured,
      detail: input.dashboardAuthConfigured ? 'Dashboard basic authentication configured.' : 'Dashboard basic authentication not configured.'
    }
  ];

  return {
    status: checks.every(check => check.ok) ? 'ready' : 'degraded',
    checkedAt: checkedAt.toISOString(),
    version: input.version,
    checks
  };
}
