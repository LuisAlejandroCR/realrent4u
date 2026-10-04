<!--
mobile/README.md: app nativa iOS/Android (Expo Router) del Rental Housing Law Navigator — cómo correrla,
de dónde salen sus datos, navegación, pantallas e historial de diseño (v5–v15).
Se distingue de web/README.md (demo web Next.js) y de docs/DESIGN.md (sistema visual compartido).
-->

# RealRent4U — app móvil (React Native · Expo)

Prototipo nativo para iOS y Android. **No está listo para producción.** Separado de `web/` (Next.js): no comparten código en tiempo de ejecución; solo copian los mismos JSON y tipos.

## Tecnología elegida
**Expo (SDK 57) + Expo Router.** Motivo: rutas por archivos (igual que el App Router de la web), deep links gratis, `formSheet` nativo en iOS, y se ejecuta en un móvil real con Expo Go sin Xcode/Android Studio. React Navigation queda debajo (Expo Router lo usa internamente), así que el mapa a React Navigation es directo (ver abajo).

## Ejecutar
```bash
cd mobile
npm install          # usar npm
npm start            # genera assets/data/ y abre Expo; escanea el QR con Expo Go, o pulsa i / a
npm run web          # mismo código en el navegador (solo para revisar y capturas)
npm run build-data && npm run typecheck
```
Verificado: `tsc` sin errores y `npx expo export` empaqueta para iOS y Android. No se ha ejecutado en simuladores ni en dispositivos físicos; las capturas provienen de la página de diseño web /mobile-handoff, no de la app en ejecución.

## Datos
`assets/data/` no se commitea: lo genera `scripts/build-data.mjs` (corre antes de `start` y `web`). El script
ejecuta `web/scripts/copy-data.mjs` (mismas fuentes y mismo fallback a fixtures que la web), copia sus JSON y
empaqueta los lookups de todas las fechas en `lookups.json` con una tabla de textos compartida (~1.8 MB en vez
de 23 MB). `src/data.ts` los desempaqueta y adapta `changes.json` (indexado por test id). Sin backend, sin red,
sin LLM, sin lógica legal: la app solo muestra resultados precalculados.
Con lookups, la pantalla de dirección lista exactamente las reglas que devolvió el motor (las que no aplican se
omiten); sin lookups para la fecha, muestra las reglas del registro como **Not evaluated**.

## Navegación
```text
Stack (root)
├─ (tabs)  Tabs inferiores
│  ├─ (home)  Stack      01 Inicio → search 02 Buscar → search/[id] 03 Resultado → search/rule/[ruleId]?address= 04 Regla
│  │                     (Buscar no tiene pestaña propia: se abre desde la barra de Inicio)
│  ├─ changes Stack      06 Pruebas T1–T5 → changes/[testId] 07 Detalle
│  └─ method             08 Método y auditoría
└─ date  (modal)         05 Elegir fecha — formSheet en iOS, modal deslizante en Android
```
Idioma, fecha y dataset viven en `PrefsProvider` por encima del navegador, por lo que volver atrás o cambiar de pestaña los conserva; cada pestaña mantiene su propia pila (la dirección abierta sigue ahí).

Equivalente React Navigation: `NativeStack(Home, Tabs, Date{presentation:'formSheet'})`, `BottomTabs(SearchStack, ChangesStack, Method)`, `SearchStack(Search, Address{id}, Rule{ruleId,address})`, `ChangesStack(Changes, Scenario{testId})`.

## Pantallas y componentes
| Archivo | Pantalla |
|---|---|
| `app/(tabs)/(home)/index.tsx` | 01 Inicio como resumen ejecutivo: búsqueda, KPIs, hoja de ruta "Empieza aquí", mapa de burbujas por jurisdicción, resultados con motivos |
| `app/(tabs)/(home)/search/index.tsx` | 02 Búsqueda: vacía, sin coincidencias, resultados; teclado (`KeyboardAvoidingView`, `keyboardShouldPersistTaps`) |
| `app/(tabs)/(home)/search/[id].tsx` | 03 Dirección: jurisdicción ≠ ciudad postal, datos ausentes, fecha + Cambiar, reglas por categoría |
| `app/(tabs)/(home)/search/rule/[ruleId].tsx` | 04 Regla: estado, motivo, cita, texto literal, fuente (navegador in-app), recuperación, conflicto |
| `app/date.tsx` | 05 Fechas del manifiesto, marca las que no tienen resultados |
| `app/(tabs)/changes/*` | 06 línea de tiempo T1–T5 con KPIs filtro · 07 detalle con mapa y gráficos; "Results not available" ≠ "0 affected" |
| `app/(tabs)/method.tsx` | 08 Fuentes, fixtures, fechas, avisos, límites |
| `app/profile.tsx` | 09 "Tú": expediente de sellos + ajustes (idioma detectado del teléfono, vibración, reducir movimiento). Solo sesión, sin cuenta |

