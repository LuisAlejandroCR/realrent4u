// Shell.tsx: header (house mark, nav, EN/ES toggle, fixture badge, disclaimer + as-of line) and footer.
// The "not legal advice" notice and the as-of date stay visible on every screen (AGENTS.md A13).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./Providers";
import { formatDate } from "@/lib/i18n";

export function HouseMark({ className = "house-mark" }: { className?: string }) {
  // A stroke house whose door is a citation bracket [ ].
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 11 12 3.5 21 11" />
      <path d="M5.5 9.2V20.5h13V9.2" />
      <path d="M10 13.5H9v7M14 13.5h1v7" />
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { lang, setLang, asOf, t, data, error, linkTo } = useApp();
  const pathname = usePathname() || "/";
  const nav = [
    { href: "/", label: t("navLookup") },
    { href: "/changes/", label: t("navChanges") },
    { href: "/method/", label: t("navMethod") },
    { href: "/about/", label: t("navAbout") },
  ];
  // The lookup tab stays active on an address page (/a/<id>/).
  const active = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/a/") : pathname.startsWith(href.replace(/\/$/, ""));

  return (
    <>
      <header className="header">
        <div className="wrap header-row">
          <Link href={linkTo("/")} className="brand">
            <HouseMark />
            <span>{t("appName")}</span>
          </Link>
          <div className="header-tools">
            {data?.manifest.uses_fixtures && (
              <Link href={linkTo("/about/")} className="fixture-badge" title={t("fixtureHint")} data-testid="fixture-badge">
                {t("fixtureBadge")}
              </Link>
            )}
            <div className="seg" role="group" aria-label={t("language")}>
              {(["en", "es"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="wrap header-row header-row-2">
          <nav className="nav" aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={linkTo(n.href)}
                className={active(n.href) ? "pill on" : "pill"}
                aria-current={active(n.href) ? "page" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <p className="disclaimer-line" role="note" data-testid="legal-banner">
            <strong>{t("notLegalAdvice")}</strong>{" "}
            <span>
              {t("asOf")}: <strong data-testid="as-of">{formatDate(asOf, lang)}</strong>
            </span>
          </p>
        </div>
      </header>
      <main className="wrap main view-fade">
        {error ? <p className="notice notice-warn">{t("loadError")} {error}</p> : !data ? <p className="muted">{t("loading")}</p> : children}
      </main>
      <footer className="footer">
        <div className="wrap">
          <p>
            <strong>{t("notLegalAdviceLong")}</strong>
          </p>
          <p className="muted">
            {t("asOf")}: {asOf} · {t("credit")}
          </p>
        </div>
      </footer>
    </>
  );
}
