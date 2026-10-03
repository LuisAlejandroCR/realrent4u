# extract.py: Module A — automated rule extraction from the corpus into submission/rules.json.
# One Claude call per document (structured output), raw outputs cached in runs/raw/, every quote
# verified against the source text, and every kept or dropped rule written to an audit log.

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from realrent import corpus, paths, validate

MODEL = "claude-opus-5-5"
RAW = paths.RUNS / "raw"

CATEGORIES = [
    "rent_increase_limits",
    "just_cause_eviction",
    "security_deposits",
    "application_screening_fees",
    "screening_restrictions",
    "algorithmic_rent_setting",
]

# Output schema for the model: flat, no nulls ("" or 0 mean "not stated"); mapped to the official
# rule schema in to_rule_record().
RULE_SCHEMA = {
    "type": "object",
    "properties": {
        "jurisdiction": {"type": "string"},
        "level": {"type": "string", "enum": ["state", "city"]},
        "category": {"type": "string", "enum": CATEGORIES},
        "status": {"type": "string", "enum": ["in_force", "not_yet_effective", "pending", "failed"]},
        "title": {"type": "string"},
        "requirement": {"type": "string"},
        "key_value": {"type": "string"},
        "citation": {"type": "string"},
        "quoted_span": {"type": "string"},
        "effective_date": {"type": "string"},
        "coverage_text": {"type": "string"},
        "built_cutoff_date": {"type": "string"},
        "built_cutoff_basis": {"type": "string", "enum": ["none", "year_built", "certificate_of_occupancy"]},
        "built_cutoff_direction": {"type": "string", "enum": ["none", "on_or_before", "after"]},
        "min_units": {"type": "integer"},
        "exempts_small_owner_occupied": {"type": "boolean"},
        "exemptions": {"type": "string"},
        "penalty": {"type": "string"},
        "displaces_state_rule": {"type": "boolean"},
        "interaction": {"type": "string"},
        "conflict_note": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": [
        "jurisdiction", "level", "category", "status", "title", "requirement", "key_value",
        "citation", "quoted_span", "effective_date", "coverage_text", "built_cutoff_date",
        "built_cutoff_basis", "built_cutoff_direction", "min_units", "exempts_small_owner_occupied",
        "exemptions", "penalty", "displaces_state_rule", "interaction", "conflict_note", "confidence",
    ],
    "additionalProperties": False,
}

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"rules": {"type": "array", "items": RULE_SCHEMA}},
    "required": ["rules"],
    "additionalProperties": False,
}

SYSTEM = f"""You extract U.S. rental-housing rules from one legal source document into structured records.

Only these six categories count:
- rent_increase_limits: rent cap formula, covered buildings, exemptions, local vs state precedence
- just_cause_eviction: permitted causes, notice, relocation assistance, coverage
- security_deposits: maximum deposit, exceptions, effective date
- application_screening_fees: fee caps, allowed upfront charges, receipts and refunds
- screening_restrictions: limits on criminal-history or source-of-income screening, timing rules
- algorithmic_rent_setting: covered software, prohibited conduct, penalties, effective date

Rules:
1. Emit one record per distinct rule the document itself establishes or proposes, per category and
   jurisdiction. If the document supports none of the six categories, return an empty list.
2. quoted_span must be copied character-for-character from the document (at least one full
   sentence, 20+ characters). Never paraphrase it. If you cannot quote support, omit the rule.
3. Use only the document text. Do not add rules, numbers or dates from memory.
4. jurisdiction is the state code ("CA", "NJ", "MA") for state law, or "City, ST" (e.g.
   "San Francisco, CA") for city law; level matches.
5. status is as of the query date {paths.DEFAULT_AS_OF}: in_force; not_yet_effective (enacted, takes
   effect later); pending (bill or proposal, not law); failed (struck, vetoed or rejected).
6. effective_date is YYYY-MM-DD (or YYYY-MM / YYYY if that is all the text gives); "" if not stated.
   If the document gives conflicting effective dates, use the one in the operative text and explain
   the conflict in conflict_note.
7. Coverage: built_cutoff_* describe a construction cutoff ("units with a certificate of occupancy
   issued on or before 1979-06-13" -> 1979-06-13, certificate_of_occupancy, on_or_before). Use
   "none"/"" when there is none. min_units is the minimum units in the building for coverage, 0 if
   none. exempts_small_owner_occupied is true if owner-occupied small buildings are exempt.
8. displaces_state_rule is true only for a local rule that the text says governs instead of a state
   rule on the same topic (e.g. local rent control displacing a statewide cap); explain in
   interaction.
9. requirement: one or two plain-language sentences. citation: the official cite (section, chapter,
   ordinance or bill number). penalty: the sanction or remedy for violating the rule (fines, damages,
   rent refunds), "" if the document states none. confidence: 0 to 1.
10. Use "" for any text field the document does not state."""


