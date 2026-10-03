<!--
README.md: puerta de entrada pública de realrent4u — qué hace, cómo está armado y qué entrega.
Se distingue de AGENTS.md (instrucciones y criterios para agentes de código): aquí va lo que lee
un juez o un visitante, no reglas de trabajo.
-->

# realrent4u — Rental Housing Law Navigator

> **Which rules apply here today, and what is about to change?**

Built for **Hack-Nation 7 — Global AI Hackathon** (Oct 3–4, 2026), Challenge 2 sponsored by
**RealPage**.

Type a U.S. address and a date. realrent4u tells you which rental-housing rules apply there, which
one governs when the city and the state disagree, and what would change under a new or pending
law — every answer backed by a citation and the exact quoted text from the source.

**Not legal advice.** Every result shows the date it is valid "as of" and links to its source.

## Scope

| | |
|---|---|
| States | California · New Jersey · Massachusetts |
| Cities | Los Angeles, San Francisco, San Diego, Berkeley, Santa Ana · Jersey City, Hoboken, Newark · Boston, Cambridge |
| Categories | Rent increase limits · Just-cause eviction · Security deposits · Application & screening fees · Screening restrictions · Algorithmic rent-setting |
| Corpus | 87 documents (54 with full text) · ~500 addresses |

## How it works

```text
A · Extract   corpus ─► LLM with structured output (official rule schema) ─► validate ─► rules.json
                         └─ every quoted span must exist verbatim in its source, or the rule is dropped
B · Resolve   address ─► U.S. Census Geocoder ─► legal jurisdiction (state → county → city)
    Apply     rule × building facts × as_of ─► applies | unknown | superseded | not_yet_effective | pending
    Explain   applicable rules ─► plain language (EN / ES) + citation + "as of" date
C · Track     change ─► lookups before/after ─► affected addresses + conflicts ─► changes.json
```

**Design principles**

- **The model extracts and writes; everything else is deterministic.** Rules are extracted
  automatically from the corpus — none are written by hand.
- **No invented citations.** A rule whose quote cannot be found literally in its source document is
  discarded and logged.
- **When in doubt, `unknown`.** If coverage depends on a missing fact (year built, unit count,
  owner), the answer is `unknown` with the reason — never a guess.
- **Legal jurisdiction, not postal city.** Dorchester resolves to Boston; San Ysidro to San Diego.
- **Works without the LLM.** Address lookups read the precomputed `rules.json`; only the
  plain-language explanation degrades to a template.

## Deliverables

| File | Contents |
|---|---|
| `rules.json` | Extracted rules, one record per rule, validated against the official schema |
| `lookups.json` | Results for all addresses at the default date (2026-10-01) |
| `changes.json` | Affected addresses and conflict flags for each of the five change tests (T1–T5) |
| Method note | One page: how rules are extracted, resolved, applied and tracked |

## Repository layout

| Path | Contents |
|---|---|
| `data/` | Official starter pack: corpus, addresses, rule schema, change tests, submission templates |
| `AGENTS.md` | Spec, acceptance criteria and conventions for anyone (human or agent) working on the code |

## Status

Work in progress during the hackathon. Setup, run instructions and validation results will be added
here as each module lands.

## Responsible use

realrent4u is an information tool. It does not certify compliance, does not suggest ways around a
rule, and does not invent rules where the source is silent. Only public documents are used.
