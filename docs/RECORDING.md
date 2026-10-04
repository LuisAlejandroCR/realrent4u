<!--
RECORDING.md: los 2 videos de entrega de 1 minuto (Product demo y Technical walkthrough): tomas y guion
ElevenLabs en inglés. Se distingue de LANDING_CLIPS.md (clips mudos de la landing) y de VIDEO_SCRIPTS.md
(versión anterior y más larga de los guiones).
-->

# Submission videos (60 s each)

Voice: ElevenLabs **`eleven_v3`** (audio tags such as `[pause]` only work on v3), voice *Lauren*,
stability *Natural*, speed 1.0. Tags are spoken as direction, not read aloud; keep them sparse. Each narration is about 130 words (≈ 55 s). Measure the audio with `ffprobe`; if it runs over
58 s, cut words, never speed the voice up. Every number comes from the 2026-10-04 run.

## 1. Product demo — web (record new, 60 s)

| Time | Screen (realrent4u.vercel.app) |
|---|---|
| 0:00–0:08 | Landing hero: the live stage plays, *South Boston* is struck through and *Boston, MA* is stamped |
| 0:08–0:18 | Dashboard, type `33 Ward` → A0036: map pin in Boston, the "Where and when" chart |
| 0:18–0:30 | `?a=A0016` (San Francisco, 1926): SF rule *Applies*, open "Displaces 1": state cap *Superseded*; open the quote and *Open source* |
| 0:30–0:38 | `?a=A0005` (Berkeley): *Unknown*, year built missing |
| 0:38–0:50 | `?a=A0002` (Hoboken): click the 2027-07-02 row: FAIR Act flips to *Applies*, ▲ needs human review |
| 0:50–0:60 | Change tests T2 map: Newark stays empty → toggle ES → "No es asesoría legal" |

```text
[keyboard typing] Your mail says South Boston. [pause] The law says Boston.
[softly] realrent4u answers one question for any sample address: which rental rules apply here, on this date?
We place the building in its legal city, then check every rule against its facts.
In San Francisco, this 1926 building falls under the city's rent ordinance, so the statewide cap steps aside. Every answer shows the exact quote, its source, and the date we read it.
In Berkeley, the record has no year built. [pause] So the answer is unknown. [slowly] We never guess.
[excited] Move the date to July 2027, and New Jersey's FAIR Act takes effect. Where it may clash with Hoboken's own ban, we flag it for a human.
Hoboken and Jersey City are covered. [playful] Newark, next door, is not.
[softly] In English or Spanish. [pause] Never legal advice.
```

## 2. Technical walkthrough — cut `media/realrental4u-technical.mp4` (134 s → 60 s)

The source is the iPhone app recording. Keep these source ranges, in order (≈ 60 s):

| Out | Source | Shows |
|---|---|---|
| 0:00–0:06 | 0:00–0:06 | Home: 500 addresses · 9 jurisdictions · 85 rules · 4 dates |
| 0:06–0:14 | 0:14–0:22 | Los Angeles map, sample dots, open an address |
| 0:14–0:24 | 0:22–0:32 | Rule details: *Applies*, quoted text, citation, retrieved date |
| 0:24–0:32 | 0:52–1:00 | Coverage + exemptions + penalty, as extracted |
| 0:32–0:38 | 1:18–1:24 | Choose a date: only the four precomputed dates |
| 0:38–0:50 | 1:26–1:38 | NJ FAIR Act: 140 affected, 90 need review, before/after |
| 0:50–0:60 | 1:58–2:08 | Method & audit: 85 rules, 87 documents, data files, "Not legal advice" |

```bash
ffmpeg -i media/realrental4u-technical.mp4 -filter_complex "[0:v]trim=0:6,setpts=PTS-STARTPTS[a];[0:v]trim=14:22,setpts=PTS-STARTPTS[b];[0:v]trim=22:32,setpts=PTS-STARTPTS[c];[0:v]trim=52:60,setpts=PTS-STARTPTS[d];[0:v]trim=78:84,setpts=PTS-STARTPTS[e];[0:v]trim=86:98,setpts=PTS-STARTPTS[f];[0:v]trim=118:128,setpts=PTS-STARTPTS[g];[a][b][c][d][e][f][g]concat=n=7:v=1[v]" -map "[v]" -an media/realrent4u-technical-60s.mp4
```

```text
[clears throat] Under the hood, realrent4u is a pipeline. [pause] Not a chatbot.
Claude reads eighty-seven public documents, once each, in the official rule schema. We keep a rule only if its quote appears word for word in the source. [pause] Eighty-five passed.
The Census geocoder places all five hundred sample addresses in their legal city, not their postal one.
Then a deterministic engine checks each rule against the building's facts and the date. [slowly] No model decides a result. A missing fact returns unknown.
Results are precomputed for four dates, so the app runs offline, with no key.
[excited] For New Jersey's FAIR Act, one hundred forty addresses change, and ninety are flagged where it meets a city ban.
[softly] Every run is logged and reproducible. [pause] And it is never legal advice.
```

Then mux: `ffmpeg -i media/realrent4u-technical-60s.mp4 -i technical-voice.mp3 -c:v copy -c:a aac -shortest media/realrent4u-technical-final.mp4`.
