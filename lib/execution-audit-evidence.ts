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
  recordCountMatches: boolean;
  expectedSha256: string;
  actualSha256: string;
  expectedByteLength: number;
  actualByteLength: number;
  expectedRecordCount: number;
  actualRecordCount: number;
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

export function countExecutionAuditCsvRecords(csv: string) {
  const content = csv.startsWith('\ufeff') ? csv.slice(1) : csv;
  if (content.length === 0) {
    return 0;
  }

  let inQuotes = false;
  let rowCount = 1;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === '\n') {
      rowCount += 1;
    }
  }

  if (inQuotes) {
    throw new Error('Execution audit CSV contains an unterminated quoted field.');
  }

  if (content.endsWith('\n')) {
    rowCount -= 1;
  }

  return Math.max(0, rowCount - 1);
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
  const actualRecordCount = countExecutionAuditCsvRecords(csv);
  const hashMatches = actualSha256 === manifest.csvSha256;
  const byteLengthMatches = actualByteLength === manifest.csvByteLength;
  const recordCountMatches = actualRecordCount === manifest.recordCount;

  return {
    valid: hashMatches && byteLengthMatches && recordCountMatches,
    hashMatches,
    byteLengthMatches,
    recordCountMatches,
    expectedSha256: manifest.csvSha256,
    actualSha256,
    expectedByteLength: manifest.csvByteLength,
    actualByteLength,
    expectedRecordCount: manifest.recordCount,
    actualRecordCount
  };
}

export function serializeExecutionAuditEvidenceManifest(manifest: ExecutionAuditEvidenceManifest) {
  assertEvidenceManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
