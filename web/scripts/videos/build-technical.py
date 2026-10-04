# build-technical.py: edits the 1-minute technical walkthrough: the iPhone recording with magnified cards and an
# architecture headline per narration line, plus two beats from the landing's How it works sections in a browser
# frame. Narration: web/public/media/raw/technical-audio.mp3. Output: media/out/technical.mp4 + EN/ES subtitles.
import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("bp", HERE / "build-product.py")
bp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bp)

ROOT = bp.ROOT
SCENES = ROOT / "media" / "scenes"
AUDIO = bp.RAW / "technical-audio.mp3"
WORK = ROOT / "media" / "work" / "technical"
OUT = ROOT / "media" / "out" / "technical.mp4"
W, H, FPS = bp.W, bp.H, bp.FPS
TX = 90
NL = "\n"

# Phone beats (iPhone source range + zoom box) use build-product's layout; web beats ("scene") show a How it
# works section of the landing: the full screenshot, never cropped, plus a card magnifying one part. t = the narration line in the audio.
BEATS = [
    dict(t=(0.00, 6.92), scene="how_steps", card=(64, 1035, 784, 578), eyebrow="01 · ARCHITECTURE", title=f"A pipeline,{NL}not a chatbot.",
         sub=f"address → legal city → building facts{NL}→ as-of date → result, with its source"),
    dict(t=(6.92, 12.44), src=(123.9, 124.9), zoom=(40, 680, 1220, 440), eyebrow="02 · EXTRACTION",
         title=f"Claude reads 87{NL}public documents.", sub=f"claude-opus-5-5, one call per document,{NL}in the official rule schema."),
    dict(t=(12.44, 19.24), src=(26.0, 29.4), zoom=(40, 1700, 1220, 720), eyebrow="03 · QUOTE CHECK",
         title="85 rules kept.", sub=f"A rule stays only if its quote appears{NL}word for word in the source."),
    dict(t=(19.24, 26.16), src=(14.0, 20.92), eyebrow="04 · LEGAL CITY", title=f"Census geocoder,{NL}not postal city.",
         sub=f"485 of 500 addresses matched exactly;{NL}15 placed by postal fallback."),
    dict(t=(26.16, 31.54), src=(129.6, 132.4), zoom=(40, 540, 1220, 680), eyebrow="05 · RULES ENGINE",
         title=f"Deterministic.{NL}Rule × facts × date.", sub=f"Precedence and conflict flags are{NL}computed, not generated."),
    dict(t=(31.54, 37.52), scene="how_results", card=(555, 1027, 467, 310), eyebrow="06 · NO MODEL DECIDES",
         title=f"A missing fact{NL}returns unknown.", sub=f"Five results, always labelled.{NL}Never a guess."),
    dict(t=(37.52, 42.80), src=(81.5, 86.62), zoom=(40, 1580, 1220, 920), eyebrow="07 · STATIC BUILD",
         title=f"Four dates,{NL}precomputed.", sub=f"Static JSON: works offline,{NL}no API key, no server."),
    dict(t=(42.80, 49.80), src=(91.0, 98.0), zoom=(40, 680, 1220, 330), eyebrow="08 · CHANGE TESTS",
         title=f"FAIR Act: 140 change,{NL}90 flagged.", sub=f"T1–T5 recomputed and checked{NL}against changes.json."),
    dict(t=(49.80, 55.17), src=(132.0, 133.6), zoom=(40, 600, 1220, 1170), eyebrow="09 · AUDIT",
         title=f"Logged and{NL}reproducible.", sub=f"pipeline --check rebuilds identical files.{NL}Never legal advice."),
]

SUBS = [
    (0.00, 6.92, "Under the hood, realrent4u is a pipeline, not a chatbot.", "Por dentro, realrent4u es un pipeline, no un chatbot."),
    (6.92, 12.44, "Claude reads 87 public documents, once each, in the official rule schema.",
     "Claude lee 87 documentos públicos, una vez cada uno, con el esquema oficial de reglas."),
    (12.44, 17.28, "We keep a rule only if its quote appears word for word in the source.",
     "Conservamos una regla solo si su cita aparece palabra por palabra en la fuente."),
    (17.28, 19.24, "85 passed.", "Pasaron 85."),
    (19.24, 26.16, "The Census geocoder places all 500 sample addresses in their legal city, not their postal one.",
     "El geocodificador del Censo ubica las 500 direcciones en su ciudad legal, no en la postal."),
    (26.16, 31.54, "Then a deterministic engine checks each rule against the building's facts and the date.",
     "Luego un motor determinista revisa cada regla contra los datos del edificio y la fecha."),
    (31.54, 37.52, "No model decides a result. A missing fact returns unknown.",
     "Ningún modelo decide un resultado. Un dato faltante devuelve desconocido."),
    (37.52, 42.80, "Results are precomputed for four dates, so the app runs offline, with no key.",
     "Los resultados están precalculados para cuatro fechas: la app funciona sin conexión y sin clave."),
    (42.80, 49.80, "For New Jersey's FAIR Act, 140 addresses change, and 90 are flagged where it meets a city ban.",
     "Con la Ley FAIR de Nueva Jersey cambian 140 direcciones y 90 se marcan donde choca con una prohibición municipal."),
    (49.80, 55.17, "Every run is logged and reproducible. And it is never legal advice.",
     "Cada corrida queda registrada y es reproducible. Y nunca es asesoría legal."),
]


