# brand-and-score.py: final pass on the three submission videos: a realrent4u title card at the start and an end
# card (added as extra seconds when the video has room under 60 s, overlaid otherwise), and an ambient music bed
# that ducks under the voice. Subtitles are shifted to match. Inputs: media/out/<name>.mp4 + .srt, music in
# media/music/<name>.mp3. Output: media/out/final/<name>.mp4 (+ .srt/.vtt).
import importlib.util
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("bp", HERE / "build-product.py")
bp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bp)

ROOT = bp.ROOT
SRC = ROOT / "media" / "out"
MUSIC = ROOT / "media" / "music"
OUT = SRC / "final"
WORK = ROOT / "media" / "work" / "final"
W, H, FPS = bp.W, bp.H, bp.FPS
LIMIT = 60.0
INTRO, OUTRO = 1.8, 2.0
TAGLINE = "Rental housing law, by address and date"
# Per-video mix: music gain and final loudness target (LUFS). The team video sits lower.
MIX = {"team": (0.08, -21)}
DEFAULT_MIX = (0.11, -18)


def duration(p: Path) -> float:
    return float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True).stdout)


def card(kind: str, path: Path, alpha: int = 255):
    """Brand card: the § mark, realrent4u, and a tagline (intro) or the address and disclaimer (outro)."""
    img = Image.new("RGBA", (W, H), bp.NIGHT + (alpha,))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 64):
        d.line((x, 0, x, H), fill=(22, 30, 50, alpha))
    for y in range(0, H, 64):
        d.line((0, y, W, y), fill=(22, 30, 50, alpha))
    name_f = bp.font("segoeuib.ttf", 132)
    nw = d.textlength("realrent4u", font=name_f)
    mark = 120
    x0 = (W - (mark + 40 + nw)) / 2
    d.rounded_rectangle((x0, 420, x0 + mark, 420 + mark), 28, fill=bp.MOON)
    d.text((x0 + mark / 2, 420 + mark / 2), "§", font=bp.font("georgiai.ttf", 92), fill=bp.NIGHT, anchor="mm")
    d.text((x0 + mark + 40, 480), "realrent4u", font=name_f, fill=bp.MOON, anchor="lm")
    sub = TAGLINE if kind == "intro" else "realrent4u.vercel.app"
    sf = bp.font("georgiai.ttf", 50) if kind == "intro" else bp.font("segoeui.ttf", 46)
    d.text((W / 2, 640), sub, font=sf, fill=bp.GLOW, anchor="mm")
    if kind == "outro":
        d.text((W / 2, 720), "Public sources · dated answers · not legal advice", font=bp.font("segoeui.ttf", 34),
               fill=bp.MOON2, anchor="mm")
    img.save(path)


def shift_subs(name: str, offset: float):
    """Copies <name>.en/.es subtitles to final/, shifted by offset seconds; returns the shifted .srt paths."""
    def ts(t, sep):
        return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}".replace(".", sep)

    def sec(m):
        return int(m[0]) * 3600 + int(m[1]) * 60 + float(m[2].replace(",", "."))

    out = []
    for lang in ("en", "es"):
        text = (SRC / f"{name}.{lang}.srt").read_text(encoding="utf-8")
        cues = re.findall(r"(\d\d):(\d\d):(\d\d,\d\d\d) --> (\d\d):(\d\d):(\d\d,\d\d\d)\n(.+?)\n\n", text, re.S)
        nl = "\n"
        srt = "".join(f"{n}{nl}{ts(sec(c[0:3]) + offset, ',')} --> {ts(sec(c[3:6]) + offset, ',')}{nl}{c[6]}{nl}{nl}"
                      for n, c in enumerate(cues, 1))
        vtt = "WEBVTT" + nl + nl + "".join(
            f"{ts(sec(c[0:3]) + offset, '.')} --> {ts(sec(c[3:6]) + offset, '.')}{nl}{c[6]}{nl}{nl}" for c in cues)
        p = OUT / f"{name}.{lang}.srt"
        p.write_text(srt, encoding="utf-8")
        (OUT / f"{name}.{lang}.vtt").write_text(vtt, encoding="utf-8")
        out.append(p)
    return out


def finish(name: str):
    src = SRC / f"{name}.mp4"
    base = duration(src)
    pad = base + INTRO + OUTRO <= LIMIT  # room for real intro/outro seconds, else overlay them
    intro, outro = WORK / f"{name}-intro.png", WORK / f"{name}-outro.png"
    card("intro", intro)
    card("outro", outro)
    total = base + (INTRO + OUTRO if pad else 0)
    lead = INTRO if pad else 0.0
    en, es = shift_subs(name, lead)
    music = MUSIC / f"{name}.mp3"
    ins = ["-i", str(src), "-loop", "1", "-t", f"{total}", "-i", str(intro), "-loop", "1", "-t", f"{total}", "-i", str(outro),
           "-stream_loop", "-1", "-i", str(music), "-i", str(en), "-i", str(es)]
    if pad:
        # [intro card][video][outro card]; the voice starts after the intro.
        v = (f"[1:v]trim=0:{INTRO},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p,fade=t=out:st={INTRO - 0.3}:d=0.3[i];"
             f"[0:v]fps={FPS},format=yuv420p,setsar=1[m];"
             f"[2:v]trim=0:{OUTRO},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p,fade=t=in:d=0.3[o];"
             f"[i][m][o]concat=n=3:v=1:a=0[v];"
             f"[0:a]adelay={int(INTRO * 1000)}:all=1,apad,atrim=0:{total}[voice]")
    else:
        # Same length: the cards fade in over the first and last seconds.
        v = (f"[1:v]format=rgba,fade=t=out:st=1.6:d=0.5:alpha=1[i];[2:v]format=rgba,fade=t=in:st={total - 2.6}:d=0.5:alpha=1[o];"
             f"[0:v][i]overlay=0:0:enable='lte(t,2.1)'[a];[a][o]overlay=0:0:enable='gte(t,{total - 2.6})',format=yuv420p[v];"
             f"[0:a]apad,atrim=0:{total}[voice]")
    gain, lufs = MIX.get(name, DEFAULT_MIX)
    a = (f";[3:a]atrim=0:{total},asetpts=PTS-STARTPTS,volume={gain},afade=t=in:d=1.2,afade=t=out:st={total - 1.8}:d=1.8[bed];"
         "[voice]asplit[v1][v2];[bed][v2]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=500[duck];"
         f"[v1][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I={lufs}:TP=-2:LRA=11[aout]")
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{name}.mp4"
    bp.run([*ins, "-filter_complex", v + a, "-map", "[v]", "-map", "[aout]", "-map", "4", "-map", "5", "-t", f"{total}",
            "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:s:1", "language=spa",
            "-disposition:s:0", "default", "-movflags", "+faststart", str(out)])
    print(f"{out.name}: {duration(out):.2f} s ({'intro+outro added' if pad else 'cards overlaid'})")


if __name__ == "__main__":
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    import sys

    for n in sys.argv[1:] or ("product", "technical", "team"):
        finish(n)
