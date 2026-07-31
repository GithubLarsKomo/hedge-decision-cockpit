'use client';

import { FormEvent, useState } from 'react';
import { buildExecutionAuditRequest, type ExecutionAuditFormValues } from '@/lib/execution-audit-form';

function nowLocal() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export default function ExecutionAuditForm({ defaultDecisionId }: { defaultDecisionId?: number }) {
  const [executionStatus, setExecutionStatus] = useState<ExecutionAuditFormValues['executionStatus']>('NOT_EXECUTED');
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(undefined);

    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '');

    try {
      const decisionId = Number(value('decisionId'));
      if (!Number.isInteger(decisionId) || decisionId <= 0) throw new Error('Decision ID must be a positive integer.');

      const payload = buildExecutionAuditRequest({
        recommendationId: value('recommendationId'),
        recommendedStrategy: value('recommendedStrategy'),
        recommendedContracts: value('recommendedContracts'),
        decidedAt: value('decidedAt'),
        approvalDecision: value('approvalDecision') as ExecutionAuditFormValues['approvalDecision'],
        approvalActorId: value('approvalActorId'),
        approvalRecordedAt: value('approvalRecordedAt'),
        approvalReason: value('approvalReason'),
        executionStatus,
        executionActorId: value('executionActorId'),
        executionRecordedAt: value('executionRecordedAt'),
        executedStrategy: value('executedStrategy'),
        executedContracts: value('executedContracts'),
        averagePrice: value('averagePrice'),
        deviationReason: value('deviationReason')
      });

      const response = await fetch(`/api/decisions/${decisionId}/execution-audit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${value('token')}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? `Request failed with status ${response.status}.`);
      setMessage('Audit record saved.');
      event.currentTarget.reset();
      setExecutionStatus('NOT_EXECUTED');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Audit record could not be saved.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const labelClass = 'text-sm font-medium text-slate-700';

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Freigabe und Ausführung dokumentieren</h2>
      <p className="mt-2 text-sm text-slate-600">Der Bearer-Token wird nur für diese Anfrage verwendet und nicht gespeichert.</p>
      <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <label className={labelClass}>Decision ID<input className={inputClass} name="decisionId" type="number" min="1" defaultValue={defaultDecisionId} required /></label>
        <label className={labelClass}>Bearer-Token<input className={inputClass} name="token" type="password" autoComplete="off" required /></label>
        <label className={labelClass}>Recommendation ID<input className={inputClass} name="recommendationId" required /></label>
        <label className={labelClass}>Empfohlene Strategie<input className={inputClass} name="recommendedStrategy" defaultValue="LONG_PUT" required /></label>
        <label className={labelClass}>Empfohlene Kontrakte<input className={inputClass} name="recommendedContracts" type="number" min="0" step="1" required /></label>
        <label className={labelClass}>Entscheidungszeitpunkt<input className={inputClass} name="decidedAt" type="datetime-local" defaultValue={nowLocal()} required /></label>
        <label className={labelClass}>Freigabe<select className={inputClass} name="approvalDecision"><option value="APPROVED">Freigegeben</option><option value="REJECTED">Abgelehnt</option></select></label>
        <label className={labelClass}>Freigebende Person/ID<input className={inputClass} name="approvalActorId" required /></label>
        <label className={labelClass}>Freigabezeitpunkt<input className={inputClass} name="approvalRecordedAt" type="datetime-local" defaultValue={nowLocal()} required /></label>
        <label className={labelClass}>Freigabegrund<input className={inputClass} name="approvalReason" /></label>
        <label className={labelClass}>Ausführungsstatus<select className={inputClass} name="executionStatus" value={executionStatus} onChange={event => setExecutionStatus(event.target.value as ExecutionAuditFormValues['executionStatus'])}><option value="NOT_EXECUTED">Nicht ausgeführt</option><option value="PARTIALLY_EXECUTED">Teilweise ausgeführt</option><option value="EXECUTED">Ausgeführt</option></select></label>
        <label className={labelClass}>Abweichungsgrund<input className={inputClass} name="deviationReason" /></label>
        {executionStatus !== 'NOT_EXECUTED' && <>
          <label className={labelClass}>Ausführende Person/ID<input className={inputClass} name="executionActorId" required /></label>
          <label className={labelClass}>Ausführungszeitpunkt<input className={inputClass} name="executionRecordedAt" type="datetime-local" defaultValue={nowLocal()} required /></label>
          <label className={labelClass}>Ausgeführte Strategie<input className={inputClass} name="executedStrategy" required /></label>
          <label className={labelClass}>Ausgeführte Kontrakte<input className={inputClass} name="executedContracts" type="number" min="1" step="1" required /></label>
          <label className={labelClass}>Durchschnittspreis<input className={inputClass} name="averagePrice" type="number" min="0" step="0.0001" required /></label>
        </>}
        <div className="md:col-span-2 flex items-center gap-4">
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={submitting}>{submitting ? 'Speichert…' : 'Audit speichern'}</button>
          {message && <p className="text-sm text-slate-700" role="status">{message}</p>}
        </div>
      </form>
    </section>
  );
}
