# build-product.py: edits the 1-minute product demo: the iPhone recording (media/realrental4u-technical.mp4)
# on the left with a headline panel synced to each narration line, and the three people clips full screen with
# their generated text blurred. Narration: web/public/media/raw/product-audio.mp3. Output: media/out/product.mp4.
import importlib.util
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
RAW = ROOT / "web" / "public" / "media" / "raw"
PHONE = ROOT / "media" / "realrental4u-technical.mp4"
AUDIO = RAW / "product-audio.mp3"
WORK = ROOT / "media" / "work" / "product"
OUT = ROOT / "media" / "out" / "product.mp4"
W, H, FPS = 1920, 1080, 30
NIGHT, MOON, MOON2, GLOW = (15, 22, 38), (245, 244, 239), (185, 193, 211), (242, 182, 92)
F = "C:/Windows/Fonts/"
PHONE_W, PHONE_H, PHONE_X, PHONE_Y = 470, 1018, 210, 31
TEXT_X = 860

# Generated-text boxes of the raw clips, shared with the landing clips.
_spec = importlib.util.spec_from_file_location("lc", HERE.parent / "landing-clips.py")
lc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lc)
BOXES = {"how-it-work.mp4": lc.TEXT_BOXES["how-it-works"], "five-results.mp4": lc.TEXT_BOXES["five-results"],
         "change-over-time.mp4": lc.TEXT_BOXES["change-over-time"]}

# Each beat fills one narration line (start, end in the audio). kind "phone": source range on the iPhone video;
# kind "clip": source range on a raw people clip. Text: eyebrow, title, subtitle (phone) or caption (clip).
BEATS = [
    dict(t=(0.00, 6.48), clip="how-it-work.mp4", src=(0.0, 5.04), title="Mail: South Boston.", accent="Law: Boston."),
    dict(t=(6.48, 14.56), src=(2.0, 10.08), eyebrow="01 · THE QUESTION", zoom=(30, 460, 1230, 650), title="Which rules apply\nhere, on this date?",
         sub="500 sample addresses · 85 rules\n9 jurisdictions · 4 dates"),
    dict(t=(14.56, 19.84), src=(76.0, 81.28), eyebrow="02 · LEGAL CITY", zoom=(40, 520, 900, 360), title="Legal city,\nnot postal city.",
         sub="Every address is placed with the\nU.S. Census geocoder."),
    dict(t=(19.84, 27.64), src=(57.0, 62.4), eyebrow="03 · PRECEDENCE", zoom=(60, 400, 1200, 720), title="City rule applies.\nState cap steps aside.",
         sub="San Francisco, built 1926: the rent\nordinance displaces Civil Code 1947.12."),
    dict(t=(27.64, 32.50), src=(26.0, 30.86), eyebrow="04 · EVIDENCE", zoom=(40, 1700, 1220, 720), title="The exact quote,\nwith its source.",
         sub="Citation, source link and the date\nwe read it, on every answer."),
    dict(t=(32.50, 37.50), src=(46.5, 51.5), eyebrow="05 · MISSING FACTS", zoom=(40, 760, 1220, 880), title="No year built?\nUnknown.",
         sub="A missing fact is never filled in."),
    dict(t=(37.50, 40.76), clip="five-results.mp4", src=(2.3, 5.04), title="We never", accent="guess."),
    dict(t=(40.76, 45.88), src=(81.5, 86.62), eyebrow="06 · TIME", zoom=(40, 1800, 1220, 700), title="Move the date\nto July 2027.",
         sub="New Jersey's FAIR Act takes effect\non July 1, 2027."),
    dict(t=(45.88, 50.14), src=(91.0, 95.26), eyebrow="07 · HUMAN REVIEW", zoom=(40, 680, 1220, 330), title="140 addresses change.\n90 flagged.",
         sub="Where the FAIR Act may clash with a\ncity ban, a person reviews it."),
    dict(t=(50.14, 55.18), clip="change-over-time.mp4", src=(0.0, 5.04), title="Hoboken, Jersey City: covered.",
         accent="Newark: not."),
    dict(t=(55.18, 59.10), src=(122.0, 125.92), eyebrow="08 · LIMITS", zoom=(40, 680, 1220, 440), title="English or Spanish.\nNever legal advice.",
         sub="Informational, from public sources,\nwith the as-of date on every screen."),
]


