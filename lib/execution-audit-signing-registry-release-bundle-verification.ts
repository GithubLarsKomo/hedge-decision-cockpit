import { parseTrustedExecutionAuditSigningKeyRegistry } from './execution-audit-evidence-trusted-keys';
import { parseExecutionAuditSigningRegistryReleaseManifestSignature } from './execution-audit-signing-registry-release-manifest-signature';
import { verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry } from './execution-audit-signing-registry-release-manifest-signature-registry';
import { verifyExecutionAuditSigningRegistryReleaseManifest } from './execution-audit-signing-registry-release-manifest-verification';

export function verifyExecutionAuditSigningRegistryReleaseBundle(input: {
  manifestContent: string;
  manifestSignatureContent: string;
  trustedKeysContent: string;
  registryContent: string;
  fingerprintContent: string;
  signatureContent: string;
  trustRegistryContent: string;
}) {
  const manifest = verifyExecutionAuditSigningRegistryReleaseManifest(input);
  const manifestSignature = verifyExecutionAuditSigningRegistryReleaseManifestSignatureWithRegistry(
    input.manifestContent,
    parseExecutionAuditSigningRegistryReleaseManifestSignature(input.manifestSignatureContent),
    parseTrustedExecutionAuditSigningKeyRegistry(input.trustedKeysContent)
  );

  return {
    valid: manifest.valid && manifestSignature.valid,
    manifest,
    manifestSignature
  };
}