Componentes (`src/components/ui.tsx`): `T(variant, muted, serif, mono)`, `Button(label, onPress, variant: primary|ghost, hint?)`, `Row(title, subtitle?, leading?, trailing?, onPress)`, `StatusBadge(kind, tr)`, `Notice(tone: info|warn|danger, title, children?)`, `Fact(label, value, missing)`, `Card`, `Id`, `SectionLabel`, `Kicker`. `Chrome.tsx`: `LangToggle`, `LegalDateBar` (aviso + fecha, en flujo normal, nunca tapa contenido). `States.tsx`: `LoadingState`, `LoadErrorScreen`.

Movimiento y hápticos: `src/feel.ts` (`haptic.select/tap/thunk/success/warn`, `useReduceMotion`), `src/components/motion.tsx` (`Tap`, `FadeIn`, `CountUp`, `Stamp`), `src/components/Story.tsx` (avatar con anillo de sellos, toast, expediente, casos rápidos). Mapas y gráficos: `src/components/Maps.tsx` (+ `Maps.web.tsx` para la vista web), `src/components/Charts.tsx` (`KpiRow`, `StackedBar`, `BarList`); puntos aproximados (~100 m) en `assets/data/geo.json`, generados por `build-data` desde `derived/census/`. Auditoría y criterios: `docs/UX-AUDIT.md`.

Tipos: `Address, Rule, LookupItem, LookupResult, Jurisdiction, ChangeTest, ChangeResult, Manifest` (`src/types.ts`), `Dataset` (`src/data.ts`), `BadgeKind` (`src/theme.ts`).

## v9 — Tighter layout, more native feel
- **Home:** smaller headline. "Search an address" is the dominant button. The example card has two lines (street + postal city, then the legal jurisdiction marked with ≠ only when it differs) and no repeated ID.
- **Detail headers:** a separate chevron-only back button on the left, a centered title (ID or "Rule"), and EN/ES on the right. iOS uses headerBackButtonDisplayMode "minimal". Android system back is unchanged: it closes the keyboard first, then goes back.
- **Notice and date strip:** lower. The date chip is 30 pt tall with a 9 pt hitSlop, so it is still at least 44/48 tappable.
- **Address:** the building facts sit in one compact row with no "Property" label, and the missing-fact note is one short line ("Missing facts are not inferred."). Rules appear higher on screen.
- **Change tests:** the summary reads "Results unavailable for all 5 scenarios." / "Resultados no disponibles para ninguno de los 5 escenarios." This stays separate from "0 affected addresses".
- Evidence access is unchanged: rule detail has tap-to-open sections for Requirement, Coverage, Exemptions and Source evidence (quoted text, citation, retrieval date, source link).
- Screenshots come from a browser preview of the Expo web build, not from a simulator or a device. Large text and VoiceOver/TalkBack were not tested on a device.

## v8 — Less on screen at once (same Stamp & Marigold colors)
- **Moved into tap-to-open sections:** on the rule screen, Requirement, Coverage, Exemptions, Why this result and Source evidence (quoted text, citation, retrieval date, source link) now each open with a tap, and each appears only when the data has it. In a scenario, Rules involved and Expected behavior open with a tap, and affected addresses open by default when there are any. On Method, the step list, the sources/dates/counts and the warnings open with a tap, and whether test data is in use stays visible.
- **Duplicates removed:** the Method & audit button on home (the tab already does this); the repeated change-test intro inside cards (the inline accordion was replaced by a row that opens the scenario screen); the long "no precomputed results" paragraph on the address screen (it's now a title only, and the full text stays on the rule screen); and the big not-legal-advice box on Method (it's now a single line).
- **Compact chrome:** the legal notice and date strip is slimmer, in normal case (no spaced capitals). The date chip is 36 pt tall with an 8 pt hitSlop, so it is still at least 44/48 tappable. Section labels are in sentence case.
- **Home:** search is a solid stamp-blue button and the first thing on screen. The A0036 example is a compact tappable card.
- **Error:** reads "We couldn't load the sample data. Try again." with Try again right under it. The technical message goes to console.warn only.
- **Back:** detail screens always show "‹ Back". If a screen was opened directly from a link, Back goes to the tab's main screen.
- Screenshots come from a browser preview of the Expo web build (390×844 iOS frame, 412×915 Android frame), not from a simulator or a device.