# Narration cues (Whisper timings on product-audio.mp3), English and Spanish, for the subtitle tracks.
SUBS = [
    (0.00, 6.48, "Your mail says South Boston. The law says Boston.", "Tu correo dice South Boston. La ley dice Boston."),
    (6.48, 11.40, "realrent4u answers one question for any sample address:", "realrent4u responde una pregunta para cualquier dirección de muestra:"),
    (11.40, 14.56, "which rental rules apply here, on this date?", "¿qué reglas de alquiler aplican aquí, en esta fecha?"),
    (14.56, 19.84, "We place the building in its legal city, then check every rule against its facts.",
     "Ubicamos el edificio en su ciudad legal y revisamos cada regla contra sus datos."),
    (19.84, 24.98, "In San Francisco, this 1926 building falls under the city's rent ordinance,",
     "En San Francisco, este edificio de 1926 queda bajo la ordenanza de alquiler de la ciudad,"),
    (24.98, 27.64, "so the statewide cap steps aside.", "así que el tope estatal se hace a un lado."),
    (27.64, 32.50, "Every answer shows the exact quote, its source, and the date we read it.",
     "Cada respuesta muestra la cita exacta, su fuente y la fecha en que la leímos."),
    (32.50, 35.78, "In Berkeley, the record has no year built,", "En Berkeley, el registro no tiene año de construcción,"),
    (35.78, 40.76, "so the answer is unknown. We never guess.", "así que la respuesta es desconocido. Nunca suponemos."),
    (40.76, 45.88, "Move the date to July 2027, and New Jersey's FAIR Act takes effect.",
     "Mueve la fecha a julio de 2027 y entra en vigor la Ley FAIR de Nueva Jersey."),
    (45.88, 50.14, "Where it may clash with Hoboken's own ban, we flag it for a human.",
     "Donde puede chocar con la prohibición propia de Hoboken, lo marcamos para revisión humana."),
    (50.14, 55.18, "Hoboken and Jersey City are covered. Newark, next door, is not.",
     "Hoboken y Jersey City quedan cubiertas. Newark, al lado, no."),
    (55.18, 59.10, "In English or Spanish. Never legal advice.", "En inglés o español. Nunca asesoría legal."),
]


def write_subs(subs, stem: Path):
    """Writes <stem>.en/.es .srt and .vtt next to the video; returns the two .srt paths."""
    def ts(t, sep):
        h, m = int(t // 3600), int(t % 3600 // 60)
        return f"{h:02d}:{m:02d}:{t % 60:06.3f}".replace(".", sep)
    out = []
    for k, lang in ((3, "en"), (4, "es")):
        nl = "\n"
        srt = "".join(f"{n}{nl}{ts(c[0], ',')} --> {ts(c[1], ',')}{nl}{c[k - 1]}{nl}{nl}" for n, c in enumerate(subs, 1))
        vtt = "WEBVTT" + nl + nl + "".join(f"{ts(c[0], '.')} --> {ts(c[1], '.')}{nl}{c[k - 1]}{nl}{nl}" for c in subs)
        p = stem.with_name(f"{stem.name}.{lang}.srt")
        p.write_text(srt, encoding="utf-8")
        stem.with_name(f"{stem.name}.{lang}.vtt").write_text(vtt, encoding="utf-8")
        out.append(p)
    return out


ZOOM_Y, ZOOM_MAX_W, ZOOM_MAX_H = 560, 960, 340


def zoom_size(box):
    """Size of the magnified card for a source box: fits 960×340, even numbers for the encoder."""
    k = min(ZOOM_MAX_W / box[2], ZOOM_MAX_H / box[3])
    return int(box[2] * k) // 2 * 2, int(box[3] * k) // 2 * 2


def font(name, size):
    return ImageFont.truetype(F + name, size)


def phone_frame(b, i):
    """Background for a phone beat: night canvas, phone bezel slot, eyebrow, title and subtitle."""
    img = Image.new("RGB", (W, H), NIGHT)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 64):
        d.line((x, 0, x, H), fill=(22, 30, 50))
    for y in range(0, H, 64):
        d.line((0, y, W, y), fill=(22, 30, 50))
    d.rounded_rectangle((PHONE_X - 14, PHONE_Y - 14, PHONE_X + PHONE_W + 14, PHONE_Y + PHONE_H + 14), 58, fill=(5, 8, 16))
    d.ellipse((TEXT_X, 128, TEXT_X + 14, 142), fill=GLOW)
    d.text((TEXT_X + 30, 120), b["eyebrow"], font=font("segoeuib.ttf", 30), fill=MOON2)
    d.multiline_text((TEXT_X, 170), b["title"], font=font("segoeuib.ttf", 76), fill=MOON, spacing=10)
    lines = b["title"].count("\n") + 1
    d.multiline_text((TEXT_X, 190 + lines * 94), b["sub"], font=font("segoeui.ttf", 34), fill=MOON2, spacing=10)
    if "zoom" in b:
        zw, zh = zoom_size(b["zoom"])
        d.rounded_rectangle((TEXT_X - 10, ZOOM_Y - 10, TEXT_X + zw + 10, ZOOM_Y + zh + 10), 22, fill=(28, 38, 62),
                            outline=GLOW, width=3)
    d.text((TEXT_X, H - 90), "realrent4u · sample data · not legal advice", font=font("segoeui.ttf", 26), fill=(110, 120, 140))
    # Progress: one dot per phone beat.
    phones = [k for k, x in enumerate(BEATS) if "clip" not in x]
    for n, k in enumerate(phones):
        cx = TEXT_X + n * 34
        d.ellipse((cx, H - 150, cx + 14, H - 136), fill=GLOW if k <= i else (50, 60, 85))
    return img


