<!--
METHOD.md: nota de método de una página (entregable del brief): cómo se extraen, resuelven, aplican y
rastrean las reglas, la política de `unknown` y los límites. La web la enlaza desde Method & audit.
Se distingue de README.md (qué es el proyecto y cómo correrlo).
-->

# Method note

**Not legal advice.** realrent4u reports what public sources say, with a citation, a verbatim quote, the
retrieval date and an as-of date (default 2026-10-01). It never suggests ways around a rule.

## Extraction (Module A)

One Claude call (`claude-opus-5-5`) per document with text: the 54 captured sources of the 87 in the
pack, plus 3 public pages the team fetched one at a time (`data_extra/`, with URL, retrieval date and
robots.txt check) because the pack only links the T2/T5 sources. Structured output constrains the answer to a flat JSON schema built from the official rule
record; code maps it onto `rule_record.schema.json`, adds `source_url` and `retrieved_at` from the
manifest, and validates. The prompt (version 2) allows only the six categories and no facts from memory.

- **Quote check:** a rule survives only if its `quoted_span` is found verbatim in its own
  source; otherwise it is dropped and logged. The validator re-checks every quote.
- **Source scope:** a rule is kept only for its document's manifest jurisdiction or that
  jurisdiction's state, so a survey article listed for Jersey City cannot create rules for other cities.
- **Dates:** a missing effective date is derived only from the enactment date (via a clause in the
  source or California's January 1 default for statutes) and noted on the rule.
- **Audit log:** raw output per document is cached in `runs/raw/` (model, prompt version, tokens);
  each run writes `runs/extract-<UTC>.jsonl` listing every candidate, kept or dropped, and why.
- **Offline rebuild:** `extract --offline` rebuilds the identical `rules.json` from the cache, with
  no model call.

Final run: 112 candidates; 13 dropped as outside their source's jurisdiction, 1 dropped (quote not in
source), 11 duplicates merged: **85 rules from 51 documents**; 375k input and 118k output tokens, about
$3.86. `realrent.pipeline --check` regenerates every submitted file offline and finds no difference.

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

Explanations (English and Spanish) start as templates with citation, as-of date and disclaimer. Claude
rewords each distinct template (700) in plain language; a rewrite is kept only if all three survive, and
is cached in `runs/explain/`, so offline runs reproduce the same text without a key.

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

**Results (affected / flagged):** T1 250 / 0 (every CA address) · T2 90 / 90 (Hoboken 40 + Jersey City
50, no Newark) · T3 140 / 90 (every NJ address; flags on Hoboken and Jersey City) · T4 110 / 0 (every
MA address, pending) · T5 0 / 0. `lookups.json` covers all 500 addresses at 2026-10-01: 7,200 applies,
1,337 unknown, 195 superseded, 140 not yet effective, 460 pending.

## Limits

- No owner data, so small-landlord exemptions always stay `unknown`.
- Link-only sources yield no rules. The Hoboken ordinance text itself (ecode360) blocks automated
  access, so Hoboken's ban rests on the city's official press release and Jersey City's on a law-firm
  summary; both are secondary to the ordinances. D059 records the struck MA ballot question as
  `failed`, and c. 40P backs T5's empty result.
- Two pending MA documents produce near-duplicate rules for S.2983.
- The quote check catches invented text, not misreadings of real text.
- Not legal advice: results are information, not a compliance check.