## Visual system — "Stamp & Marigold" (v7, `src/theme.ts`)
The team chose **B · Stamp & Marigold** over A · Civic Ledger. Tokens: paper `#F5F4EF`, surface `#FFFFFF`, tint `#E9EEF8`, note `#FFF6E3`, ink `#141C2E`, ink2 `#4F5869`, stamp blue `#2949A8` (actions, links, active tab; white on it 7.9:1), marigold `#B86A0E` (bars, glyphs, borders only — 3.9:1 on white, too low for small text), marigold text shade `#8F520A` (5.9:1), highlight `#FFE29A` (sparingly), line `#D8DAE0`.
Result states keep text + glyph; colours re-tuned so none collide with stamp blue: applies green `#1D6B3A`, unknown amber `#7A4A00`, superseded violet `#5B4B8A`, not_yet_effective teal `#0E5F6E`, pending rust `#8A3B2B`, review red `#A3282B`.

**Summary first, evidence after (v7):** rule cards on the address screen show only status, title, a 2-line explanation and a "View source evidence ›" row; requirement, reason, citation, quoted span, source and retrieval date live on the rule detail screen. The legal-jurisdiction anchor is a light tint panel with a blue edge (no large navy fill). Method shows plain summaries; sources, dates and warnings sit behind "Sources, dates and audit details" / "Warnings (n)" disclosures (fixture status stays visible). No data, rules, JSON or web dashboard changed.

### Previous: Visual system — "Civic Ledger" (v6, `src/theme.ts`)
Two directions were proposed (`design/directions.png`): **A · Civic Ledger** (applied) and B · Stamp & Marigold. A was chosen because it keeps the landing's identity (warm paper, green/teal family, terracotta), reads as a public record rather than a bank, and its action colour reaches 7.4:1 with white.

| Token | HEX | Use |
|---|---|---|
| paper | #F6F2EA | page background |
| surface | #FFFFFF | cards, tab bar, sheets |
| tint | #EAF2EF | search/section header bands, active-tab pill (#DDEDE9) |
| sand | #F3EBDC | evidence (document excerpt) panel |
| ink | #16233A | text, selected EN/ES, jurisdiction anchor card (only dark block) |
| ink2 | #4E5B6B | secondary text (6.5:1 on paper) |
| line / lineStrong | #DCD6CA / #B9B2A4 | borders / input borders |
| primary | #0F5E56 | actions, links, active tab |
| accent (brick) | #B4532F | kickers, legal notice, ≠ postal/jurisdiction marker |
| marker | #F3D27A | highlight behind ink headline words only |
| amber / amberTint | #8A5A00 / #FBEFD2 | missing facts, "results not available" |
| danger / dangerTint | #A3282B / #FBE3E3 | needs human review, load error |

Result states (fg / bg / glyph + text label): applies #0F5E56/#DDEDE9 ●, unknown #8A5A00/#FBEFD2 ?, superseded #5B4B8A/#ECE8F5 ⤳, not_yet_effective #1F4E8C/#E3ECF8 ◷, pending #B4532F/#F7E4DA ◌, not evaluated #4E5B6B/#FFFFFF ○, needs review #A3282B/#FBE3E3 !.

Type: serif (Georgia / Android serif) for headlines 34/28/21; system sans body 16, small 14, micro 12; mono for IDs and dates.

## Before → after (v5 → v6)
- **Tabs:** empty outlined squares → custom SVG icons (magnifier, calendar-with-arrow, checklist document); active = filled icon + bold label + green pill.
- **Home:** plain text + button → brand mark (house with brick door), marker-highlighted headline, a large search field as the single primary action, and a real example (A0036: postal city South Boston ≠ legal jurisdiction Boston, MA).
- **Search:** plain form → tinted header band with a large field; address rows show ID chip, street, postal city and legal jurisdiction (≠ in brick when they differ); designed empty, compact no-match (sits right under the field with the keyboard open), skeleton loading and error states.
- **Address:** flat list → address headline + a compact ink jurisdiction card as the anchor; property summary chips where missing facts are amber, dashed and marked "?"; rule cards with status, title, short text and an expandable "Source evidence" panel.
- **Rule detail:** single column → result banner coloured by state, then requirement card, then a sand "document excerpt" evidence panel.
- **Date sheet:** tall sheet over a gray void → sheet sized to its content over the dimmed page, a "Done" action, a filled "Selected" pill, and "No precomputed results" on each date it applies to.
- **Change tests:** plain rows → availability meter (0 of 5), T-ID tiles, scenario dates, availability pills, accordion with rules and expected behaviour.
- **Method:** list → three numbered cards: How the system works · Data used (fixtures, sources, dates) · Limits (warnings + legal notice).

