export type ExecutionAuditEvidenceManifest = {
  schemaVersion: '1.0';
  generatedAt: string;
  recordCount: number;
  csvByteLength: number;
  csvSha256: string;
};

export type ExecutionAuditEvidenceVerification = {
  valid: boolean;
  hashMatches: boolean;
  byteLengthMatches: boolean;
  expectedSha256: string;
  actualSha256: string;
  expectedByteLength: number;
  actualByteLength: number;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function assertEvidenceManifest(manifest: ExecutionAuditEvidenceManifest) {
  if (manifest.schemaVersion !== '1.0') {
    throw new Error('Unsupported execution audit evidence schemaVersion.');
  }
  if (!Number.isInteger(manifest.recordCount) || manifest.recordCount < 0) {
    throw new Error('recordCount must be a non-negative integer.');
  }
  if (!Number.isInteger(manifest.csvByteLength) || manifest.csvByteLength < 0) {
    throw new Error('csvByteLength must be a non-negative integer.');
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.csvSha256)) {
    throw new Error('csvSha256 must be a lowercase 64-character SHA-256 hash.');
  }
  if (!Number.isFinite(Date.parse(manifest.generatedAt))) {
    throw new Error('generatedAt must be a valid timestamp.');
  }
}

export function parseExecutionAuditEvidenceManifest(content: string): ExecutionAuditEvidenceManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Execution audit evidence manifest must contain valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Execution audit evidence manifest must be a JSON object.');
  }

  const manifest = parsed as ExecutionAuditEvidenceManifest;
  assertEvidenceManifest(manifest);
  return manifest;
}

export async function sha256Hex(content: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return bytesToHex(new Uint8Array(digest));
}

export async function buildExecutionAuditEvidenceManifest(
  csv: string,
  recordCount: number,
  generatedAt = new Date().toISOString()
): Promise<ExecutionAuditEvidenceManifest> {
  if (!Number.isInteger(recordCount) || recordCount < 0) {
    throw new Error('recordCount must be a non-negative integer.');
  }

  const generatedTimestamp = Date.parse(generatedAt);
  if (!Number.isFinite(generatedTimestamp)) {
    throw new Error('generatedAt must be a valid timestamp.');
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date(generatedTimestamp).toISOString(),
    recordCount,
    csvByteLength: new TextEncoder().encode(csv).byteLength,
    csvSha256: await sha256Hex(csv)
  };
}

export async function verifyExecutionAuditEvidence(
  csv: string,
  manifest: ExecutionAuditEvidenceManifest
): Promise<ExecutionAuditEvidenceVerification> {
  assertEvidenceManifest(manifest);

  const actualSha256 = await sha256Hex(csv);
  const actualByteLength = new TextEncoder().encode(csv).byteLength;
  const hashMatches = actualSha256 === manifest.csvSha256;
  const byteLengthMatches = actualByteLength === manifest.csvByteLength;

  return {
    valid: hashMatches && byteLengthMatches,
    hashMatches,
    byteLengthMatches,
    expectedSha256: manifest.csvSha256,
    actualSha256,
    expectedByteLength: manifest.csvByteLength,
    actualByteLength
  };
}

export function serializeExecutionAuditEvidenceManifest(manifest: ExecutionAuditEvidenceManifest) {
  assertEvidenceManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
