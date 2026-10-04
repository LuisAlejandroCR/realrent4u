<!--
mobile/docs/UX-AUDIT.md: auditoría UI/UX de la app Expo (2026-10-04): bugs encontrados, mejoras y criterios
de aceptación de la pasada "cinematográfica" (hápticos, animación, sellos del expediente).
Se distingue de mobile/README.md (cómo correr la app y su arquitectura) y de docs/DESIGN.md (sistema visual web).
-->

# Mobile UX audit — 2026-10-04

Principles: less is more · a picture over a paragraph · every tap answers back (motion + haptic) ·
exploration earns small wins. Never legal advice, never invented data.

## Bugs

| # | Where | Bug | Fix | Acceptance |
|---|---|---|---|---|
| B1 | Metro cache / `scripts/build-data.mjs` | Changes tab shows "Results not available" for T1–T5: the bundle carries a stale `changes.json = {}` | `build-data` writes files in place (no `rm -rf` of the watched dir); restart Metro with `-c` | T1 shows 250 affected |
| B2 | Search | Results capped at 50 but the count says "50 matches" | Count the real total; say "first 50" | "ca" shows the true total |
| B3 | Rule detail · Why | Every reason is labelled "Missing fact" and shown as a raw code (`effective_date_contradiction`) | Translate reason codes EN/ES | No raw codes on screen |
| B4 | Home CTA | Second tap does not focus the search field (param unchanged) | Nonce in the focus param | Field focused every time |
| B5 | Scenario | "0 conflicts" always printed; affected IDs not tappable | Show only when > 0; chips open the address | Tap A0001 → address |
| B6 | Scenario | Unknown test id renders a blank screen | Notice | — |
| B7 | Icons (web) | Native-only a11y props leak to the DOM (console errors) | Pass them only on native | Clean console |
| B8 | Address cards | Explanation repeats the title ("X applies to this address…") | Show reason only when it adds information | — |

## Improvements

1. **Result strip** on the address screen: one proportional bar of results + legend chips that filter the list.
2. **Compact rule rows**: colour rail + title + reason (only when not plain `applies`). ~60 % less scroll.
3. **Rubber-stamp result** on rule detail: rotated stamp lands with a haptic thunk.
4. **Haptics**: selection (tabs, language, date, filters), light impact (open), success (stamp earned).
5. **Case file (gamification)**: five exploration stamps — find an address, spot a jurisdiction mismatch,
   read a source, time-travel (change date), explore a scenario. Home shows progress; each new stamp lands
   with a toast + haptic. Session-only, no data stored.
6. **Quick wins**: Home and empty Search offer three "tricky" addresses (Dorchester → Boston,
   San Ysidro → San Diego, Hoboken conflict) instead of a paragraph.
7. **Scenario**: count-up of affected addresses, tappable IDs, "jump to date" buttons.
8. **Press feedback**: spring scale on cards; tab fade. All motion off under Reduce Motion.

## Added during the pass

- **Profile sheet "You"** (avatar on every tab header, ring = stamps): case file + settings. Language is detected
  from the phone (`expo-localization`) and changed here; the EN/ES toggle left every header.
- B9: a detail opened from another tab had no Back → tab stacks start on `index`.
- B10: count-up could freeze at 0 when frames pause → a timer always lands the true value.
- B11: language radios and Done buttons had no accessible name.
- Rule detail now shows the penalty when the record has one (Module A field).

## Maps, charts and KPIs (second pass)

- **Maps** (`react-native-maps`, works in Expo Go; web preview uses `Maps.web.tsx`). Points come from the Census
  geocoder output already in `derived/census/` (485 street matches, 15 jurisdiction centroids), rounded to ~100 m by
  `scripts/build-data.mjs` → `assets/data/geo.json`. The address map shows a soft circle labelled "approximate",
  never a pin. The scenario map shows every address in scope: affected, needs review, not affected; tap opens it.
- **Charts** (`src/components/Charts.tsx`): KPI tiles, stacked part-to-whole bar (tap a segment to name it), one-hue
  bar list. Result fills use a validated palette (`chart` in `theme.ts`, dataviz validator: all checks pass; yellow
  and aqua under 3:1, so every chart carries direct labels). Text badges keep their darker text-safe shades.
