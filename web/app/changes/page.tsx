// page.tsx (changes): the five organizer change tests T1–T5, one section and one address table per test,
// with affected and conflict-flagged addresses (each linking to /a/<id>/) and notes from submission/changes.json.
"use client";

import Link from "next/link";
import { useApp } from "@/components/Providers";
import { ConflictPill } from "@/components/Result";
import type { Address } from "@/lib/types";

const MAX_ROWS = 40;

export default function ChangesPage() {
  const { t, data, linkTo } = useApp();
  if (!data) return null;
  const byId: Record<string, Address> = Object.fromEntries(data.addresses.map((a) => [a.address_id, a]));
  const hasResults = Object.keys(data.changes).length > 0;

  return (
    <div className="dense">
      <p className="eyebrow">T1–T5</p>
      <h1>
        {t("changesTitleBefore")}
        <em className="accent">{t("changesTitleAccent")}</em>
      </h1>
      <p className="lead">{t("changesIntro")}</p>
      {!hasResults && (
        <p className="notice notice-warn" data-testid="no-changes">
          {t("noChangesYet")}
        </p>
      )}
      {data.changeTests.map((ct) => {
        const res = data.changes[ct.test_id];
        const affected = res?.affected_address_ids ?? [];
        const flagged = new Set(res?.conflict_flag_address_ids ?? []);
        const ids = [...new Set([...affected, ...flagged])];
        return (
          <section key={ct.test_id} className="card change" data-testid="change-card">
            <div className="change-head">
              <h2>
                <span className="test-id">{ct.test_id}</span> {ct.title}
              </h2>
              <span className="tag">{ct.type}</span>
            </div>
            <dl className="kv">
              <dt>{t("dates")}</dt>
              <dd>{ct.as_of_before ? `${ct.as_of_before} (${t("before")}) → ${ct.as_of_after} (${t("after")})` : ct.as_of ?? "—"}</dd>
              <dt>{t("ruleIds")}</dt>
              <dd>
                {ct.rule_ids.map((r) => (
                  <code key={r} className="cite">
                    {r}
                  </code>
                ))}
                {ct.conflict_with?.length ? <span className="muted small"> · ⚑ {ct.conflict_with.join(", ")}</span> : null}
              </dd>
              <dt>{t("expected")}</dt>
              <dd lang="en">{ct.expected_behavior}</dd>
            </dl>
            {res && (
              <>
                <p className="counts">
                  <span className="count">{affected.length}</span> {t("affected")} · <span className="count">{flagged.size}</span> {t("conflictFlagged")}
                </p>
                {ids.length === 0 ? (
                  <p className="muted small">{t("emptySetOk")}</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>{t("street")}</th>
                          <th>{t("postalCity")}</th>
                          <th>{t("flag")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ids.slice(0, MAX_ROWS).map((id) => {
                          const a = byId[id];
                          return (
                            <tr key={id}>
                              <td>
                                <Link href={linkTo(`/a/${id}/`)} prefetch={false}>
                                  <code>{id}</code>
                                </Link>
                              </td>
                              <td>{a?.street_address ?? "—"}</td>
                              <td>{a ? `${a.postal_city}, ${a.state}` : "—"}</td>
                              <td>{flagged.has(id) ? <ConflictPill /> : null}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {ids.length > MAX_ROWS && <p className="muted small">+{ids.length - MAX_ROWS}</p>}
                  </div>
                )}
                {res.notes && (
                  <p className="small">
                    <strong>{t("notes")}:</strong> {res.notes}
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
