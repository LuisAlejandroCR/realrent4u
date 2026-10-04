<!--
LANDING_CLIPS.md: guiones de narración (EN/ES) para ElevenLabs de los 3 clips cortos de la landing, uno por
sección (Cómo funciona, Cinco resultados, Cambio en el tiempo), con tomas, mapas y gráficos de la demo.
Se distingue de VIDEO_SCRIPTS.md (los 3 videos de entrega de ≤ 60 s) y de DESIGN.md (cómo se ve la web).
-->

# Landing clips — ElevenLabs scripts

Three short clips, one per landing section. Each one runs **≤ 35 s** and plays beside its section. They
show the product's own maps and charts and nothing invented: every number below comes from this build's data
files (2026-10-04 run). These are **not** the three submission videos in `VIDEO_SCRIPTS.md`.

| Clip id (`web/landing.config.json`) | Section on `/` | Target |
|---|---|---|
| `how-it-works` | 01 How it works · *Three facts decide. We check each one.* | ≤ 35 s |
| `five-results` | 02 What each result means · *Five results, always labelled.* | ≤ 35 s |
| `change-over-time` | 03 Change over time · *Five scenarios across time.* | ≤ 35 s |

## Produce with the ElevenLabs MCP

1. Add the server once, in a terminal where `claude` runs:

   ```bash
   claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp
   ```

   Then authenticate it from an interactive `claude` session (`/mcp` → elevenlabs). The key stays in your
   ElevenLabs account, never in this repo.
2. Ask Claude: *"With the elevenlabs MCP, synthesize clip `how-it-works` (EN) from docs/LANDING_CLIPS.md,
   voice Lauren, model eleven_multilingual_v2, stability 0.5, similarity 0.75, style 0, speed 1.0, save to
   web/public/media/how-it-works-en.mp3"*. Repeat per clip and language. These are the same voice settings
   as `VIDEO_SCRIPTS.md`.
3. Measure each file (`ffprobe -i file.mp3 -show_entries format=duration -v quiet -of csv=p=0`). It must be
   ≤ 35 s. If a clip runs long, cut words; never speed up the voice.
4. Record the screen to the audio length (1920×1080, 30 fps), mux it to `web/public/media/<id>.mp4` and write
   captions `<id>.en.vtt` / `<id>.es.vtt` from the narration below.
5. Fill `src`, `poster`, `duration`, `captions` and `transcript` for the clip in `web/landing.config.json`.
   The clip then appears in its section. Until then the section shows no placeholder.

## Numbers used (source)

| Figure | Value | Source |
|---|---|---|
| Sample addresses, cities | 500 in 9 cities | `data/data/sample_addresses.csv`, `derived/jurisdictions.json` |
| Postal city ≠ legal city | 38 addresses | same, `place` vs `postal_city` |
| Year built / units missing | 212 / 242 addresses | `sample_addresses.csv` |
| On the map | 485 of 500 (15 placed at city level) | `derived/census/batch*.csv` → `public/data/geo.json` |
| Results on 2026-10-01 | 9,332: 7,200 applies · 1,337 unknown · 195 superseded · 140 not yet effective · 460 pending · 180 flags | `derived/lookups/2026-10-01.json` |
| T1 … T5 affected | 250 · 90 (90 flags) · 140 (90 flags) · 110 · 0 | `submission/changes.json` |

---

## 1. `how-it-works` — Three facts decide (≈ 32 s)

| Time | Shot (all real screens) |
|---|---|
| 0:00–0:08 | Landing hero stage, tab "Postal city ≠ legal city": **33 WARD ST**, *South Boston* struck, **Boston, MA** stamped |
| 0:08–0:15 | Dashboard `?a=A0036` → **map**: *Boston · Cambridge* metro, county lines, the pin pulsing in South Boston among the other sample dots, 5 km scale bar |
| 0:15–0:23 | Facts strip: *Year built 2019 · Units not in the record*, then a rule card whose result is **Unknown** with "units is missing" |
| 0:23–0:32 | **Chart** "Results for this address on each date": four stacked bars (2025-12-31 → 2027-07-02); click the last row and the As of picker follows |

**Narration (EN, 78 words)**

```text
Three facts decide which rules reach a building. <break time="0.4s" />
First, the legal city. This mail says South Boston, but the Census geocoder places it inside Boston, so Boston's ordinances apply.
Second, the building record. Year built and number of units can bring a building in or out of a rule. When one is missing, the answer is unknown, never a guess.
Third, the date. Each rule is checked against the day you ask.
```

**Narración (ES, 79 palabras)**

