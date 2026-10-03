// StatusBadge.tsx: result/status badge with a text label and a distinct shape, so colour is never the only cue.
import type { Dict } from "../i18n";

export type BadgeKind = "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending" | "failed" | "in_force" | "unevaluated" | "review";

export interface StatusBadgeProps {
  kind: BadgeKind;
  tr: Dict;
}

/** Text label + shape marker. Colour is never the only signal. */
export function StatusBadge({ kind, tr }: StatusBadgeProps) {
  const label =
    kind === "unevaluated" ? tr.notEvaluated : kind === "review" ? tr.needsReview : tr.result[kind] ?? tr.status[kind] ?? kind;
  return (
    <span className={`rr-badge rr-badge-${kind}`}>
      <span className="rr-badge-dot" aria-hidden />
      {label}
    </span>
  );
}
