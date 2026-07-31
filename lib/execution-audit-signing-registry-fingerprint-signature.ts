import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export type ExecutionAuditSigningRegistryFingerprintSignature = {
  schemaVersion: '1.0';
  algorithm: 'Ed25519';
  keyId: string;
  signedAt: string;
  signatureBase64: string;
};

function assertSignature(signature: ExecutionAuditSigningRegistryFingerprintSignature) {
  if (signature.schemaVersion !== '1.0') throw new Error('Unsupported registry fingerprint signature schemaVersion.');
  if (signature.algorithm !== 'Ed25519') throw new Error('Unsupported registry fingerprint signature algorithm.');
  if (!signature.keyId.trim()) throw new Error('keyId must not be empty.');
  if (!Number.isFinite(Date.parse(signature.signedAt))) throw new Error('signedAt must be a valid timestamp.');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature.signatureBase64)) {
    throw new Error('signatureBase64 must be valid base64.');
  }
}

export function parseExecutionAuditSigningRegistryFingerprintSignature(
  content: string
): ExecutionAuditSigningRegistryFingerprintSignature {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Registry fingerprint signature must contain valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Registry fingerprint signature must be a JSON object.');
  }
  const signature = parsed as ExecutionAuditSigningRegistryFingerprintSignature;
  assertSignature(signature);
  return signature;
}

export function signExecutionAuditSigningRegistryFingerprint(
  fingerprintContent: string,
  privateKeyPem: string,
  keyId: string,
  signedAt = new Date().toISOString()
): ExecutionAuditSigningRegistryFingerprintSignature {
  if (!keyId.trim()) throw new Error('keyId must not be empty.');
  const timestamp = Date.parse(signedAt);
  if (!Number.isFinite(timestamp)) throw new Error('signedAt must be a valid timestamp.');
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Private key must be Ed25519.');

  return {
    schemaVersion: '1.0',
    algorithm: 'Ed25519',
    keyId: keyId.trim(),
    signedAt: new Date(timestamp).toISOString(),
    signatureBase64: sign(null, Buffer.from(fingerprintContent, 'utf8'), privateKey).toString('base64')
  };
}

export function verifyExecutionAuditSigningRegistryFingerprintSignature(
  fingerprintContent: string,
  signature: ExecutionAuditSigningRegistryFingerprintSignature,
  publicKeyPem: string
) {
  assertSignature(signature);
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('Public key must be Ed25519.');
  return verify(
    null,
    Buffer.from(fingerprintContent, 'utf8'),
    publicKey,
    Buffer.from(signature.signatureBase64, 'base64')
  );
}

export function serializeExecutionAuditSigningRegistryFingerprintSignature(
  signature: ExecutionAuditSigningRegistryFingerprintSignature
) {
  assertSignature(signature);
  return `${JSON.stringify(signature, null, 2)}\n`;
}