def _document_message(doc: corpus.Document, text: str) -> str:
    return (
        f"doc_id: {doc.doc_id}\njurisdiction (manifest): {doc.jurisdiction}\nsource_url: {doc.url}\n"
        f"source_type: {doc.source_type}\nretrieved_at: {doc.retrieved_at}\n\n"
        f"<document>\n{text}\n</document>\n\nExtract the rules."
    )


def call_model(client, doc: corpus.Document, text: str) -> dict:
    """One structured-output call. Returns {"rules": [...], "meta": {...}}."""
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=64000,
        system=SYSTEM,
        messages=[{"role": "user", "content": _document_message(doc, text)}],
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    ) as stream:
        response = stream.get_final_message()
    meta = {
        "model": response.model,
        "stop_reason": response.stop_reason,
        "request_id": getattr(response, "_request_id", None),
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if response.stop_reason != "end_turn":
        return {"rules": [], "meta": meta, "error": f"stop_reason={response.stop_reason}"}
    text_out = next(b.text for b in response.content if b.type == "text")
    return {"rules": json.loads(text_out)["rules"], "meta": meta}


def raw_output(client, doc: corpus.Document, force: bool = False) -> dict:
    """Cached model output for a document; calls the model only when there is no cache."""
    cache = RAW / f"{doc.doc_id}.json"
    if cache.exists() and not force:
        return json.loads(cache.read_text(encoding="utf-8"))
    if client is None:
        raise RuntimeError(f"no cached output for {doc.doc_id} and no API client")
    out = call_model(client, doc, doc.text())
    RAW.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out


_DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")


def _opt(value: str) -> str | None:
    value = (value or "").strip()
    return value or None


def to_rule_record(raw: dict, doc: corpus.Document, quote: str, rule_id: str) -> dict:
    """Map one model record to the official rule schema (+ structured coverage for the engine)."""
    effective = _opt(raw["effective_date"])
    coverage = {
        "text": _opt(raw["coverage_text"]),
        "built_cutoff_date": _opt(raw["built_cutoff_date"]),
        "built_cutoff_basis": raw["built_cutoff_basis"],
        "built_cutoff_direction": raw["built_cutoff_direction"],
        "min_units": raw["min_units"] or 0,
        "exempts_small_owner_occupied": raw["exempts_small_owner_occupied"],
        "displaces_state_rule": raw["displaces_state_rule"],
    }
    return {
        "team_rule_id": rule_id,
        "jurisdiction": raw["jurisdiction"].strip(),
        "level": raw["level"],
        "category": raw["category"],
        "status": raw["status"],
        "title": raw["title"].strip(),
        "requirement": raw["requirement"].strip(),
        "key_value": _opt(raw["key_value"]),
        "coverage_conditions": coverage,
        "exemptions": _opt(raw["exemptions"]),
        "penalty": _opt(raw.get("penalty", "")),
        "overrides": [],
        "interaction": _opt(raw["interaction"]),
        "effective_date": effective if effective and _DATE.match(effective) else None,
        "citation": raw["citation"].strip() or doc.doc_id,
        "source_doc_id": doc.doc_id,
        "source_url": doc.url,
        "quoted_span": quote,
        "confidence": max(0.0, min(1.0, float(raw["confidence"]))),
        "conflict_flag": bool(_opt(raw["conflict_note"])),
        "conflict_note": _opt(raw["conflict_note"]),
        "retrieved_at": doc.retrieved_at,
    }


def build_rules(outputs: dict[str, dict], log: list[dict]) -> list[dict]:
    """Quote-check, map and de-duplicate model outputs (deterministic; no model calls)."""
    docs = corpus.documents()
    best: dict[tuple, dict] = {}
    for doc_id in sorted(outputs):
        doc = docs[doc_id]
        for n, raw in enumerate(outputs[doc_id].get("rules", []), start=1):
            entry = {"doc_id": doc_id, "n": n, "category": raw.get("category"),
                     "jurisdiction": raw.get("jurisdiction"), "citation": raw.get("citation")}
            quote = corpus.find_quote(doc_id, raw.get("quoted_span", ""))
            if not quote:
                log.append({**entry, "action": "dropped", "reason": "quote_not_in_source",
                            "quoted_span": raw.get("quoted_span")})
                continue
            rule = to_rule_record(raw, doc, quote, f"r-{doc_id}-{n:02d}")
            key = (rule["jurisdiction"], rule["category"], rule["citation"].lower(), rule["status"])
            kept = best.get(key)
            if kept and kept["confidence"] >= rule["confidence"]:
                log.append({**entry, "action": "dropped", "reason": f"duplicate_of {kept['team_rule_id']}"})
                continue
            if kept:
                log.append({"doc_id": kept["source_doc_id"], "rule": kept["team_rule_id"],
                            "action": "dropped", "reason": f"duplicate_of {rule['team_rule_id']}"})
            best[key] = rule
            log.append({**entry, "action": "kept", "rule": rule["team_rule_id"]})
    _link_overrides(list(best.values()))
    return sorted(best.values(), key=lambda r: r["team_rule_id"])


def _link_overrides(rules: list[dict]) -> None:
    """A local rule that displaces state law overrides state rules of its category and state."""
    for local in rules:
        if local["level"] != "city" or not local["coverage_conditions"]["displaces_state_rule"]:
            continue
        state = local["jurisdiction"].rsplit(", ", 1)[-1]
        local["overrides"] = [
            r["team_rule_id"] for r in rules
            if r["level"] == "state" and r["jurisdiction"] == state and r["category"] == local["category"]
        ]


def run(force: bool = False, only: list[str] | None = None, offline: bool = False, workers: int = 6) -> int:
    docs = [d for d in corpus.documents().values() if d.has_text and (not only or d.doc_id in only)]
    client = None
    if not offline:
        import anthropic

        client = anthropic.Anthropic(max_retries=5)
    outputs, log = {}, []

    def one(doc):
        return doc, raw_output(client, doc, force=force)

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [pool.submit(one, doc) for doc in docs]
        for fut, doc in zip(futures, docs):
            try:
                _, outputs[doc.doc_id] = fut.result()
            except Exception as e:  # one failed document must not stop the run; it is logged
                log.append({"doc_id": doc.doc_id, "action": "error", "reason": f"{type(e).__name__}: {e}"})
                print(f"{doc.doc_id}: ERROR {e}", file=sys.stderr)
                continue
            out = outputs[doc.doc_id]
            meta = out.get("meta", {})
            print(f"{doc.doc_id}: {len(out.get('rules', []))} candidate rules"
                  f"{' · ' + out['error'] if out.get('error') else ''}"
                  f" · {meta.get('input_tokens', 0)}/{meta.get('output_tokens', 0)} tokens", flush=True)
    usage_in = sum(o.get("meta", {}).get("input_tokens", 0) for o in outputs.values())
    usage_out = sum(o.get("meta", {}).get("output_tokens", 0) for o in outputs.values())
    print(f"tokens in cache: {usage_in} in / {usage_out} out · ~${usage_in * 4e-6 + usage_out * 20e-6:.2f} at Opus 5.5 rates")
    rules = build_rules(outputs, log)
    paths.SUBMISSION.mkdir(exist_ok=True)
    paths.RULES_JSON.write_text(json.dumps({"rules": rules}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_path = paths.RUNS / f"extract-{stamp}.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in log), encoding="utf-8")
    errors = validate.check_rules({"rules": rules})
    kept = sum(e["action"] == "kept" for e in log)
    dropped = sum(e["action"] == "dropped" for e in log)
    print(f"rules: {len(rules)} written · kept {kept} · dropped {dropped} · log {log_path.name}")
    for e in errors:
        print(e)
    return 1 if errors else 0


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description="Extract rules from the corpus into submission/rules.json")
    p.add_argument("--force", action="store_true", help="re-call the model even if a cached output exists")
    p.add_argument("--only", nargs="*", help="doc_ids to process (default: all with text)")
    p.add_argument("--offline", action="store_true", help="rebuild rules.json from cached outputs only")
    p.add_argument("--workers", type=int, default=6, help="parallel model calls (default 6)")
    args = p.parse_args(argv)
    return run(force=args.force, only=args.only, offline=args.offline, workers=args.workers)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
