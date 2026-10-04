# landing-clips.py: turns the raw ElevenLabs clips (web/public/media/raw/*.mp4, people footage with unreadable
# AI-drawn text) into the three landing clips: only the boxes where the model drew text are blurred (people stay
# sharp), and exact titles are drawn on top in two timed beats. Needs ffmpeg on PATH and Pillow. Run: python landing-clips.py
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

MEDIA = Path(__file__).resolve().parent.parent / "public" / "media"
RAW = MEDIA / "raw"
W, H = 1920, 1080
FONTS = Path("C:/Windows/Fonts")
SANS_B = str(FONTS / "segoeuib.ttf")
SANS = str(FONTS / "segoeui.ttf")
SERIF_I = str(FONTS / "georgiai.ttf")
NIGHT = (15, 22, 38)
MOON = (245, 244, 239)
GLOW = (242, 182, 92)

# id -> (raw file, [(title, accent word, subtitle), (…)]): beat 1 at 0–2.5 s, beat 2 at 2.5 s to the end.
CLIPS = {
    "how-it-works": ("how-it-work.mp4", [
        ("Three facts", "decide.", "Legal city  ·  Building  ·  Date"),
        ("South Boston → Boston, MA.", "", "A missing fact stays unknown. Never a guess."),
    ]),
    "five-results": ("five-results.mp4", [
        ("Five results,", "always labelled.", "Applies · Unknown · Superseded · Not yet effective · Pending"),
        ("City rule applies.", "State cap steps aside.", "Not yet effective: starts July 2027  ·  Pending: a bill, not a law"),
    ]),
    "change-over-time": ("change-over-time.mp4", [
        ("Five scenarios", "across time.", "T1–T5 checked on four dates"),
        ("Local bans stop at", "the city line.", "250 addresses change  ·  90 flagged for a human"),
    ]),
}


# id -> boxes of generated (unreadable) text, measured on 0.5 s contact sheets: (from s, to s, x, y, w, h) in px.
TEXT_BOXES = {
    "how-it-works": [(0, 1.1, 480, 180, 900, 560), (1.2, 2.6, 520, 340, 720, 560), (2.7, 3.35, 880, 320, 300, 500),
                     (3.3, 5.1, 1060, 120, 580, 440)],
    "five-results": [(0.4, 1.2, 160, 240, 760, 480), (1.0, 2.6, 140, 200, 820, 540), (2.4, 3.35, 320, 500, 880, 240)],
    "change-over-time": [(0, 1.1, 360, 120, 500, 220), (2.3, 3.55, 20, 800, 1880, 220), (4.2, 5.1, 1140, 400, 440, 200)],
}


def card(title: str, accent: str, sub: str) -> Image.Image:
    """Transparent 1920×1080 overlay: a navy lower-third card with the title, a serif-italic accent and a subtitle."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ft, fa, fs = ImageFont.truetype(SANS_B, 72), ImageFont.truetype(SERIF_I, 72), ImageFont.truetype(SANS, 36)
    tw = d.textlength(title + (" " if accent else ""), font=ft)
    aw = d.textlength(accent, font=fa) if accent else 0
    sw = d.textlength(sub, font=fs)
    bw = int(max(tw + aw, sw)) + 120
    x0, y0 = 96, H - 330
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + 230), 28, fill=NIGHT + (225,))
    d.rectangle((x0, y0 + 40, x0 + 8, y0 + 190), fill=GLOW + (255,))
    d.text((x0 + 60, y0 + 34), title, font=ft, fill=MOON)
    if accent:
        d.text((x0 + 60 + tw, y0 + 34), accent, font=fa, fill=GLOW)
    d.text((x0 + 60, y0 + 140), sub, font=fs, fill=(185, 193, 211))
    return img


def build(cid: str, raw: str, beats) -> None:
    tmp = []
    for i, b in enumerate(beats):
        p = MEDIA / f".{cid}-{i}.png"
        card(*b).save(p)
        tmp.append(p)
    out = MEDIA / f"{cid}.mp4"
    # Blur hides every generated glyph; a slight darken keeps the cards readable. Each card fades in and out.
    # Blur each box of generated text only while it is on screen; then each card fades in and out.
    parts, last = ["[0:v]scale=1920:1080[b0]"], "b0"
    for i, (t0, t1, x, y, w, h) in enumerate(TEXT_BOXES.get(cid, [])):
        parts.append(f"[{last}]split[s{i}][k{i}];[k{i}]crop={w}:{h}:{x}:{y},boxblur=22:3[z{i}];"
                     f"[s{i}][z{i}]overlay={x}:{y}:enable='between(t,{t0},{t1})'[b{i + 1}]")
        last = f"b{i + 1}"
    fc = ";".join(parts) + (
        ";[1:v]format=rgba,fade=t=in:st=0.1:d=0.35:alpha=1,fade=t=out:st=2.25:d=0.3:alpha=1[c1];"
        "[2:v]format=rgba,fade=t=in:st=2.55:d=0.35:alpha=1,fade=t=out:st=4.65:d=0.35:alpha=1[c2];"
        f"[{last}][c1]overlay=0:0:enable='between(t,0,2.6)'[v1];[v1][c2]overlay=0:0:enable='gte(t,2.5)',format=yuv420p[v]"
    )
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", str(RAW / raw),
        "-loop", "1", "-t", "5.05", "-i", str(tmp[0]), "-loop", "1", "-t", "5.05", "-i", str(tmp[1]),
        "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "23", "-preset", "slow",
        "-movflags", "+faststart", "-t", "5.04", str(out),
    ], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", str(out), "-frames:v", "1", "-q:v", "4",
                    str(MEDIA / f"{cid}.jpg")], check=True)
    for p in tmp:
        p.unlink()
    print(f"{out.name}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for cid, (raw, beats) in CLIPS.items():
        build(cid, raw, beats)
