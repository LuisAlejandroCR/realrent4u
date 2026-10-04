# build-team.py: edits the team video (media/out/team-video.mov, portrait selfie) to ≤ 60 s: long pauses are cut
# (the voice is untouched), the speaker sits on the left of a 16:9 night canvas and cards on the right follow
# what is said; while the project is described, the iPhone recording of the app plays beside him. EN/ES subtitles.
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
SRC = ROOT / "media" / "out" / "team-video.mov"
WORK = ROOT / "media" / "work" / "team"
OUT = ROOT / "media" / "out" / "team.mp4"
W, H, FPS = bp.W, bp.H, bp.FPS
END = 72.45  # after "Let's keep building the future."
PAD, MIN_GAP = 0.14, 0.45  # keep 0.14 s around speech; only pauses longer than 0.45 s are cut
PX, PW = 110, 608  # speaker: portrait 608×1080 on the left
RX, RW = 820, 1000  # right panel

# Cards on the right, by source time (start, end): eyebrow, title, subtitle.
CARDS = [
    ((0.0, 8.4), "TEAM · REALRENT4U", "Luis Cárdenas", "Electrical engineer · Colombia"),
    ((8.4, 13.1), "WHY COMPETITIONS", "They teach what\nprojects don't.", ""),
    ((13.1, 16.8), "WHY COMPETITIONS", "Prioritize", "when the time runs out"),
    ((16.8, 19.4), "WHY COMPETITIONS", "Work as a team", ""),
    ((19.4, 24.3), "WHY COMPETITIONS", "Keep going", "when teammates can't continue"),
    ((43.9, 48.8), "THIS YEAR", "3 hackathons won", ""),
    ((48.8, 52.2), "MY BEST AWARD", "Discipline", ""),
    ((52.2, 61.8), "EVERY WEEK", "Train. Take care of\nmyself and the\npeople I love.", ""),
    ((61.8, 70.3), "WHAT I BRING", "Focus.\nPersistence.\nFinishing what\nwe start.", ""),
    ((70.3, END), "REALRENT4U", "Let's keep building\nthe future.", "realrent4u.vercel.app"),
]
# App B-roll while the project is described: (source start, end) on the speaker timeline, iPhone ranges, caption.
BROLL = ((24.3, 43.9), [(2.0, 6.9), (14.5, 19.4), (26.0, 30.9), (91.0, 95.9)])
BROLL_TITLE = "realrent4u"
BROLL_SUB = "Which housing rules apply\nto an address, on a given\ndate, with the source\nbehind every answer."

SUBS_SRC = [  # (source start, end, EN, ES): what was meant, lightly cleaned up from the recording
    (1.1, 6.7, "Oh, hello there! This is Luis Cárdenas, an electrical engineer from Colombia.",
     "¡Hola! Soy Luis Cárdenas, ingeniero electricista de Colombia."),
    (8.4, 12.4, "I love competitions because they teach me what most projects don't:",
     "Me encantan las competencias porque me enseñan lo que la mayoría de proyectos no:"),
    (13.1, 18.7, "how to prioritize when the time runs out, how to work as a team,",
     "a priorizar cuando se acaba el tiempo, a trabajar en equipo"),
    (19.4, 23.7, "and how to keep going when teammates can't continue.", "y a seguir cuando los compañeros no pueden continuar."),
    (24.3, 29.4, "That's how realrent4u was built this weekend:", "Así se construyó realrent4u este fin de semana:"),
    (30.0, 37.2, "a tool that tells renters and landlords which housing rules apply to an address,",
     "una herramienta que les dice a inquilinos y propietarios qué reglas de vivienda aplican a una dirección,"),
    (37.7, 43.3, "on a given date, with its source behind every answer.", "en una fecha dada, con la fuente detrás de cada respuesta."),
    (44.0, 48.3, "This year I've won three hackathons, and I'm really proud of that.",
     "Este año gané tres hackatones y estoy muy orgulloso de eso."),
    (48.8, 51.8, "But my best award is discipline.", "Pero mi mejor premio es la disciplina."),
    (52.2, 60.8, "I train every week, I take care of myself, and I take care of the people I love.",
     "Entreno cada semana, me cuido y cuido a las personas que quiero."),
    (62.0, 68.9, "That's what I bring to every team: focus, persistence and finishing what we start.",
     "Eso es lo que aporto a cada equipo: enfoque, persistencia y terminar lo que empezamos."),
    (70.4, 72.3, "Let's keep building the future!", "¡Sigamos construyendo el futuro!"),
]


