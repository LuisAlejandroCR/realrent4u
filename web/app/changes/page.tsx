// page.tsx (changes): the five organizer change tests T1–T5 with our affected and conflict-flagged
// addresses and notes from submission/changes.json. Expected behaviour is the organizer's text.
"use client";

import Link from "next/link";
import { useApp } from "@/components/Providers";
import type { Address } from "@/lib/types";

const MAX_CHIPS = 60;

function AddressChips({ ids, byId }: { ids: string[]; byId: Record<string, Address> }) {
  const { t } = useApp();
  if (!ids.length) return <span className="muted">{t("none")}</span>;
  return (
    <div className="chips">
      {ids.slice(0, MAX_CHIPS).map((id) => {
        const a = byId[id];
        return (
          <Link key={id} href={`/#${id}`} className="chip" title={a ? `${a.street_address}, ${a.postal_city}, ${a.state}` : id}>
            {id}
            {a ? <span className="chip-city"> · {a.postal_city}</span> : null}
          </Link>
        );
      })}
      {ids.length > MAX_CHIPS && <span className="muted small">+{ids.length - MAX_CHIPS}</span>}
    </div>
  );
}

export default function ChangesPage() {
  const { t, data } = useApp();
  if (!data) return null;
  const byId = Object.fromEntries(data.addresses.map((a) => [a.address_id, a]));
  const hasResults = Object.keys(data.changes).length > 0;

  return (
    <div>
      <h1>{t("changesTitle")}</h1>
      <p className="muted">{t("changesIntro")}</p>
      {!hasResults && (
        <p className="callout callout-warn" data-testid="no-changes">
          {t("noChangesYet")}
        </p>
      )}
      {data.changeTests.map((ct) => {
        const res = data.changes[ct.test_id];
        const affected = res?.affected_address_ids ?? [];
        const flagged = res?.conflict_flag_address_ids ?? [];
        return (
          <article key={ct.test_id} className="card change" data-testid="change-card">
            <div className="rule-head">
              <h2>
                <span className="test-id">{ct.test_id}</span> {ct.title}
              </h2>
              <span className="badge">{ct.type}</span>
            </div>
            <dl className="facts">
              <dt>{t("dates")}</dt>
              <dd>
                {ct.as_of_before ? `${ct.as_of_before} (${t("before")}) → ${ct.as_of_after} (${t("after")})` : ct.as_of ?? "—"}
              </dd>
              <dt>{t("ruleIds")}</dt>
              <dd>
                {ct.rule_ids.map((r) => (
                  <code key={r} className="tag">
                    {r}
                  </code>
                ))}
                {ct.conflict_with?.length ? <span className="muted small"> ⚑ {ct.conflict_with.join(", ")}</span> : null}
              </dd>
              <dt>{t("expected")}</dt>
              <dd lang="en">{ct.expected_behavior}</dd>
            </dl>
            {res && (
              <div className="change-results">
                <h3>
                  {t("affected")} <span className="count">{affected.length}</span>
                  {affected.length === 0 && <span className="badge">{t("emptySetOk")}</span>}
                </h3>
                <AddressChips ids={affected} byId={byId} />
                <h3>
                  {t("conflictFlagged")} <span className="count">{flagged.length}</span>
                </h3>
                <AddressChips ids={flagged} byId={byId} />
                {res.notes && (
                  <p>
                    <span className="label">{t("notes")}:</span> {res.notes}
                  </p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
