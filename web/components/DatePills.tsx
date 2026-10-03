// DatePills.tsx: the as-of date picker, one pill per demo date (realrent/paths.py), shared by the landing and address pages.
// A date without a lookup file still shows, marked "no data", so the visitor sees why nothing is evaluated.
"use client";

import { useApp } from "./Providers";
import { formatDate } from "@/lib/i18n";

const FALLBACK_DATES = ["2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02"];

export function DatePills() {
  const { t, data, asOf, setAsOf, lang } = useApp();
  if (!data) return null;
  const dates = data.manifest.demo_dates?.length ? data.manifest.demo_dates : FALLBACK_DATES;
  return (
    <div className="date-pills" role="group" aria-label={t("asOfDate")}>
      <span className="eyebrow">{t("asOfDate")}</span>
      {dates.map((d) => {
        const hasData = data.manifest.lookup_dates.includes(d);
        return (
          <button
            key={d}
            type="button"
            className={d === asOf ? "pill on" : "pill"}
            aria-pressed={d === asOf}
            onClick={() => setAsOf(d)}
            data-testid="date-pill"
            title={hasData ? undefined : t("noDataShort")}
          >
            {formatDate(d, lang)}
            {!hasData && <span className="pill-note"> · {t("noDataShort")}</span>}
          </button>
        );
      })}
    </div>
  );
}