def caption(b):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ft, fa = font("segoeuib.ttf", 72), font("georgiai.ttf", 72)
    tw = d.textlength(b["title"] + " ", font=ft)
    aw = d.textlength(b.get("accent", ""), font=fa)
    x0, y0 = 96, H - 250
    d.rounded_rectangle((x0, y0, x0 + tw + aw + 120, y0 + 150), 28, fill=NIGHT + (225,))
    d.rectangle((x0, y0 + 35, x0 + 8, y0 + 115), fill=GLOW)
    d.text((x0 + 60, y0 + 32), b["title"], font=ft, fill=MOON)
    d.text((x0 + 60 + tw, y0 + 32), b.get("accent", ""), font=fa, fill=GLOW)
    return img


def run(args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def beat(i, b):
    dur = b["t"][1] - b["t"][0]
    a, z = b["src"]
    speed = (z - a) / dur  # < 1 slows the source down to fill the line
    out = WORK / f"b{i:02d}.mp4"
    if "clip" in b:
        cap = WORK / f"c{i:02d}.png"
        caption(b).save(cap)
        parts, last = [f"[0:v]trim={a}:{z},setpts=(PTS-STARTPTS)/{speed},scale={W}:{H},fps={FPS}[b0]"], "b0"
        for k, (t0, t1, x, y, w, h) in enumerate(BOXES[b["clip"]]):
            l0, l1 = (t0 - a) / speed, (t1 - a) / speed
            if l1 < 0 or l0 > dur:
                continue
            parts.append(f"[{last}]split[s{k}][k{k}];[k{k}]crop={w}:{h}:{x}:{y},boxblur=22:3[z{k}];"
                         f"[s{k}][z{k}]overlay={x}:{y}:enable='between(t,{max(0, l0):.2f},{l1:.2f})'[b{k + 1}]")
            last = f"b{k + 1}"
        fc = ";".join(parts) + f";[1:v]format=rgba,fade=t=in:st=0.15:d=0.3:alpha=1[c];[{last}][c]overlay=0:0,format=yuv420p[v]"
        run(["-i", str(RAW / b["clip"]), "-loop", "1", "-t", f"{dur}", "-i", str(cap), "-filter_complex", fc,
             "-map", "[v]", "-t", f"{dur}", "-an", "-c:v", "libx264", "-crf", "20", str(out)])
    else:
        bg = WORK / f"p{i:02d}.png"
        phone_frame(b, i).save(bg)
        k = PHONE_W / 1290
        zoom = b.get("zoom")
        mark = (f",drawbox=x={int(zoom[0] * k)}:y={int(zoom[1] * k)}:w={int(zoom[2] * k)}:h={int(zoom[3] * k)}:"
                "color=0xF2B65C@0.95:t=4") if zoom else ""
        fc = (f"[1:v]trim={a}:{z},setpts=(PTS-STARTPTS)/{speed},fps={FPS},split[src][zsrc];"
              f"[src]scale={PHONE_W}:{PHONE_H}{mark},format=rgba,"
              f"geq=lum='p(X,Y)':a='if(gt(abs(X-{PHONE_W}/2)*2-({PHONE_W}-110),0)*gt(abs(Y-{PHONE_H}/2)*2-({PHONE_H}-110),0),"
              f"if(lte(hypot(abs(X-{PHONE_W}/2)*2-({PHONE_W}-110),abs(Y-{PHONE_H}/2)*2-({PHONE_H}-110)),110),255,0),255)':"
              f"cb='cb(X,Y)':cr='cr(X,Y)'[ph];[0:v][ph]overlay={PHONE_X}:{PHONE_Y}[base]")
        if zoom:
            zw, zh = zoom_size(zoom)
            fc += (f";[zsrc]crop={zoom[2]}:{zoom[3]}:{zoom[0]}:{zoom[1]},scale={zw}:{zh}:flags=lanczos[zm];"
                   f"[base][zm]overlay={TEXT_X}:{ZOOM_Y},format=yuv420p[v]")
        else:
            fc += ";[zsrc]nullsink;[base]format=yuv420p[v]"
        run(["-loop", "1", "-t", f"{dur}", "-i", str(bg), "-i", str(PHONE), "-filter_complex", fc, "-map", "[v]",
             "-t", f"{dur}", "-r", str(FPS), "-an", "-c:v", "libx264", "-crf", "20", str(out)])
    return out


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    parts = [beat(i, b) for i, b in enumerate(BEATS)]
    lst = WORK / "list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts))
    en, es = write_subs(SUBS, OUT.with_suffix(""))
    # Soft subtitle tracks (EN default, ES), plus the .srt/.vtt files beside the video.
    run(["-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(AUDIO), "-i", str(en), "-i", str(es),
         "-map", "0:v", "-map", "1:a", "-map", "2", "-map", "3", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:s:1",
         "language=spa", "-disposition:s:0", "default", "-shortest", "-movflags", "+faststart", str(OUT)])
    print(OUT)


if __name__ == "__main__":
    main()
