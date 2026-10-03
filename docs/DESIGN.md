<!--
DESIGN.md: sistema visual del demo web (web/**) — tokens, componentes, lenguaje y reglas.
Inspirado en la estructura de LuisAlejandroCR/prufture (apps/backend/DESIGN.md), con paleta de vivienda
y del brief. Se distingue de PLAN.md (quién construye qué) y de VIDEO_SCRIPTS.md (narración de videos).
-->

# Design — realrent4u web

A public-records desk, not a startup splash. Calm, cited, one address at a time. The visitor never
needs to know about extraction, schemas or geocoders: they type an address, pick a date, and read
which rules apply, why, and where it says so.

Structure borrowed from [prufture](https://github.com/LuisAlejandroCR/prufture) (`apps/backend/DESIGN.md`):
dials, one token file, status carried by a dot not by tinted text, eyebrow labels, one serif-italic
accent per heading, pill buttons, soft surfaces. Palette moved from prufture's terracotta field kit to
**housing and the challenge brief**: deep navy ink and teal from the brief, a warm brick accent for
"home". The sponsor's name and logo never appear as our brand; credit them in the footer only
("Challenge by RealPage · Hack-Nation 7").

## Dials

- DESIGN_VARIANCE 5: one asymmetric moment on the landing (1.5fr search + promise vs 1fr "what every
  answer carries" card). Every other page is a single calm column.
- MOTION_INTENSITY 2: one 0.2s fade per view and result rows fading up with a 40ms stagger (max 8),
  all gated behind `prefers-reduced-motion`. No gradients, no parallax.
- VISUAL_DENSITY 3 on landing and address pages, 5 on the change-tests page (one table per test).

## Tokens

**Palette: Stamp & Marigold** (shared with the mobile app; light only, no dark full-width sections, no
strong gradients). Tokens live in `web/rr/rr.css` (`:root`); landing styles in `web/rr/rr-home.css`,
dashboard additions in `web/rr/rr-landing.css`. Components use classes, never raw hex.

| Token | Value | Use | Contrast (measured) |
|---|---|---|---|
| `--rr-paper` | `#F5F4EF` | page background | — |
| `--rr-surface` | `#FFFFFF` | cards, controls | — |
| `--rr-soft` | `#E9EEF8` | quiet sections and panels | — |
| `--rr-evidence` | `#FFF6E3` | quotes, examples, notes | — |
| `--rr-ink` | `#141C2E` | headings, body text | 15.4:1 on paper |
| `--rr-ink-2` | `#4F5869` | secondary text | 6.5:1 paper · 6.2:1 soft |
| `--rr-stamp` | `#2949A8` | CTAs, links, selection, focus | 7.3:1 paper · white on it 8.0:1 |
| `--rr-marigold-ink` | `#8F520A` | accent text (italic heading word, kicker) | 5.6:1 paper · 5.3:1 soft |
| `--rr-marigold` | `#B86A0E` | borders, symbols, details only (3.7:1, non-text) | — |
| `--rr-highlight` | `#FFE29A` | sparing editorial `<mark>` | ink on it 13.4:1 |
| `--rr-border` | `#D8DAE0` | lines and separators | — |

**Result status**: each result has a written label and its own marker shape, so colour is never the
only signal.

| Result | Colour | Marker | Label (EN / ES) |
|---|---|---|---|
| `applies` | stamp blue | filled dot | Applies / Aplica |
| `unknown` | marigold text | ring, dashed card border | Unknown / Desconocido (a fact is missing; never guessed) |
| `superseded` | ink-2 | bar | Superseded / Desplazada |
| `not_yet_effective` | ink | diamond, dashed | Not yet effective / Aún no vigente |
| `pending` | ink | diamond, dashed | Pending / Pendiente |
| conflict flag | white on marigold text | triangle | Needs human review / Requiere revisión humana |

**Landing (`/`)**: the story in six parts. Every example and number comes from the data files.
1. Hero (address + date)
2. Problem (postal city ≠ jurisdiction, building facts, date)
3. How it works (3 steps, ElevenLabs videos with QR)
4. The five results
5. T1–T5 over time ("results not available" ≠ "0, confirmed empty")
6. Closing CTA to `/dashboard`

Videos and QR destinations come from `web/landing.config.json` (see `web/README.md`). Until they are set, the page shows labelled placeholders.

**Landing storyboard (section 3, "How it works")**: one short ElevenLabs video per row, beside its
title, context and a real example read from the data. These are separate from the three submission
videos in `VIDEO_SCRIPTS.md`.

| # | id | Topic | Example shown beside it |
|---|---|---|---|
| 1 | `why-address-and-date` | Why the rules change with address and date | T1 title and its scenario dates |
| 2 | `postal-vs-legal` | Postal city vs legal jurisdiction | A0036: South Boston → Boston, MA |
| 3 | `reading-results` | Reading a result; `unknown` = missing fact, never guessed | A0036 result counts at the as-of date (only if lookups exist) |
| 4 (optional) | `open-the-source` | Opening the quote and the original source | Quoted span + citation of a sample rule |

Type: system sans for UI; one serif italic (`Georgia`, `"Iowan Old Style"`) for the accent word.
Fluid `h1` with `clamp(2rem, 4vw, 3.25rem)`, 16px body, monospace only for citations and address ids.
Spacing 4 / 8 / 12 / 16 / 24 / 40 / 64. Radius 8 / 12 / 20 / pill. Targets ≥ 44px.

## Rent vibe

- **House mark:** a simple 24px stroke house whose door is a citation bracket `[ ]`. No emoji.
- **Address plate:** the selected address renders like a building number plate — navy plate, white
  monospace number, street below — with the legal jurisdiction beside it as a pill
  ("Legal city: Boston, MA" when the postal city says Dorchester, plus a small "postal city differs"
  note).
- **Building facts strip:** year built · units · use, each with "not in the record" in muted text
  when missing. This strip is what explains every `unknown`.
- **Quote block:** the quoted span on `--surface-soft` with a 3px teal left rule, then
  "Source · retrieved 2026-10-01 · as of <date>" and the source link.

## Pages

1. **Landing `/`** — eyebrow "Rental housing law, address by address", heading
   "Which rules apply *here*, today?", one search field over the 500 sample addresses, date pills
   from `paths.DEMO_DATES`, EN/ES toggle. Right card: "Every answer carries" — source document,
   quoted text, retrieval date, as-of date, and `unknown` when a fact is missing.
2. **Address `/a/[id]`** — address plate, building facts strip, then results grouped by the six
   categories (Rent increases · Just cause · Deposits · Application fees · Screening · Algorithmic
   pricing). Each result: status pill, title, plain-language explanation (EN/ES), citation, quote
   block. Superseded rules sit under the rule that displaces them, collapsed.
3. **Change tests `/changes`** — one section per T1–T5: what changed, before/after dates, count of
   affected addresses, conflict flags, link to each address.
4. **Method `/method`** — the one-page method note rendered from `docs/METHOD.md`.

## Language

Plain words. "Applies", "We can't tell — the record has no year built", "Not in effect until
July 1, 2027", "This is a bill, not law". Never "compliant", "you are protected", "legal", or any
advice on avoiding a rule. Every page footer and every result card: **"Not legal advice."** /
**"No es asesoría legal."** plus the as-of date.

## Rules

- No server and no API key at runtime: the app reads precomputed JSON from `web/public/data/`.
- No sponsor logo or name as our brand; footer credit only.
- No invented data in screenshots or videos; sample addresses only.
- Lighthouse accessibility ≥ 95; keyboard: "/" focuses search, Enter opens the first match.