## Screenshots and preview build
`screens/ios/*` (390×844 pt) and `screens/android/*` (412×915 dp) were rendered from **this exact source** via `npx expo export --platform web`, with `?frame=1&pf=ios|android` (status bar, plus `&kbd=1` for a keyboard mock), `&q=` to prefill search and `&state=loading|error` for the state screens. These switches exist only on web (`src/platform.ts`, `src/components/PreviewChrome.tsx`) and do nothing on devices. The web build is for screenshots only, not a supported product.

**Not tested in iOS/Android simulators or on devices.** Verified: `tsc` passes, and `expo export` bundles for iOS, Android and web.

## iOS vs Android
| | iOS | Android |
|---|---|---|
| Táctil mínimo | 44 pt (`minTouch`) | 48 dp |
| Atrás | "‹ Back", gesto de borde | flecha ←, botón/gesto del sistema |
| Fecha | form sheet con grabber, ✓ | modal con radios Material |
| Pulsación | opacidad | ripple |
| Teclado | `behavior="padding"` | `adjustResize` (por defecto) |
| Fuente externa | SFSafariViewController | Custom Tabs (`expo-web-browser`) |
| Safe area | `react-native-safe-area-context` + edge-to-edge en Android |

Texto escalable: `allowFontScaling` activo; solo la barra legal/idioma limita a ×1.4–1.6 para no romperse. Sin scroll horizontal: filas flexibles con `flexWrap`.

## Estados
Cargando (`LoadingState`), error de datos (`LoadErrorScreen` + Reintentar), fixtures activos (aviso en Inicio cuando `uses_fixtures`), jurisdicción no resuelta, sin resultados para la fecha, faltan datos del edificio (ej. real: A0002), sin reglas aplicables, sin coincidencias, resultados de cambios no disponibles.

## Dependencias
`expo`, `expo-router` (navegación), `react-native-screens` y `react-native-safe-area-context` (requeridas por la navegación y safe areas), `expo-linking`/`expo-constants` (requeridas por expo-router), `expo-status-bar` (barra oscura sobre fondo claro), `expo-web-browser` (abrir fuentes in-app), `react-native-svg` (iconos de pestañas y marca), `react-native-web` + `react-dom` + `@expo/metro-runtime` (solo para generar capturas en web).

## Refinamientos v5
- La fecha aparece una sola vez por pantalla: en la barra legal (control tocable → hoja de fechas). Se quitó la tarjeta de fecha duplicada del resultado de dirección.
- Hoja de fechas: ✓ (iOS) o radio (Android) + texto "Selected / Seleccionada"; anuncio de estado seleccionado; "No precomputed results" junto a cada fecha sin resultados; descartar la hoja conserva la selección. Back de Android cierra la hoja (comportamiento nativo del modal).
- Búsqueda: la consulta vive en `PrefsProvider` (se conserva al abrir un resultado, volver o cambiar de pestaña); acción "search" del teclado lo cierra; mensaje sin coincidencias más corto; conteo en región viva y anunciado con `announceForAccessibility`; la barra de pestañas se oculta con el teclado (`tabBarHideOnKeyboard`) para no dejar huecos; Back de Android cierra primero el teclado (nativo).
- Pestaña activa: etiqueta teal + píldora detrás del icono (forma, no solo color); los lectores de pantalla anuncian "seleccionada".
- Movimiento reducido: si el sistema lo pide, las transiciones de pila se desactivan.
- Aviso legal más compacto (⚠ Not legal advice).

## Pendiente antes de producción
Iconos/splash, fuentes de marca, persistir idioma/fecha (AsyncStorage), pruebas en dispositivo y con lector de pantalla, lookups reales.

