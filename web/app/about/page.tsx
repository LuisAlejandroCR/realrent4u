// page.tsx (about): reasoning boundary, result legend and the audit of which data files this build used
// (pipeline output vs test fixtures), read from public/data/manifest.json.
"use client";

import { useApp } from "@/components/Providers";
import { StatusPill } from "@/components/Result";
import { dictionaries, resultDescriptions } from "@/lib/i18n";

export default function AboutPage() {
  const { t, data, lang } = useApp();
  if (!data) return null;
  const m = data.manifest;

  return (
    <div className="column">
      <p className="eyebrow">{t("appName")}</p>
      <h1>
        {t("aboutTitleBefore")}
        <em className="accent">{t("aboutTitleAccent")}</em>
      </h1>
      <p className="notice notice-warn">
        <strong>{t("notLegalAdviceLong")}</strong>
      </p>

      <section className="card">
        <h2>{t("reasoningBoundary")}</h2>
        <ul className="boundary">
          {dictionaries[lang].reasoningBoundaryText.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{t("resultLegend")}</h2>
        <ul className="legend-list">
          {Object.keys(resultDescriptions[lang]).map((r) => (
            <li key={r}>
              <StatusPill result={r} /> <span className="small">{resultDescriptions[lang][r]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" data-testid="audit">
        <h2>
          {t("dataSources")} {m.uses_fixtures && <span className="fixture-badge inline">{t("fixtureBadge")}</span>}
        </h2>
        <p className="muted small">{t("noServer")}</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("file")}</th>
                <th>{t("kind")}</th>
                <th>{t("path")}</th>
                <th>{t("count")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(m.sources).map(([name, s]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <span className={`kind kind-${s.kind}`}>
                      <span className="dot" aria-hidden="true" />
                      {s.kind}
                    </span>
                  </td>
                  <td>
                    <code>{s.files ? s.files.map((f) => f.path).join(", ") || "—" : s.path ?? "—"}</code>
                  </td>
                  <td>{s.files ? s.files.reduce((n, f) => n + f.items, 0) : s.count ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="kv">
          <dt>{t("lookupDates")}</dt>
          <dd>{m.lookup_dates.length ? m.lookup_dates.join(", ") : t("none")}</dd>
          <dt>{t("builtAt")}</dt>
          <dd>{m.generated_at}</dd>
        </dl>
        {m.warnings.length > 0 && (
          <>
            <h3>{t("warnings")}</h3>
            <ul className="small">
              {m.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