def speech_intervals():
    """Non-silent ranges of the recording, padded, with short pauses kept and long ones cut."""
    log = subprocess.run(["ffmpeg", "-i", str(SRC), "-af", "silencedetect=n=-32dB:d=0.3", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    keep, t = [], 0.0
    for s, e in zip(starts, ends):
        if e - s >= MIN_GAP and s > t:
            keep.append((max(0, t - PAD) if t else 0.9, s + PAD))
        if e - s >= MIN_GAP:
            t = e
    if t < END:
        keep.append((t - PAD, END))
    merged = []
    for a, b in keep:
        a, b = max(a, 0.9), min(b, END)
        if b <= a:
            continue
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(b, merged[-1][1]))
        else:
            merged.append((a, b))
    return merged


def mapper(keep):
    """Source time → edited time (times inside a cut pause snap to the next kept range)."""
    def f(t):
        out = 0.0
        for a, b in keep:
            if t <= a:
                return out
            if t <= b:
                return out + t - a
            out += b - a
        return out
    return f


def card_png(eyebrow, title, sub, path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((RX, 300, RX + 14, 314), fill=bp.GLOW)
    d.text((RX + 30, 292), eyebrow, font=bp.font("segoeuib.ttf", 30), fill=bp.MOON2)
    d.multiline_text((RX, 350), title, font=bp.font("segoeuib.ttf", 92), fill=bp.MOON, spacing=12)
    if sub:
        lines = title.count("\n") + 1
        d.multiline_text((RX, 380 + lines * 114), sub, font=bp.font("segoeui.ttf", 40), fill=bp.MOON2, spacing=10)
    img.save(path)


def background(path):
    img = Image.new("RGB", (W, H), bp.NIGHT)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 64):
        d.line((x, 0, x, H), fill=(22, 30, 50))
    for y in range(0, H, 64):
        d.line((0, y, W, y), fill=(22, 30, 50))
    d.text((RX, H - 90), "realrent4u · team · not legal advice", font=bp.font("segoeui.ttf", 26), fill=(110, 120, 140))
    img.save(path)


def broll_png(path):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((RX, 140, RX + 14, 154), fill=bp.GLOW)
    d.text((RX + 30, 132), "WHAT I BUILT THIS WEEKEND", font=bp.font("segoeuib.ttf", 30), fill=bp.MOON2)
    d.text((RX, 180), BROLL_TITLE, font=bp.font("segoeuib.ttf", 84), fill=bp.MOON)
    d.multiline_text((RX, 300), BROLL_SUB, font=bp.font("segoeui.ttf", 34), fill=bp.MOON2, spacing=8)
    d.rounded_rectangle((1460 - 12, 120 - 12, 1460 + 360 + 12, 120 + 780 + 12), 48, fill=(5, 8, 16))
    img.save(path)


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    keep = speech_intervals()
    m = mapper(keep)
    total = sum(b - a for a, b in keep)
    print(f"kept {len(keep)} ranges, {total:.1f} s")
    # 1. Cut the long pauses: one trimmed range per kept interval, joined without re-timing the voice.
    vparts = "".join(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS,scale=1080:1920,fps={FPS}[v{i}];"
                     f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,"
                     f"afade=t=out:st={b - a - 0.04:.3f}:d=0.04[a{i}];" for i, (a, b) in enumerate(keep))
    cat = "".join(f"[v{i}][a{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=1:a=1[v][a]"
    cut = WORK / "cut.mp4"
    bp.run(["-i", str(SRC), "-filter_complex", vparts + cat, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k", str(cut)])
    # 2. App B-roll track: the iPhone ranges back to back, sized to the narration window.
    (b0, b1), ranges = BROLL
    win = m(b1) - m(b0)
    each = win / len(ranges)
    bparts = "".join(f"[0:v]trim={a}:{z},setpts=(PTS-STARTPTS)/{(z - a) / each:.4f},fps={FPS},scale=360:780[p{i}];"
                     for i, (a, z) in enumerate(ranges))
    broll = WORK / "broll.mp4"
    bp.run(["-i", str(bp.PHONE), "-filter_complex", bparts + "".join(f"[p{i}]" for i in range(len(ranges)))
            + f"concat=n={len(ranges)}:v=1[v]", "-map", "[v]", "-c:v", "libx264", "-crf", "18", str(broll)])
    # 3. Compose: background, speaker, cards and B-roll, each enabled on the edited timeline.
    bg = WORK / "bg.png"
    background(bg)
    inputs = ["-loop", "1", "-t", f"{total}", "-i", str(bg), "-i", str(cut), "-itsoffset", f"{m(b0):.3f}", "-i", str(broll)]
    bpng = WORK / "broll.png"
    broll_png(bpng)
    inputs += ["-loop", "1", "-t", f"{total}", "-i", str(bpng)]
    # Phone bezel and caption first, then the app recording on top of the bezel.
    fc = (f"[1:v]scale={PW}:{H}[sp];[0:v][sp]overlay={PX}:0[c0];"
          f"[c0][3:v]overlay=0:0:enable='between(t,{m(b0):.2f},{m(b1):.2f})'[c1];"
          f"[2:v]format=rgba[br];[c1][br]overlay=1460:120:enable='between(t,{m(b0):.2f},{m(b1):.2f})'[c3]")
    last, n = "c3", 4
    for k, ((s, e), eyebrow, title, sub) in enumerate(CARDS):
        p = WORK / f"card{k:02d}.png"
        card_png(eyebrow, title, sub, p)
        inputs += ["-loop", "1", "-t", f"{total}", "-i", str(p)]
        fc += (f";[{n}:v]format=rgba,fade=t=in:st={m(s):.2f}:d=0.25:alpha=1[k{n}];"
               f"[{last}][k{n}]overlay=0:0:enable='between(t,{m(s):.2f},{m(e):.2f})'[c{n}]")
        last, n = f"c{n}", n + 1
    fc += f";[{last}]format=yuv420p[v]"
    subs = [(m(s), m(e), en, es) for s, e, en, es in SUBS_SRC]
    en, es = bp.write_subs(subs, OUT.with_suffix(""))
    inputs += ["-i", str(en), "-i", str(es)]
    bp.run([*inputs, "-filter_complex", fc, "-map", "[v]", "-map", "1:a", "-map", f"{n}", "-map", f"{n + 1}",
            "-t", f"{total}", "-r", str(FPS), "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac",
            "-b:a", "192k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:s:1", "language=spa",
            "-disposition:s:0", "default", "-movflags", "+faststart", str(OUT)])
    print(OUT)


if __name__ == "__main__":
    main()