## v10 — final polish (preview screenshots, not simulator/device)
- Home: headline 26 pt, search button directly under it (taller, primary), intro moved below, example is a one-line secondary card (street + postal city, then legal jurisdiction only when it differs). No ID repeated.
- Address: ID lives only in the header; street/city tighter; jurisdiction card reduced padding; facts row tighter; "Missing facts are not inferred." kept; one "no precomputed results" notice only.
- Detail headers: back button is "‹ Back / ‹ Atrás" (label + chevron), separated left of a centered title. Rule header shows the rule's short name (not "Rule"); scenario shows T-ID in header and an ID chip + full title in the body.
- Evidence (citation, quoted span, source URL, retrieval date) unchanged: one tap via "Source evidence" fold on rule detail.
- "Results unavailable" vs "0 affected addresses" logic unchanged.

## v11 — final UX pass (browser-preview screenshots, not simulator/device)
- Home vs Search: Home = brand, one-line pitch, "Search an address" CTA, one real example. Search = task only: compact "Find an address" title, field, legal/date strip, a short hint of what can be typed. Home's CTA opens `/search?focus=1`, which focuses the field (keyboard up). The Search tab opens Search directly; the query is kept in shared prefs across tabs/back.
- Closed sections preview one line from the record (requirement, coverage, exemptions, citation + retrieval date; scenario rule IDs and expected behavior). Sections with no data say "No information available in the record" and are not expandable. Previews are labelled for VoiceOver/TalkBack ("Title. preview"), with expanded state and a hint; opening shows the full untruncated text. The rule's result explanation is no longer clamped.
- Not tested: large text, VoiceOver/TalkBack and safe areas on real devices/simulators.

## v12 — legibility pass (browser-preview screenshots, not simulator/device)
- No truncated previews: a closed section shows a one-line preview only when the whole text fits (≤44 chars, e.g. rule IDs, retrieval date); otherwise just the title. Open sections show full text.
- Detail headers are fixed labels ("Rule details", "Address details", "Scenario details" / ES); full rule name, address + ID, and T-ID + title live in the content. Back stays separate with a 44/48 target.
- Legal/date strip: chip 26 px tall with an enlarged hit area (≥44/48), smaller date text; date appears once.
- Search with keyboard: hint sits directly under the field, sample-count line hidden while typing, tab bar hidden.
- "Results not available" is a slim inline note stating no result exists and that it is not zero; "0 affected addresses" logic unchanged.

## v13 — clarity pass (browser-preview screenshots, not simulator/device)
- Retrieval dates are formatted for display only (`src/format.ts`): "Retrieved Oct 1, 2026" / "Recuperado el 1 oct 2026". JSON keeps the raw timestamp; missing dates show nothing.
- Rule details separates "Rule status: In force" (legal status, from rules.json) from an "Evaluation" block. Without a precomputed lookup it reads "Not available for this date" plus a one-line explanation; nothing is recalculated.
- Scenario details: tighter top padding and section gaps; "Results not available" note stays right under the sections.
- Date chip: 26 px visual height + 11 px hit slop each side = 48 (meets iOS 44 / Android 48). Screen readers hear "As of <date>, Selected" with the hint "Opens the date picker". Date still appears once per screen. Not verified with VoiceOver/TalkBack on a device.

## v15 — integración con el repo (2026-10-03)
- Movida de Lovable a `mobile/`, actualizada a Expo SDK 57 (React Native 0.86, expo-router 57); `query-string` ya no hace falta.
- Datos reales vía `scripts/build-data.mjs`; lookups y change tests visibles.
- Verificado en navegador a 375 px: SF A0016 (ordenanza aplica, §1947.12 desplazado por r-D080-01), Dorchester → Boston, ES, evidencia de regla, T1–T5. `tsc` pasa.
- Inicio pasa a ser la primera pestaña (Home / Inicio): ahora tiene la barra inferior como las demás pantallas.
- Conocido: en web el botón atrás puede decir "Back" tras cambiar a ES; los avisos `accessibilityElementsHidden`/`importantForAccessibility` solo salen en web. No probado aún en Expo Go en un teléfono.

## v14 — bottom-of-screen check (browser preview, not simulator/device)
- The tab bar is laid out in normal flow (not absolutely positioned), so every tab screen ends above it; Rule details' scroll view also keeps `paddingBottom: space.xxxl`. With Requirement, Coverage, Exemptions and Source evidence all open and scrolled to the end, the "Open source" button ends 76 px above the tab bar on iOS 390×844, Android 412×915 and a small 320×568 viewport. No code change was needed.
- Not tested: large text / Dynamic Type and VoiceOver/TalkBack scrolling on real devices or simulators.
