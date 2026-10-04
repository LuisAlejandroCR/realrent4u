// AddressSummary.tsx: address header as a short story: the postal city struck through, the legal jurisdiction
// stamped (with the state → county → city stack), then the building facts as chips, gaps shown explicitly.
import type { Address, Jurisdiction } from "../types";
import type { Dict } from "../i18n";
import { blank } from "../data";

export interface AddressSummaryProps {
  address: Address;
  jurisdiction?: Jurisdiction | undefined;
  asOf: string;
  tr: Dict;
}

/** Address header told as a story: what the mail says, what the law says, then the building facts as chips. */
export function AddressSummary({ address: a, jurisdiction: j, asOf, tr }: AddressSummaryProps) {
  const resolved = !!j?.jurisdiction;
  const differs = resolved && j!.place && j!.place.toLowerCase() !== a.postal_city.toLowerCase();
  const facts: [string, string | null | undefined][] = [
    [tr.yearBuilt, a.year_built],
    [tr.units, a.units],
    [tr.use, a.use_description],
  ];
  return (
    <section className="rr-summary rr-story" aria-labelledby="rr-addr-h" data-as-of={asOf}>
      <p className="rr-id">{tr.addressId} · {a.address_id}</p>
      <h1 id="rr-addr-h" className="rr-h1">{a.street_address}</h1>
      <p className="rr-story-line">
        <span className="rr-story-k">{tr.postalCity}</span>
        {differs ? <s>{a.postal_city}</s> : <span>{a.postal_city}</span>}, {a.state} {a.zip}
        <span className="rr-story-arrow" aria-hidden>→</span>
        <span className="rr-story-k">{tr.legalJurisdiction}</span>
        {resolved ? <strong className="rr-story-legal">{j!.jurisdiction}</strong> : <span className="rr-missing">{tr.unresolved}</span>}
      </p>
      {differs && <p className="rr-flag rr-story-flag">≠ {tr.differs}</p>}
      {resolved && (
        // Rules stack from the state down to the city; the county is shown when the resolver recorded one.
        <ol className="rr-stack" aria-label={tr.stack}>
          {[j!.state, j!.county, j!.jurisdiction].filter((x): x is string => !!x).map((x) => <li key={x}>{x}</li>)}
        </ol>
      )}
      <ul className="rr-factchips">
        {facts.map(([k, v]) => (
          <li key={k} className={blank(v) ? "is-missing" : ""}>
            <span>{k}</span> {blank(v) ? <em>{tr.notInRecord}</em> : <strong>{v}</strong>}
          </li>
        ))}
      </ul>
      <p className="rr-meta">
        {resolved && j!.source === "census" && <>{tr.viaCensus(j!.match ?? "")} · </>}
        {j?.match === "fallback" && <>{tr.fallback} · </>}
        {a.retrieved_at && <>{a.source_dataset} · {tr.retrieved} {a.retrieved_at}</>}
      </p>
    </section>
  );
}
