import { createHash } from 'node:crypto';

export type ExecutionAuditSigningRegistryReleaseManifestEntry = {
  name: 'registry' | 'fingerprint' | 'signature' | 'trustRegistry';
  sha256: string;
  byteLength: number;
};

export type ExecutionAuditSigningRegistryReleaseManifest = {
  schemaVersion: '1.0';
  algorithm: 'SHA-256';
  files: ExecutionAuditSigningRegistryReleaseManifestEntry[];
};

function createEntry(
  name: ExecutionAuditSigningRegistryReleaseManifestEntry['name'],
  content: string
): ExecutionAuditSigningRegistryReleaseManifestEntry {
  return {
    name,
    sha256: createHash('sha256').update(content, 'utf8').digest('hex'),
    byteLength: Buffer.byteLength(content, 'utf8')
  };
}

export function createExecutionAuditSigningRegistryReleaseManifest(input: {
  registryContent: string;
  fingerprintContent: string;
  signatureContent: string;
  trustRegistryContent: string;
}): ExecutionAuditSigningRegistryReleaseManifest {
  return {
    schemaVersion: '1.0',
    algorithm: 'SHA-256',
    files: [
      createEntry('registry', input.registryContent),
      createEntry('fingerprint', input.fingerprintContent),
      createEntry('signature', input.signatureContent),
      createEntry('trustRegistry', input.trustRegistryContent)
    ]
  };
}

export function serializeExecutionAuditSigningRegistryReleaseManifest(
  manifest: ExecutionAuditSigningRegistryReleaseManifest
) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
