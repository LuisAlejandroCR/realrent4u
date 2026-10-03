// Shell.tsx: header (legal-advice banner, as-of date picker, EN/ES toggle, nav, fixture badge) and footer.
// Rendered on every page so the "not legal advice" notice and the as-of date are always visible.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { formatDate } from "@/lib/i18n";

const FALLBACK_DATES = ["2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02"];

export function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, asOf, setAsOf, t, data, error } = useApp();
  const pathname = usePathname() || "/";
  const dates = data?.manifest.demo_dates ?? FALLBACK_DATES;
  const nav = [
    { href: "/", label: t("navLookup") },
    { href: "/changes/", label: t("navChanges") },
    { href: "/about/", label: t("navAbout") },
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <>
      <div className="banner" role="note" data-testid="legal-banner">
        <strong>{t("notLegalAdvice")}</strong>
        <span className="banner-sep">·</span>
        <span>
          {t("asOf")}: <strong data-testid="as-of">{formatDate(asOf, lang)}</strong> ({asOf})
        </span>
      </div>
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <Link href="/" className="brand-name">
              {t("appName")}
            </Link>
            <span className="brand-tag">{t("tagline")}</span>
          </div>
          <div className="controls">
            <label className="control">
              <span>{t("asOfDate")}</span>
              <select value={asOf} onChange={(e) => setAsOf(e.target.value)} data-testid="date-select">
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {data && !data.manifest.lookup_dates.includes(d) ? ` (${t("noDataShort")})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="control" role="group" aria-label={t("language")}>
              <span>{t("language")}</span>
              <div className="toggle">
                {(["en", "es"] as const).map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {data?.manifest.uses_fixtures && (
              <Link href="/about/" className="badge badge-fixture" title={t("fixtureHint")} data-testid="fixture-badge">
                {t("fixtureBadge")}
              </Link>
            )}
          </div>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? "active" : ""}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="main">
        {error ? <p className="callout callout-warn">{t("loadError")} {error}</p> : !data ? <p className="muted">{t("loading")}</p> : children}
      </main>
      <footer className="footer">
        <p>
          <strong>{t("notLegalAdviceLong")}</strong>
        </p>
        <p className="muted">
          {t("asOf")}: {asOf} · {t("footer")}
        </p>
      </footer>
    </>
  );
}
