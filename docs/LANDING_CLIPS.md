<!--
LANDING_CLIPS.md: prompts de video (sin voz) para que ElevenLabs genere los 3 clips de la landing, un video
de 6–8 s por paso, siguiendo el flujo de la página. Se distingue de RECORDING.md (los 2 videos de entrega de
1 minuto) y de DESIGN.md (cómo se ve la web).
-->

# Landing clips: ElevenLabs prompts, one 8 s video per step

ElevenLabs has never seen the page, so every prompt describes the shot in full. Generate each step as its
own silent video (16:9, 1920×1080, 8 s), then join the 4 steps of each clip. No voice: the on-screen
titles carry the story.

**Use the same style block in every video prompt** (paste it at the end):

> Style: clean motion-graphics explainer, flat 2D, no people, no logos, no real brand names. Deep night-navy
> background #0F1626 with a faint grid of thin lines like city blocks. Cards are off-white #F5F4EF with
> rounded corners and soft shadows. Accent colors: ink blue #2949A8 for "applies", marigold #F2B65C for
> highlights and warnings. Text in a clean sans-serif; one word in serif italic for emphasis. Slow, calm
> camera push-in, smooth easing, no fast cuts. All on-screen text exactly as written, in English.

**Output:** join each clip to `web/public/media/<id>.mp4`, then set `src` and `duration` for that id in
`web/landing.config.json`.

---

## Clip 1 · `how-it-works`: "Three facts decide. We check each one."

**Step 1 · Three facts decide (8 s)**
- **Video:** An envelope slides in with a printed address "33 WARD ST, SOUTH BOSTON, MA 02127". The camera
  pushes in on the address. Three empty rounded tiles fade in below it, labelled "Legal city", "Building",
  "Date". Title appears at the top: "Three facts decide."

**Step 2 · The legal city (8 s)**
- **Video:** A simple flat map of a coastal city with thin grey county lines and blue water. A glowing
  marigold pin drops on a neighborhood. The label "South Boston" appears, then a marigold line strikes
  through it, and a stamp "Boston, MA" lands next to it with a small bounce. Corner caption: "Location
  rounded to about 1 km".

**Step 3 · The building record (8 s)**
- **Video:** An off-white record card with two rows: "Year built: 2019" (solid) and "Units: not in the record"
  (dashed marigold outline, blinking softly). A small badge appears beside it: a hollow ring and the word
  "Unknown". Title: "Missing fact = unknown".

**Step 4 · The date (8 s)**
- **Video:** A horizontal timeline with four dots labelled "2025-12-31", "2026-01-02", "2026-10-01",
  "2027-07-02". A marigold marker slides from left to right; above each dot, a short stacked bar grows and
  changes its mix of blue and striped segments as the marker passes. Title: "Same building, four dates."

---

## Clip 2 · `five-results`: "Five results, always labelled."

**Step 1 · Five results (8 s)**
- **Video:** Five pill-shaped labels slide in one by one in a row, each with its own small marker shape:
  "Applies" (filled blue dot), "Unknown" (hollow ring), "Superseded" (short bar), "Not yet effective"
  (diamond, dashed outline), "Pending" (diamond, dashed outline). Title: "Five results, always labelled."

**Step 2 · Applies and superseded (8 s)**
- **Video:** Two stacked cards. Top card: "San Francisco Rent Ordinance", blue pill "Applies". Bottom card:
  "Statewide rent cap (Civil Code 1947.12)" slides down and turns grey, its pill changing to "Superseded".
  A thin arrow from the top card to the bottom one. Small caption: "3515 Fillmore St · built 1926".

**Step 3 · Unknown (8 s)**
- **Video:** A rule card "Berkeley rent stabilization" with a dashed marigold left border and the pill
  "Unknown". A line of text fades in under it: "Year built is missing from the record." A small magnifier
  hovers over an empty field labelled "Year built".

**Step 4 · Not yet effective and pending (8 s)**
- **Video:** Split screen. Left card: "New Jersey FAIR Act", pill "Not yet effective", a calendar flipping to
  "July 1, 2027". Right card: "Massachusetts bill S.2983", pill "Pending", a paper stamped "BILL, NOT LAW".

---

## Clip 3 · `change-over-time`: "Five scenarios across time."

**Step 1 · The law moves (8 s)**
- **Video:** A horizontal date axis with four ticks: "2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02".
  Five lanes labelled "T1" to "T5" in serif italic draw in one after another: blue spans for T1 and T3,
  single dots for T2 and T4, a hollow ring for T5. Title: "Five scenarios across time."

**Step 2 · T1: 250 addresses (8 s)**
- **Video:** Three small flat maps side by side, labelled "Los Angeles", "San Francisco · Berkeley",
  "San Diego", each with clusters of grey hollow dots. All the dots turn solid blue in a wave. A large counter
  above ticks from 0 to "250 of 500". Caption: "California pricing-algorithm ban takes effect".

**Step 3 · T2: the city line (8 s)**
- **Video:** One flat map with three neighbouring cities labelled "Newark", "Jersey City", "Hoboken". The dots
  in Jersey City and Hoboken turn solid; the Newark dots stay hollow grey. A thin dashed city boundary glows
  between Newark and Jersey City. Caption: "Local bans stop at the city line".

**Step 4 · T3: 90 for review · T5: zero (8 s)**
- **Video:** The same map: now the Newark dots also turn solid, and 90 dots in Jersey City and Hoboken become
  marigold diamonds with a small "▲ 90 need human review" counter. Then a quick cut to a Boston map where
  every dot stays hollow, with the caption "T5 · 0 addresses · confirmed empty".

## Production (done)

Raw clips came from ElevenLabs (`kling-3-pro`, people, ~5 s each) into `web/public/media/raw/` (gitignored).
`python web/scripts/landing-clips.py` blurs only the boxes where the model drew unreadable text (people stay
sharp) and draws the exact titles in two beats, writing `web/public/media/<id>.mp4` + `<id>.jpg`. The landing
plays each one muted and looping beside its section heading; with reduced motion it shows the poster.
