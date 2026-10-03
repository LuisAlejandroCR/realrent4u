<!-- data_extra/README.md: textos de fuentes públicas que el equipo descargó a mano (una página a la vez)
     para documentos que el paquete oficial trae solo como enlace, con fecha, motivo y chequeo de robots.
     No confundir con data/README.md (guía oficial del organizador) ni con data/corpus/ (corpus oficial,
     que no se toca). -->

# data_extra — team-fetched source texts

**What:** plain text of a few public pages that the organizer pack (`data/corpus/`) lists only as
links. Same layout as the pack: `manifest.csv` has the columns of `data/corpus/corpus_manifest.csv`
(`capture = team-fetched`, `sha256` of the saved file) and each `text/<doc_id>.txt` starts with
`SOURCE:` / `RETRIEVED:` lines, a blank line, then the page text.

**Who and when:** fetched by the realrent4u team on 2026-10-03 between 18:55 and 18:59 UTC, one
request per page, a few seconds apart, after reading each site's `robots.txt`. No crawling, no
login, no bot-challenge bypass. `data/` is untouched.

**Why:** change test T2 (`data/dev/change_tests.json`) needs the Hoboken and Jersey City algorithmic
rent-setting bans, and T5 the struck Massachusetts rent-control ballot question; the pack has no
text for any of them, so extraction could not produce those rules. `data/README.md` §6 allows
consulting public sources but not bulk scraping against a site's terms.

| doc_id | Source | robots.txt / access | Result |
|---|---|---|---|
| D037 | morganlewis.com LawFlash (2026-08-21), pack entry for Jersey City | `/pubs/` allowed | saved |
| D059 | wbur.org news (2026-06-23), pack entry for MA | allows `Claude-User`, crawl-delay 1 | saved |
| X001 | hobokennj.gov press release, 2025-07-10 (ordinance adopted) | no restrictions | saved (new id, official) |
| X002 | hobokennj.gov press release, 2025-05-30 (ordinance introduced) | no restrictions | saved (new id, official) |
| D032–D034, D070–D072 | ecode360.com (Hoboken, Newark code) | Cloudflare bot challenge, even on `robots.txt` | skipped |
| D035 | hudsoncountyview.com news | HTTP 403 to a plain request | skipped |
| — | Jersey City Ord. 25-057 PDF, cityofjerseycity.civicweb.net | `User-agent: * Disallow: /` | skipped |
| — | Hoboken ordinance file, hobokennj.iqm2.com | connection refused | skipped |

`X…` ids are sources that are not in the pack's manifest. `realrent/corpus.py` merges this manifest
into `documents()`: a fetched text fills a link-only entry with the same `doc_id` and is marked
`origin = "team-fetched"`. A captured pack document is never replaced.

The news and law-firm texts are third-party copyrighted pages kept only as the quotable evidence
behind extracted rules. Do not republish them outside this repository.
