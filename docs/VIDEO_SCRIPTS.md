<!--
VIDEO_SCRIPTS.md: guiones de narración listos para ElevenLabs de los 3 videos (Demo, Tech, Team),
con tomas de pantalla, duración objetivo y cifras con su fuente. Se distingue de DESIGN.md (cómo se ve
la web) y de METHOD.md (nota de método escrita); aquí va solo lo que se graba y se narra.
-->

# Video scripts — ElevenLabs

Three videos, **each up to 60 seconds** (organizer, 2026-10-03): **Product demo**, **Technical
walkthrough**, **Team introduction**. 60 s is a hard cap: keep each narration clip **≤ 57 s** measured
with `ffprobe`, leaving room for transitions. If a clip runs long, cut words; never speed up the voice.

## How to produce

1. **Voice:** ElevenLabs, model `eleven_multilingual_v2`, a calm warm voice (the one used before:
   *Lauren – Friendly, Comforting and Soft*), stability 50, similarity 75, style 0, speed 1.0.
2. Paste each **Narration** block as-is. `<break time="0.6s" />` tags add pauses; remove them if your
   model ignores them. One block per clip, so a retake costs one clip.
3. Measure each clip (`ffprobe -i clip.mp3 -show_entries format=duration -v quiet -of csv=p=0`); it must
   be ≤ 57 s. Then record the screen to that length.
4. Mix at 1920×1080, 30 fps. Nobody touches the machine while recording.
5. **Before recording, replace the personal `{{…}}` fields** in the team video (name, city, why,
   next). Every number is already filled from the final run (W8) and marked ✅.

### Numbers and their sources

| Placeholder | Value now | Source |
|---|---|---|
| documents in corpus | 87 (54 with text) + 3 team-fetched ✅ | `data/corpus/corpus_manifest.csv`, `data_extra/manifest.csv` |
| sample addresses | 500 in 9 cities ✅ | `data/data/sample_addresses.csv` |
| addresses resolved | 500 / 500 (485 Census, 15 fallback) ✅ | `derived/jurisdictions.json` (PR #5) |
| rules | 85 from 51 documents ✅ | `submission/rules.json` (final run) |
| quotes verified | 111 of 112 candidates (1 dropped) ✅ | `runs/extract-20261004T030858Z.jsonl` |
| extraction cost | ~$3.86 per full run ✅ | extractor's token report |
| change tests | T1–T5 ✅ | `data/dev/change_tests.json` |

---

## 1. Product demo (≤ 60 s · narration ~122 words ≈ 54 s)

| Time | Screen |
|---|---|
| 0:00–0:08 | Landing page, cursor in the search box |
| 0:08–0:20 | Type a Dorchester address → address plate shows "Legal city: Boston, MA" |
| 0:20–0:32 | San Francisco 1926 building: SF Rent Ordinance *Applies*, state cap *Superseded*; open the quote block |
| 0:32–0:42 | San Diego address: *Unknown — the record has no year built* |
| 0:42–0:52 | Date pill 2027-07-02 on a Jersey City address: FAIR Act flips to *Applies*, conflict flag on the local ban |
| 0:52–1:00 | Toggle ES, then the footer "Not legal advice" |

**Narration**

```text
A renter in Boston types her address. Her mail says Dorchester. The law says Boston. <break time="0.5s" />
realrent4u reads public housing law and answers one question: which rules apply here, today?
In San Francisco, this 1926 building is under the city's rent ordinance, so the statewide cap steps aside. Every answer shows the exact sentence it comes from, the source, and the date we read it. <break time="0.5s" />
When the record is missing a fact, like the year a San Diego building was built, we say unknown. We never guess.
Move the date to July 2027, and New Jersey's new law takes effect. We flag where it may clash with city rules, for a human to review.
In English or Spanish. And never as legal advice.
```

---

## 2. Technical walkthrough (≤ 60 s · narration ~123 words ≈ 53 s)

| Time | Screen |
|---|---|
| 0:00–0:10 | Terminal: `uv run python -m realrent.extract` streaming per-document lines |
| 0:10–0:25 | Audit log: one kept rule, one dropped line; a quote highlighted inside the source text |
| 0:25–0:38 | `derived/jurisdictions.json` entry for the Newark row with a Brooklyn ZIP → Newark |
| 0:38–0:50 | Engine test output: superseded, unknown with reason, T1–T5 results |
| 0:50–1:00 | `--offline` rebuild producing the identical `rules.json`; validator "OK: 0 errors" |

**Narration**

```text
Claude reads each of the 57 documents with text and returns rules in the official schema. <break time="0.4s" />
Then code takes over. Every quote must exist, word for word, in its source, or the rule is dropped and logged. 111 of 112 passed, for about four dollars per run.
Addresses go through the Census geocoder by street, not ZIP. Some sample ZIPs are wrong on purpose; all 500 still resolve to their legal city.
A deterministic engine tests each rule against the building's facts and the query date. Local law overrides state law only where the state's text says so. Missing facts become unknown, with the reason.
Outputs are cached, so one command rebuilds the same answers offline, and the five change tests run on top.
```

---

## 3. Team introduction (≤ 60 s · keep the filled narration ≤ 120 words)

Record early. Fill `{{…}}` with your own words; keep it to who, why you, and what's next.

| Time | Screen |
|---|---|
| 0:00–0:15 | Camera, or a still with name and city |
| 0:15–0:35 | Short clip of the app |
| 0:35–0:45 | Repo URL and "Not legal advice" end card |

**Narration**

```text
I'm {{NAME}}, from {{CITY}}. {{ONE_LINE_ABOUT_YOU}} <break time="0.5s" />
I built realrent4u because {{WHY_THIS_PROBLEM}}.
In 24 hours, it reads real housing law, resolves 500 addresses to their legal city, and answers which rules apply, with the exact source behind every answer.
Next, {{WHAT_COMES_NEXT}}. Thanks for watching.
```

---

## Checklist before upload

- [ ] Every `{{…}}` replaced, and each number matches its source file from the final run.
- [ ] Every screen in the video exists in the deployed app (no mockups).
- [ ] "Not legal advice" visible in the demo video.
- [ ] No keys, `.env` or personal data on screen.
- [ ] Audio matches the screen; **every video ≤ 60 s** (narration clip ≤ 57 s by `ffprobe`).
