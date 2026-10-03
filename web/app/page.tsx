// page.tsx: landing — hero with search over the ~500 sample addresses and date pills; a match opens /a/<id>/.
// Old links of the form /#A0016 are redirected client-side to /a/A0016/ (keeping ?lang= and ?date=).
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/Providers";
import { DatePills } from "@/components/DatePills";
import { StatusPill } from "@/components/Result";
import { dictionaries, resultDescriptions } from "@/lib/i18n";

const MAX_RESULTS = 10;

export default function LandingPage() {
  const { t, data, lang, linkTo } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [missingId, setMissingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const addresses = useMemo(() => data?.addresses ?? [], [data]);
  const ids = useMemo(() => new Set(addresses.map((a) => a.address_id)), [addresses]);

  // Legacy hash links (/#A0016) open the address page.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1)).trim().toUpperCase();
      if (!id) return setMissingId(null);
      if (ids.has(id)) router.replace(linkTo(`/a/${id}/`));
      else setMissingId(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [ids, router, linkTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return addresses.filter((a) => {
      const hay = `${a.address_id} ${a.street_address} ${a.postal_city} ${a.state} ${a.zip} ${data?.jurisdictions[a.address_id]?.jurisdiction ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query, addresses, data]);

  if (!data) return null;

  return (
    <section className="hero">
      <div className="hero-main">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>
          {t("heroBefore")}
          <em className="accent">{t("heroAccent")}</em>
          {t("heroAfter")}
        </h1>
        <p className="lead">{t("heroLead")}</p>
        {missingId && (
          <p className="notice notice-warn" data-testid="address-not-found">
            {t("addressNotFound")} <code>{missingId}</code>
          </p>
        )}
        <label htmlFor="q" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="search">
          <input
            id="q"
            ref={searchRef}
            type="search"
            value={query}
            autoComplete="off"
            placeholder={t("searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) router.push(linkTo(`/a/${matches[0].address_id}/`));
            }}
            data-testid="search"
          />
          {query.trim() && (
            <ul className="matches" role="listbox">
              {matches.length === 0 && <li className="muted pad">{t("noMatches")}</li>}
              {matches.slice(0, MAX_RESULTS).map((a) => (
                <li key={a.address_id}>
                  <Link href={linkTo(`/a/${a.address_id}/`)} prefetch={false} data-testid="match">
                    <code>{a.address_id}</code>
                    <span>
                      {a.street_address}, {a.postal_city}, {a.state} {a.zip}
                    </span>
                  </Link>
                </li>
              ))}
              {matches.length > MAX_RESULTS && (
                <li className="muted small pad">
                  +{matches.length - MAX_RESULTS} {t("moreMatches")}
                </li>
              )}
            </ul>
          )}
        </div>
        <p className="small muted">{t("searchKeys")}</p>
        <DatePills />
      </div>
      <aside className="card carries">
        <h2>{t("carriesTitle")}</h2>
        <ul>
          {dictionaries[lang].carries.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="legend">
          {["applies", "unknown", "superseded", "not_yet_effective", "pending"].map((r) => (
            <div key={r} title={resultDescriptions[lang][r]}>
              <StatusPill result={r} />
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