IMG_X, IMG_Y, IMG_W, IMG_H = 760, 90, 1080, 900  # the whole section screenshot fits here
CARD_X, CARD_Y, CARD_W, CARD_H = TX, 560, 620, 340


def frame(i, b):
    """Web beat: headline and a magnified card on the left, the full section screenshot on the right."""
    img = Image.new("RGB", (W, H), bp.NIGHT)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 64):
        d.line((x, 0, x, H), fill=(22, 30, 50))
    for y in range(0, H, 64):
        d.line((0, y, W, y), fill=(22, 30, 50))
    shot = Image.open(SCENES / f"{b['scene']}.png").convert("RGB")
    k = min(IMG_W / shot.width, IMG_H / shot.height)
    sw, sh = int(shot.width * k), int(shot.height * k)
    x0, y0 = IMG_X + (IMG_W - sw) // 2, IMG_Y + (IMG_H - sh) // 2
    d.rounded_rectangle((x0 - 10, y0 - 10, x0 + sw + 10, y0 + sh + 10), 18, fill=(5, 8, 16))
    img.paste(shot.resize((sw, sh), Image.LANCZOS), (x0, y0))
    cx, cy, cw, ch = b["card"]
    z = min(CARD_W / cw, CARD_H / ch)
    zw, zh = int(cw * z), int(ch * z)
    # Mark the magnified part on the screenshot, then draw the card.
    d.rectangle((x0 + cx * k - 4, y0 + cy * k - 4, x0 + (cx + cw) * k + 4, y0 + (cy + ch) * k + 4), outline=bp.GLOW, width=4)
    d.rounded_rectangle((CARD_X - 10, CARD_Y - 10, CARD_X + zw + 10, CARD_Y + zh + 10), 22, fill=(28, 38, 62),
                        outline=bp.GLOW, width=3)
    img.paste(shot.crop((cx, cy, cx + cw, cy + ch)).resize((zw, zh), Image.LANCZOS), (CARD_X, CARD_Y))
    d.ellipse((TX, 128, TX + 14, 142), fill=bp.GLOW)
    d.text((TX + 30, 120), b["eyebrow"], font=bp.font("segoeuib.ttf", 28), fill=bp.MOON2)
    d.multiline_text((TX, 170), b["title"], font=bp.font("segoeuib.ttf", 64), fill=bp.MOON, spacing=8)
    lines = b["title"].count(NL) + 1
    d.multiline_text((TX, 190 + lines * 80), b["sub"], font=bp.font("segoeui.ttf", 30), fill=bp.MOON2, spacing=8)
    for n in range(len(BEATS)):
        d.ellipse((TX + n * 30, H - 110, TX + n * 30 + 12, H - 98), fill=bp.GLOW if n <= i else (50, 60, 85))
    d.text((TX, H - 70), "realrent4u · how it is built · not legal advice", font=bp.font("segoeui.ttf", 24), fill=(110, 120, 140))
    return img


def web_beat(i, b):
    dur = b["t"][1] - b["t"][0]
    still = WORK / f"f{i:02d}.png"
    frame(i, b).save(still)
    out = WORK / f"b{i:02d}.mp4"
    n = int(dur * FPS)
    # A slow 2 % push-in keeps the still alive.
    vf = (f"zoompan=z='1+0.02*on/{n}':d={n}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
          "format=yuv420p")
    bp.run(["-i", str(still), "-vf", vf, "-t", f"{dur}", "-an", "-c:v", "libx264", "-crf", "18", str(out)])
    return out


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    bp.WORK, bp.BEATS = WORK, BEATS  # phone beats reuse build-product's layout, progress dots and zoom
    parts = [web_beat(i, b) if "scene" in b else bp.beat(i, b) for i, b in enumerate(BEATS)]
    lst = WORK / "list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'{NL}" for p in parts))
    en, es = bp.write_subs(SUBS, OUT.with_suffix(""))
    bp.run(["-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(AUDIO), "-i", str(en), "-i", str(es),
            "-map", "0:v", "-map", "1:a", "-map", "2", "-map", "3", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:s:1",
            "language=spa", "-disposition:s:0", "default", "-shortest", "-movflags", "+faststart", str(OUT)])
    print(OUT)


if __name__ == "__main__":
    main()
