import {
  createExecutionAuditSigningRegistryReleaseManifest,
  type ExecutionAuditSigningRegistryReleaseManifest
} from './execution-audit-signing-registry-release-manifest';

const expectedNames = ['registry', 'fingerprint', 'signature', 'trustRegistry'] as const;

export type ExecutionAuditSigningRegistryReleaseManifestVerification = {
  valid: boolean;
  mismatches: Array<{
    name: (typeof expectedNames)[number];
    expectedSha256: string;
    actualSha256: string;
    expectedByteLength: number;
    actualByteLength: number;
  }>;
};

export function parseExecutionAuditSigningRegistryReleaseManifest(
  content: string
): ExecutionAuditSigningRegistryReleaseManifest {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Release manifest must be a JSON object.');
  }

  const manifest = parsed as Partial<ExecutionAuditSigningRegistryReleaseManifest>;
  if (manifest.schemaVersion !== '1.0' || manifest.algorithm !== 'SHA-256') {
    throw new Error('Unsupported release manifest schema or algorithm.');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== expectedNames.length) {
    throw new Error('Release manifest must contain exactly four files.');
  }

  manifest.files.forEach((file, index) => {
    if (!file || file.name !== expectedNames[index]) {
      throw new Error('Release manifest file order or name is invalid.');
    }
    if (!/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error(`Invalid SHA-256 for ${file.name}.`);
    }
    if (!Number.isSafeInteger(file.byteLength) || file.byteLength < 0) {
      throw new Error(`Invalid byte length for ${file.name}.`);
    }
  });

  return manifest as ExecutionAuditSigningRegistryReleaseManifest;
}

export function verifyExecutionAuditSigningRegistryReleaseManifest(input: {
  manifestContent: string;
  registryContent: string;
  fingerprintContent: string;
  signatureContent: string;
  trustRegistryContent: string;
}): ExecutionAuditSigningRegistryReleaseManifestVerification {
  const expected = parseExecutionAuditSigningRegistryReleaseManifest(input.manifestContent);
  const actual = createExecutionAuditSigningRegistryReleaseManifest(input);
  const mismatches = expected.files.flatMap((expectedFile, index) => {
    const actualFile = actual.files[index];
    if (
      expectedFile.sha256 === actualFile.sha256 &&
      expectedFile.byteLength === actualFile.byteLength
    ) {
      return [];
    }
    return [{
      name: expectedFile.name,
      expectedSha256: expectedFile.sha256,
      actualSha256: actualFile.sha256,
      expectedByteLength: expectedFile.byteLength,
      actualByteLength: actualFile.byteLength
    }];
  });

  return { valid: mismatches.length === 0, mismatches };
}
