<!--
METHOD.md: nota de método de una página (entregable del brief): cómo se extraen, resuelven, aplican y
rastrean las reglas, la política de `unknown` y los límites. La web la muestra en /method.
Se distingue de README.md (qué es el proyecto y cómo correrlo) y de AGENTS.md (criterios y reglas de trabajo).
-->

# Method note

**Not legal advice.** realrent4u reports what public sources say, with a citation, a verbatim quote, the
retrieval date and an as-of date (default 2026-10-01). It never suggests ways around a rule.

## Extraction (Module A)

One Claude call (`claude-opus-5-5`) per captured document: 54 of the 87 sources; the other 33 are
link-only. Structured output constrains the answer to a flat JSON schema built from the official rule
record; code maps it onto `rule_record.schema.json`, adds `source_url` and `retrieved_at` from the
manifest, and validates. The prompt (version 2) allows only the six categories and no facts from memory.

- **Quote check:** a rule survives only if its `quoted_span` is found verbatim in its own
  source; otherwise it is dropped and logged. The validator re-checks every quote.
- **Dates:** a missing effective date is derived only from the enactment date (via a clause in the
  source or California's January 1 default for statutes) and noted on the rule.
- **Audit log:** raw output per document is cached in `runs/raw/` (model, prompt version, tokens);
  each run writes `runs/extract-<UTC>.jsonl` listing every candidate, kept or dropped, and why.
- **Offline rebuild:** `extract --offline` rebuilds the identical `rules.json` from the cache, with
  no model call.

**In progress:** extraction lives on branch `feat/extract-run`, not merged; `main` still ships empty
submission files. That run: 94 candidates, 1 dropped (quote not in source), 11 duplicates merged,
82 rules; 362k input and 109k output tokens, about $3.60.

## Jurisdiction (Module B)

All 500 addresses go to the Census Geocoder batch endpoint, never trusting the postal city;
misses are retried without the ZIP, and a match counts only inside the row's own state. Coordinates
give the incorporated place and county; without a match, a postal-city map (Dorchester → Boston,
San Ysidro → San Diego) is the fallback. Result: **485 Census matches, 15 fallback, 0 unresolved**.
Responses are cached, so `resolve --offline` reproduces `derived/jurisdictions.json`.

## Apply logic and precedence

A deterministic engine (no network, no model) evaluates rule × building facts × as-of date:

1. **Candidate:** rules stack state → county → city (the corpus has no county rules).
2. **Time:** `failed` rules never appear; bills stay `pending`. For enacted rules the effective date,
   not the stored status, is compared with the as-of date.
3. **Coverage:** construction cutoffs, unit counts, small-owner exemptions. Clearly outside → omitted.
4. **Precedence:** a state rule is `superseded` only when a local rule that displaces it **applies**
   at that address; if the local rule is `unknown`, the state rule becomes `unknown`.
5. **Mass. G.L. c. 40P** bars local rent control. It is shown as a bar, never as a rent cap.

Explanations (English and Spanish) are templates with citation, as-of date and disclaimer; an optional
LLM rewrite must keep all three.

## The `unknown` policy

If coverage depends on a missing fact, the answer is `unknown` with a reason, never a guess: no year
built (San Diego, Berkeley), no unit count (Berkeley, Boston apartments, Jersey City, Newark, most of
Hoboken), a building from the cutoff year (SF 1979, LA 1978: year built is not the certificate of
occupancy), no owner data, or an effective date given only as a month or year.

## Change tracking (Module C) and conflict flags

Test rule ids are matched to extracted rules by jurisdiction and category; the engine runs at the
test dates. T1, T3: addresses that flip from `not_yet_effective` to `applies`. T2: each local
ban only inside its city. T4: addresses where the bills are `pending`. T5: must be empty.

The extractor flags a rule whose source shows disagreeing dates or possible preemption. In T3, NJ
addresses where the FAIR Act and a local ban both appear are flagged for human review, not resolved.

**In progress:** on that branch, T1 flips all 250 CA addresses, T3 all 140 NJ addresses, T4
reaches all 110 MA addresses as pending, and T5 is empty. T2 and the T3 flags are still empty: the
Hoboken and Jersey City bans (D032–D035) are link-only, so there is no text to extract.

## Limits

- No owner data, so small-landlord exemptions always stay `unknown`.
- Link-only sources yield no rules; T5's empty result is backed by c. 40P, since the struck ballot
  question (D059) is link-only.
- The quote check catches invented text, not misreadings of real text.
- Not legal advice: results are information, not a compliance check.