- Scenario: **before → after** bars for T1/T3 (250 / 140 addresses flip not-yet-effective → applies) and
  **affected by jurisdiction** for T2/T4/T5 (T2: Newark 0/50, Jersey City 50/50, Hoboken 40/40).
- Method: KPI row (85 rules · 87 documents · 500 addresses · 4 dates), all results at the as-of date, rules by
  category.
- B12: scenario rules were all labelled "rule not in the record" — organizer ids (CA-ALG-01) are matched to
  pipeline ids (r-D022-01) only in `changes.json` notes; the app now reads that match and links the rule.
- Case file strip on Home expands in place instead of opening the profile sheet.

## Third pass — every tap answers, less text (spec)

| # | Change | Acceptance |
|---|---|---|
| I1 | Maps select, then open: tapping a dot highlights it and shows a card (address, legal jurisdiction, status, Open) | Tap dot → card; Open → address |
| I2 | Address map opens a full-screen interactive map of that jurisdiction's sample addresses | Tap mini-map → `/map` |
| I3 | Charts drill down: Method result segment → that result by category; category bar → its rules; scenario jurisdiction bar → filters map + addresses | Tap "Unknown" → breakdown |
| I4 | KPI tiles navigate or filter (addresses → search, dates → date sheet, needs review → flagged only) | Tap tile → effect |
| R1 | Rules on record grouped by outcome (Applies · Can't tell · Displaced · Not yet in force); one compact row per rule, category as a tag | No status line repeated per row |
| R2 | Rule detail: stamp + one-line reason; status / effective / jurisdiction tiles; requirement clamped to 3 lines; quote card visible; engine text behind "Full explanation"; empty sections hidden | No "No information" rows |

## Fourth pass — three tabs, Changes as a timeline (spec)

| # | Change | Acceptance |
|---|---|---|
| N1 | Search leaves the tab bar: tabs are Home · Changes · Method. Search, address and rule screens live in Home's stack (`app/(tabs)/(home)/`); URLs unchanged | `/search/A0001` opens with Home tab active and Back to Home |
| N2 | Home's search bar pushes the search screen (native header with Back) | Back from search returns to Home |
| C1 | Changes list: KPI row (tests · address changes · need review · no effect) that filters the list | "Need review" → T2, T3 only |
| C2 | One timeline row per test: ID, title, a track across the four dates (dot = one date, bar = before → after), affected count; date header sets the as-of date | Tap T1 row → scenario; tap a date → as-of changes |

## Verify — 2026-10-04

Done: `npm run typecheck` passes; web preview on a cache-cleared Metro: B1 (T1–T5 = 250/90/140/110/0), B2
("305 matches · showing the first 50"), B3 (plain reasons), B5 (chips open the address, flagged in red), B7 (clean
console), B9 (Back present), filters, stamp toast, time jump, profile + ES switch.
Second pass: typecheck passes; web preview: T1 before→after, T2 by-jurisdiction (Newark 0/50), Method KPIs + charts,
address approximate-map card, clean console.
Third pass: typecheck passes; web preview: I1 (dot → card "A0040 · Needs review · Hoboken, NJ"), I2 (`/map?address=A0322`,
50 San Diego dots), I3 (Hoboken bar → 40 dots / 40 addresses; Method "Unknown" → by category + reasons, 890 = owner
not in record), I4 ("need human review" tile → 90), R1 (Applies 16 → 4 + "Show all"), R2 (stamp, tiles, clamp).
Fourth pass: typecheck passes; web preview: three tabs (Home · Changes · Method); Home → search pushes with Back;
`/search/A0002` from T2 opens with Home tab active and Back; Changes KPIs 5 · 590 · 2 · 1, "need review" → T2, T3;
timeline rows with dot / before→after bar, date header labels "Dec 31 / 2025"; KPI tiles equal width.
Known, web preview only: ~12 React-Native-Web "Unknown event handler property onResponder*" warnings on a full page
load (none on in-app navigation); not reproduced on native.
Pending on a device in Expo Go: haptics, native sheets, native maps (Apple/Google tiles).
