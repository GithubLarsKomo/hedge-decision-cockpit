export type ExecutionAuditEvidenceManifest = {
  schemaVersion: '1.0';
  generatedAt: string;
  recordCount: number;
  csvByteLength: number;
  csvSha256: string;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
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

export function serializeExecutionAuditEvidenceManifest(manifest: ExecutionAuditEvidenceManifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
