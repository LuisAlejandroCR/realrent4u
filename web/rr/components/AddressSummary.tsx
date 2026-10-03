// AddressSummary.tsx: address header: postal data vs legal jurisdiction and building facts, gaps shown explicitly.
import type { Address, Jurisdiction } from "../types";
import type { Dict } from "../i18n";
import { blank } from "../data";

export interface AddressSummaryProps {
  address: Address;
  jurisdiction?: Jurisdiction | undefined;
  asOf: string;
  tr: Dict;
}

function Fact({ label, value, tr }: { label: string; value: string | null | undefined; tr: Dict }) {
  return (
    <div className="rr-fact">
      <dt>{label}</dt>
      <dd>{blank(value) ? <span className="rr-missing">{tr.notInRecord}</span> : value}</dd>
    </div>
  );
}

/** Address header: postal data vs legal jurisdiction, building facts with explicit gaps. */
export function AddressSummary({ address: a, jurisdiction: j, asOf, tr }: AddressSummaryProps) {
  const resolved = !!j?.jurisdiction;
  const differs = resolved && j!.place && j!.place.toLowerCase() !== a.postal_city.toLowerCase();
  return (
    <section className="rr-summary" aria-labelledby="rr-addr-h">
      <div className="rr-summary-head">
        <p className="rr-id">{tr.addressId} · {a.address_id}</p>
        <h1 id="rr-addr-h" className="rr-h1">{a.street_address}</h1>
        <p className="rr-muted">{a.postal_city}, {a.state} {a.zip}</p>
      </div>
      <dl className="rr-facts">
        <Fact label={tr.postalCity} value={a.postal_city} tr={tr} />
        <div className="rr-fact rr-fact-wide">
          <dt>{tr.legalJurisdiction}</dt>
          <dd>
            {resolved ? <strong>{j!.jurisdiction}</strong> : <span className="rr-missing">{tr.unresolved}</span>}
            {differs && <span className="rr-flag">≠ {tr.differs}</span>}
            {j?.match === "fallback" && <span className="rr-flag">{tr.fallback}</span>}
          </dd>
        </div>
        <Fact label={tr.yearBuilt} value={a.year_built} tr={tr} />
        <Fact label={tr.units} value={a.units} tr={tr} />
        <Fact label={tr.use} value={a.use_description ? `${a.use_description}${a.use_code ? ` (${a.use_code})` : ""}` : null} tr={tr} />
        <Fact label={tr.asOf} value={asOf} tr={tr} />
      </dl>
      {a.retrieved_at && <p className="rr-muted rr-small">{a.source_dataset} · {tr.retrieved} {a.retrieved_at}</p>}
    </section>
  );
}
