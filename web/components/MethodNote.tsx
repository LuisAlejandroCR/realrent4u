// MethodNote.tsx: body of /method — the method note HTML prepared at build time from docs/METHOD.md, or a clear
// "not published yet" state when the file is not in this build. The note itself is English only.
"use client";

import { useApp } from "./Providers";

export function MethodNote({ html }: { html: string | null }) {
  const { t, lang } = useApp();
  return (
    <div className="column">
      <p className="eyebrow">{t("methodEyebrow")}</p>
      {html ? (
        <>
          <p className="small muted">
            {t("methodSource")} {lang === "es" && t("methodEnglishOnly")}
          </p>
          <article className="card prose" lang="en" data-testid="method-note" dangerouslySetInnerHTML={{ __html: html }} />
        </>
      ) : (
        <>
          <h1>
            {t("methodTitleBefore")}
            <em className="accent">{t("methodTitleAccent")}</em>
          </h1>
          <p className="notice notice-warn" data-testid="method-missing">
            <strong>{t("methodMissing")}</strong> {t("methodMissingHint")}
          </p>
        </>
      )}
      <p className="notice">
        <strong>{t("notLegalAdviceLong")}</strong>
      </p>
    </div>
  );
}
