// AddressPlate.tsx: the selected address as a building number plate, the legal-city pill beside it,
// and the building facts strip (year built · units · use) that explains every "unknown".
"use client";

import { useApp } from "./Providers";
import type { Address, Jurisdiction } from "@/lib/types";

export function AddressPlate({ address, juris }: { address: Address; juris?: Jurisdiction }) {
  const { t } = useApp();
  const legalCity = juris?.place ?? juris?.jurisdiction?.split(",")[0] ?? null;
  const differs = !!legalCity && legalCity.toLowerCase() !== address.postal_city.toLowerCase();
  const match = juris?.match === "exact" ? t("matchExact") : juris?.match === "fallback" ? t("matchFallback") : t("matchNone");

  const fact = (label: string, value: string) => (
    <div className="fact">
      <span className="fact-label">{label}</span>
      {value ? <span className="fact-value">{value}</span> : <span className="fact-value missing">{t("notInRecord")}</span>}
    </div>
  );

  return (
    <section className="plate-row" aria-label={t("addressId")}>
      <div className="plate">
        <span className="plate-id">{address.address_id}</span>
        <span className="plate-street">{address.street_address}</span>
        <span className="plate-postal">
          {address.postal_city}, {address.state} {address.zip}
        </span>
      </div>
      <div className="plate-side">
        {juris ? (
          <span className="juris-pill" data-testid="jurisdiction">
            {t("legalCity")}: <strong>{juris.jurisdiction ?? juris.state}</strong>
          </span>
        ) : (
          <span className="juris-pill juris-pill-none" data-testid="jurisdiction">
            {t("notResolved")} · {address.state}
          </span>
        )}
        <p className="small muted plate-notes">
          {juris && !juris.jurisdiction && <>{t("outsideScope")} · </>}
          {differs && (
            <>
              {t("postalCityDiffers")} ({t("postalCity")}: {address.postal_city}) ·{" "}
            </>
          )}
          {juris?.county && <>{juris.county} · </>}
          {juris && (
            <>
              {match}
              {juris.source === "fixture" && <span className="fixture-badge inline">{t("fixtureBadge")}</span>}
            </>
          )}
        </p>
      </div>
      <div className="facts-strip">
        {fact(t("yearBuilt"), address.year_built)}
        {fact(t("units"), address.units)}
        {fact(t("use"), address.use_description || address.use_code)}
      </div>
      <p className="small muted record-src">
        {address.source_dataset} · {t("retrieved")} {address.retrieved_at.slice(0, 10)}
      </p>
    </section>
  );
}