```text
Tres datos deciden qué reglas alcanzan a un edificio. <break time="0.4s" />
Primero, la ciudad legal. El correo dice South Boston, pero el geocodificador del Censo lo ubica dentro de Boston, así que aplican las ordenanzas de Boston.
Segundo, el registro del edificio. El año de construcción y el número de unidades pueden incluirlo o excluirlo de una regla. Si falta uno, la respuesta es desconocido, nunca una suposición.
Tercero, la fecha. Cada regla se revisa contra el día de la consulta.
```

## 2. `five-results` — Five results, always labelled (≈ 34 s)

| Time | Shot |
|---|---|
| 0:00–0:07 | Landing section 02: the five result cards rising in |
| 0:07–0:14 | **Chart** (record the "At a glance" bar on several addresses or build one slide): **9,332 results on 2026-10-01**, stacked: 7,200 applies · 1,337 unknown · 195 superseded · 140 not yet effective · 460 pending |
| 0:14–0:20 | `?a=A0016` (3515 Fillmore St, San Francisco, 1926): city rule card *Applies*; open "Displaces 1": the state cap §1947.12 is **Superseded** |
| 0:20–0:26 | `?a=A0005` (1609 Addison St, Berkeley): *Unknown*, "year built is missing" |
| 0:26–0:34 | `?a=A0036`: three **Pending** Massachusetts bills (S.2983, H.5222); KPI "Needs human review" tile on T3 to close |

**Narration (EN, 84 words)**

```text
Every rule gets one of five results, each with its own label and marker.
On October first, 2026, the sample produces nine thousand three hundred results. Most apply.
Superseded means a local rule displaces a state one, like San Francisco's rent ordinance over the statewide cap.
Unknown means the record lacks a fact, here a Berkeley building with no year built.
Not yet effective means signed, with a later start date. Pending means a bill, never law in force.
And when rules may clash, we flag them for a human.
```

**Narración (ES, 86 palabras)**

```text
Cada regla recibe uno de cinco resultados, cada uno con su etiqueta y su marcador.
El primero de octubre de 2026, la muestra produce nueve mil trescientos resultados. La mayoría aplica.
Desplazada significa que una regla local reemplaza a una estatal, como la ordenanza de alquiler de San Francisco frente al tope estatal.
Desconocido significa que falta un dato, aquí un edificio de Berkeley sin año de construcción.
Aún no vigente: firmada, con fecha de inicio posterior. Pendiente: un proyecto, nunca ley vigente.
Y si las reglas pueden chocar, lo marcamos para revisión humana.
```

## 3. `change-over-time` — Five scenarios across time (≈ 35 s)

| Time | Shot |
|---|---|
| 0:00–0:06 | Landing section 03: the **timeline** draws T1–T5 on the date axis |
| 0:06–0:13 | Dashboard `?tab=tests&t=T1`: KPIs **250 of 500 · 4 of 9 cities · 50%**; **maps** of Los Angeles, San Francisco · Berkeley and San Diego, all dots lit |
| 0:13–0:20 | `t=T2`: map *Newark · Jersey City · Hoboken*: Hoboken and Jersey City lit, **Newark hollow** |
| 0:20–0:27 | `t=T3`: the same map, Newark lit too; 90 diamonds = needs human review; KPI tile ▲ 90 |
| 0:27–0:35 | `t=T4` Boston · Cambridge lit as *pending*; `t=T5`: same map, **all hollow, 0 confirmed empty** |

**Narration (EN, 86 words)**

```text
The law moves, so we test five changes over time.
T1: California's algorithmic pricing ban takes effect on January first, 2026. Two hundred fifty addresses switch from not yet effective to applies.
T2: Hoboken and Jersey City ban rent algorithms. Newark, next door, does not, and its addresses stay dark.
T3: New Jersey's FAIR Act is signed but starts in July 2027. Ninety addresses get a flag where it meets those city bans.
T4: two Massachusetts bills, pending. T5: a struck ballot question. Zero addresses, confirmed.
```

**Narración (ES, 88 palabras)**

```text
La ley cambia, así que probamos cinco cambios en el tiempo.
T1: la prohibición de precios algorítmicos de California entra en vigor el primero de enero de 2026. Doscientas cincuenta direcciones pasan de aún no vigente a aplica.
T2: Hoboken y Jersey City prohíben los algoritmos de alquiler. Newark, al lado, no, y sus direcciones quedan apagadas.
T3: la Ley FAIR de Nueva Jersey está firmada, pero empieza en julio de 2027. Noventa direcciones reciben una alerta donde choca con esas prohibiciones.
T4: dos proyectos de Massachusetts, pendientes. T5: una pregunta electoral anulada. Cero direcciones, confirmado.
```
