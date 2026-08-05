import Link from 'next/link';
import StrategyColorLegend from '@/components/StrategyColorLegend';
import {
  STRATEGY_TONE_STYLES,
  VIX_EXPENSIVE_OVERLAY,
  type StrategyTone
} from '@/components/strategy-presentation';
import { DEFAULT_STRATEGY_CONFIG as config } from '@/lib/strategy-config';

function pct(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

export default function StrategyGuidePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zurück zum Cockpit</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Strategie verstehen</p>
        <h1 className="text-3xl font-semibold text-slate-950">NASDAQ-Hedge-Strategie für Einsteiger</h1>
        <p className="max-w-4xl text-slate-600">
          Die Strategie versucht nicht, den nächsten Crash vorherzusagen. Sie folgt vorher festgelegten Regeln: Absicherung eher dann aufbauen, wenn der Markt hoch und Volatilität relativ günstig ist, die Absicherung in einer Korrektur wirken lassen und Hedge-Gewinne in größeren Rückgängen schrittweise freisetzen.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">1. Was ist überhaupt ein Hedge?</h2>
        <div className="mt-3 space-y-3 text-slate-700">
          <p>Ein Hedge ist eine Absicherung gegen starke Kursverluste. In diesem Cockpit wird dazu mit Put-Optionen gearbeitet. Vereinfacht gesagt gewinnen Puts typischerweise an Wert, wenn der zugrunde liegende Markt stark fällt.</p>
          <p>Diese Absicherung ist nicht kostenlos: Für Puts wird eine Optionsprämie bezahlt und eine Option kann wertlos verfallen. Deshalb versucht die Strategie, neue Absicherung nicht in jeder Marktphase zu kaufen, sondern bevorzugt dann, wenn Volatilität relativ günstig ist.</p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <Concept title="NDX / NASDAQ-100" text="Der NDX ist hier der Marktindikator. Entscheidend ist nicht nur sein aktueller Stand, sondern wie weit er unter seinem höchsten Schlussstand der letzten zwei Jahre liegt." />
        <Concept title="Drawdown" text="Der Drawdown misst den Rückgang vom 2-Jahres-Hoch. Beispiel: -6 % bedeutet, dass der Index rund 6 % unter seinem Referenzhoch liegt. Je negativer der Wert, desto stärker der Rückgang." />
        <Concept title="VIX-Perzentil" text={`Der VIX steht vereinfacht für die am Optionsmarkt eingepreiste Schwankung. Ein Perzentil unter ${pct(config.cheapVolatilityPercentile)} % gilt in dieser Strategie als relativ günstig; über ${pct(config.expensiveVolatilityPercentile)} % als teuer.`} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">2. Was bedeutet „Hedge-Abdeckung“?</h2>
        <div className="mt-3 space-y-3 text-slate-700">
          <p>Die Hedge-Abdeckung sagt dem Regelwerk, wie weit der konfigurierte Ziel-Hedge bereits erreicht ist. <strong>100 %</strong> bedeutet hier: das in der Strategie definierte Ziel ist erreicht. <strong>0 %</strong> bedeutet: keine Zielabdeckung ist gemeldet.</p>
          <p>Wichtig: 100 % Hedge-Abdeckung bedeutet nicht automatisch, dass jeder Verlust des gesamten Portfolios wirtschaftlich vollständig versichert ist. Es ist ein relativer Steuerwert gegenüber dem im Cockpit definierten Hedge-Ziel.</p>
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">Wenn die Hedge-Abdeckung unbekannt ist, kann die aktuelle Regelversion {config.version} trotzdem ein BUY_OR_ROLL_PUTS-Signal erzeugen. Das ist dann zunächst ein Markt-Setup, keine positionsbezogen bestätigte Kaufnotwendigkeit.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">3. Der Ablauf der Strategie</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Die Hauptfarben zeigen jetzt nur noch die primäre Strategie- und Drawdown-Stufe. Dadurch steigt die Eskalation eindeutig von Gelb über Amber und Orange bis Rot. Die Bewertung „VIX teuer“ läuft unabhängig davon als separates Overlay.
        </p>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <StrategyColorLegend />
        </div>
        <div className="mt-5 space-y-4">
          <Step tone="blue" title="Absicherung aufbauen oder rollen" text={`Wenn der NDX weniger als ${pct(Math.abs(config.nearHighPercent))} % unter seinem 2-Jahres-Hoch liegt, der VIX unter dem ${pct(config.cheapVolatilityPercentile)}. Perzentil liegt und die gemeldete Hedge-Abdeckung unter ${pct(config.targetHedgeCoveragePercent)} % liegt, ist das typische Aufbau-Setup erreicht.`} />
          <Step tone="green" title="Nichts ändern" text="Wenn keine Aktionsregel greift, bleibt die vorhandene Struktur unverändert. Grün bedeutet also nicht „Markt sicher“, sondern lediglich „laut Regelwerk aktuell keine Änderung nötig“." />
          <Step tone="yellow" title="Hedge in der Korrektur arbeiten lassen" text={`Ab ${pct(Math.abs(config.drawdownHoldPercent))} % Drawdown soll der bestehende Hedge gehalten werden. Ein teurer VIX verändert diese primäre Stufe nicht mehr, sondern wird zusätzlich als Volatilitäts-Overlay angezeigt.`} />
          <Step tone="amber" title="Erste Hedge-Gewinne realisieren" text={`Ab ${pct(Math.abs(config.drawdownRealizeFirstPercent))} % Drawdown sieht die Strategie vor, 25 % der Hedge-Gewinne zu realisieren.`} />
          <Step tone="orange" title="Weitere Gewinne freisetzen" text={`Ab ${pct(Math.abs(config.drawdownRealizeSecondPercent))} % Drawdown werden laut Regelwerk weitere 35 % realisiert.`} />
          <Step tone="red" title="Im extremen Drawdown Großteil monetarisieren" text={`Ab ${pct(Math.abs(config.drawdownCloseMostPercent))} % Drawdown soll der Großteil des Hedges geschlossen und die freigesetzte Liquidität nach dem Reinvestitionsplan für Aktienkäufe eingesetzt werden.`} />
        </div>

        <div className={`mt-5 rounded-xl border p-4 ${VIX_EXPENSIVE_OVERLAY.cardClass}`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${VIX_EXPENSIVE_OVERLAY.badgeClass}`}>
              {VIX_EXPENSIVE_OVERLAY.label}
            </span>
            <h3 className="font-semibold">Keine teuren neuen Puts kaufen</h3>
          </div>
          <p className="mt-2 text-sm leading-6">
            Liegt das VIX-Perzentil über {pct(config.expensiveVolatilityPercentile)} %, gelten neue Puts als historisch teuer. Außer bei den vorrangigen Crash-Regeln wird dann kein neuer Hedge aufgebaut. Dieses Signal ist bewusst kein Teil der Gelb→Amber→Orange→Rot-Eskalation.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold text-slate-950">4. Warum diese Reihenfolge wichtig ist</h2>
        <div className="mt-3 space-y-3 text-slate-700">
          <p>Die Regelengine prüft die starken Drawdowns zuerst. In einem echten Crash hat deshalb die Monetarisierung eines bereits vorhandenen Hedges Vorrang vor der Frage, ob der VIX gerade teuer ist.</p>
          <p>Die Darstellung trennt diese beiden Achsen jetzt sichtbar: <strong>Blau/Grün/Gelb/Amber/Orange/Rot</strong> beschreibt die primäre Strategiestufe; <strong>VIX teuer</strong> ist ein zusätzliches Kosten-Overlay, das den Neukauf von Puts begrenzt.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">5. Ein einfaches Beispiel</h2>
        <div className="mt-3 space-y-3 text-slate-700">
          <p>Angenommen, der NASDAQ-100 liegt 6 % unter seinem 2-Jahres-Hoch, der VIX liegt im 22. Perzentil und es ist noch kein Hedge gemeldet.</p>
          <p>Dann ist der Markt nach dieser Definition noch „nahe am Hoch“, Volatilität ist relativ günstig und die Hedge-Abdeckung liegt unter Ziel. Das Cockpit zeigt deshalb <strong>Blau: Puts aufbauen oder rollen</strong>.</p>
          <p>Wird für dieselben Marktdaten dagegen eine Hedge-Abdeckung von 100 % gemeldet, besteht keine gemeldete Hedge-Lücke. Das Ergebnis fällt dann auf <strong>Grün: Halten / nichts ändern</strong>.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-950">6. Was das Cockpit nicht macht</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
          <li>Es sagt keinen Crash voraus.</li>
          <li>Es garantiert nicht, dass ein Hedge Gewinne erzielt oder Verluste vollständig ausgleicht.</li>
          <li>Es entscheidet nicht automatisch über konkrete Optionskontrakte, Laufzeiten oder Positionsgrößen.</li>
          <li>Es führt keine Orders aus. Die Entscheidung und Ausführung bleiben getrennte Schritte.</li>
          <li>Die Schwellen sind eine versionierte Strategieentscheidung und keine allgemeingültigen Marktgesetze.</li>
        </ul>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-600">Aktuelle Regelversion: <strong>{config.version}</strong>. Die Schwellen auf dieser Seite werden direkt aus derselben Konfiguration gelesen wie die Decision Engine.</p>
        <Link href="/" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Zurück zum Cockpit</Link>
      </footer>
    </main>
  );
}

function Concept({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function Step({ tone, title, text }: { tone: StrategyTone; title: string; text: string }) {
  const style = STRATEGY_TONE_STYLES[tone];
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm ${style.badgeClass}`}>
          {style.label}
        </span>
        <h3 className="font-semibold text-slate-950">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{text}</p>
    </article>
  );
}
