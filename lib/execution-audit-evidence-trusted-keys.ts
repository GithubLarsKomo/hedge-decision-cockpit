import { createPublicKey } from 'node:crypto';

export type TrustedExecutionAuditSigningKey = {
  keyId: string;
  publicKeyPem: string;
  activeFrom: string;
  revokedAt?: string;
};

export type TrustedExecutionAuditSigningKeyRegistry = {
  schemaVersion: '1.0';
  keys: TrustedExecutionAuditSigningKey[];
};

function normalizeTimestamp(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid timestamp.`);
  return new Date(timestamp).toISOString();
}

function normalizeKey(key: TrustedExecutionAuditSigningKey): TrustedExecutionAuditSigningKey {
  const keyId = key.keyId.trim();
  if (!keyId) throw new Error('keyId must not be empty.');

  const publicKeyPem = key.publicKeyPem.trim();
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error(`Trusted key ${keyId} must be Ed25519.`);

  const activeFrom = normalizeTimestamp(key.activeFrom, `activeFrom for ${keyId}`);
  const revokedAt = key.revokedAt ? normalizeTimestamp(key.revokedAt, `revokedAt for ${keyId}`) : undefined;
  if (revokedAt && Date.parse(revokedAt) <= Date.parse(activeFrom)) {
    throw new Error(`revokedAt for ${keyId} must be later than activeFrom.`);
  }

  return { keyId, publicKeyPem: `${publicKeyPem}\n`, activeFrom, ...(revokedAt ? { revokedAt } : {}) };
}

export function normalizeTrustedExecutionAuditSigningKeyRegistry(
  registry: TrustedExecutionAuditSigningKeyRegistry
): TrustedExecutionAuditSigningKeyRegistry {
  if (registry.schemaVersion !== '1.0') throw new Error('Unsupported trusted key registry schemaVersion.');
  if (!Array.isArray(registry.keys) || registry.keys.length === 0) {
    throw new Error('Trusted key registry must contain at least one key.');
  }

  const keys = registry.keys.map(normalizeKey);
  const keyIds = new Set<string>();
  for (const key of keys) {
    if (keyIds.has(key.keyId)) throw new Error(`Duplicate trusted keyId: ${key.keyId}.`);
    keyIds.add(key.keyId);
  }

  return {
    schemaVersion: '1.0',
    keys: keys.sort((left, right) => left.keyId.localeCompare(right.keyId))
  };
}

export function parseTrustedExecutionAuditSigningKeyRegistry(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Trusted key registry must contain valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Trusted key registry must be a JSON object.');
  }
  return normalizeTrustedExecutionAuditSigningKeyRegistry(parsed as TrustedExecutionAuditSigningKeyRegistry);
}

export function resolveTrustedExecutionAuditSigningKey(
  registry: TrustedExecutionAuditSigningKeyRegistry,
  keyId: string,
  signedAt: string
) {
  const normalized = normalizeTrustedExecutionAuditSigningKeyRegistry(registry);
  const signingTimestamp = Date.parse(normalizeTimestamp(signedAt, 'signedAt'));
  const key = normalized.keys.find(candidate => candidate.keyId === keyId.trim());
  if (!key) throw new Error(`Unknown signing keyId: ${keyId.trim()}.`);
  if (signingTimestamp < Date.parse(key.activeFrom)) throw new Error(`Signing key ${key.keyId} was not active at signedAt.`);
  if (key.revokedAt && signingTimestamp >= Date.parse(key.revokedAt)) {
    throw new Error(`Signing key ${key.keyId} was revoked at signedAt.`);
  }
  return key;
}

export function serializeTrustedExecutionAuditSigningKeyRegistry(
  registry: TrustedExecutionAuditSigningKeyRegistry
) {
  return `${JSON.stringify(normalizeTrustedExecutionAuditSigningKeyRegistry(registry), null, 2)}\n`;
}
