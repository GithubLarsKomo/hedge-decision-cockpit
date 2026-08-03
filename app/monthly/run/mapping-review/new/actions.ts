'use server';

import { redirect } from 'next/navigation';
import { persistEtfMappingArtifact } from '@/lib/etf-mapping-artifact-store';

export async function saveEtfMappingArtifact(formData: FormData) {
  const raw = String(formData.get('mapping_payload') ?? '');
  let persisted;
  try {
    const parsed = JSON.parse(raw);
    persisted = await persistEtfMappingArtifact(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ETF-Mapping konnte nicht gespeichert werden.';
    redirect(`/monthly/run/mapping-review/new?error=${encodeURIComponent(message)}`);
  }

  redirect(`/monthly/run/mapping-review?current=${encodeURIComponent(persisted.entry.mappingFingerprint)}&artifact=${persisted.created ? 'created' : 'replayed'}`);
}
