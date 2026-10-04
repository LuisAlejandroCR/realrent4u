<!--
web/scripts/videos/README.md: cómo se montan los 2 videos de entrega (product demo y technical walkthrough).
Se distingue de docs/RECORDING.md (guiones y narración) y de docs/LANDING_CLIPS.md (clips de la landing).
-->

# Submission videos

Inputs stay local (gitignored): `media/realrental4u-technical.mp4` (iPhone recording) and
`web/public/media/raw/` (people clips, `product-audio.mp3`, `technical-audio.mp3`). Needs ffmpeg and Pillow.

1. `node scripts/videos/record-scenes.mjs` and `node scripts/videos/capture-stills.mjs` (from `web/`): live-site
   scenes and full How it works screenshots into `media/scenes/`.
2. `python web/scripts/videos/build-product.py` → `media/out/product.mp4` (59 s): iPhone beats with a headline
   and a zoom card per narration line, plus the three people clips with their generated text blurred.
3. `python web/scripts/videos/build-technical.py` → `media/out/technical.mp4` (55 s): same phone layout plus two
   full How it works screenshots with a magnified card.

4. `python web/scripts/videos/build-team.py` → `media/out/team.mp4` (≤ 60 s) from `media/out/team-video.mov`:
   long pauses cut, speaker left, cards right, the app beside him while the project is described.

5. `python web/scripts/videos/brand-and-score.py` → `media/out/final/`: realrent4u card at the start and end (extra
   seconds when there is room under 60 s, overlaid otherwise) and an ElevenLabs Music bed from `media/music/<name>.mp3`
   that ducks under the voice; loudness normalised to −18 LUFS.

All three carry soft EN/ES subtitle tracks; `.srt` and `.vtt` files are written next to each video.
