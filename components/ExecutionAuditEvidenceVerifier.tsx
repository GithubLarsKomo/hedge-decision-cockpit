'use client';

import { FormEvent, useState } from 'react';
import {
  parseExecutionAuditEvidenceManifest,
  verifyExecutionAuditEvidence,
  type ExecutionAuditEvidenceVerification
} from '@/lib/execution-audit-evidence';

export default function ExecutionAuditEvidenceVerifier() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExecutionAuditEvidenceVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setError(null);

    if (!csvFile || !manifestFile) {
      setError('Bitte CSV-Datei und JSON-Manifest auswählen.');
      return;
    }

    setChecking(true);

    try {
      const [csv, manifestContent] = await Promise.all([csvFile.text(), manifestFile.text()]);
      const manifest = parseExecutionAuditEvidenceManifest(manifestContent);
      setResult(await verifyExecutionAuditEvidence(csv, manifest));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Der Nachweis konnte nicht geprüft werden.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audit-Nachweis</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">CSV-Integrität prüfen</h2>
        <p className="mt-2 text-sm text-slate-600">
          Die Prüfung erfolgt vollständig im Browser. CSV und Manifest werden nicht hochgeladen oder gespeichert.
        </p>
      </div>

      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Audit-CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={event => setCsvFile(event.target.files?.[0] ?? null)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          JSON-Manifest
          <input
            type="file"
            accept=".json,application/json"
            onChange={event => setManifestFile(event.target.files?.[0] ?? null)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={checking}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? 'Prüfung läuft …' : 'Nachweis prüfen'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {result && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${
            result.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-semibold">{result.valid ? 'Nachweis ist unverändert.' : 'Nachweis stimmt nicht überein.'}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="font-medium">SHA-256</dt>
              <dd>{result.hashMatches ? 'stimmt überein' : 'abweichend'}</dd>
            </div>
            <div>
              <dt className="font-medium">Byte-Länge</dt>
              <dd>
                {result.byteLengthMatches
                  ? `${result.actualByteLength} Byte`
                  : `${result.actualByteLength} statt ${result.expectedByteLength} Byte`}
              </dd>
            </div>
          </dl>
          {!result.hashMatches && (
            <div className="mt-3 break-all font-mono text-xs">
              <p>Erwartet: {result.expectedSha256}</p>
              <p className="mt-1">Tatsächlich: {result.actualSha256}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
