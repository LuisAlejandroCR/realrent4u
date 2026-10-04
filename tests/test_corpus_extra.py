# test_corpus_extra.py: team-fetched texts in data_extra/ load next to the organizer pack in data/.
# Checks the override of link-only entries, the quote check on a fetched doc, and that data/ is intact.
# No network, no LLM.

import csv
import hashlib

from realrent import corpus, paths

HOBOKEN_QUOTE = "City of Hoboken has outlawed the use of algorithmic rent-setting software in the rental housing market"


def _extra_rows():
    with corpus.EXTRA_MANIFEST.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_extra_manifest_has_pack_columns_and_hashes():
    with paths.MANIFEST.open(encoding="utf-8", newline="") as f:
        pack_columns = next(csv.reader(f))
    rows = _extra_rows()
    assert rows and list(rows[0]) == pack_columns
    for r in rows:
        assert r["status"] == "ok"
        file = corpus.EXTRA / r["text_file"]
        assert hashlib.sha256(file.read_bytes()).hexdigest() == r["sha256"]
        head = file.read_text(encoding="utf-8").splitlines()[:3]
        assert head[0] == f"SOURCE: {r['url']}" and head[1].startswith("RETRIEVED: ") and head[2] == ""


def test_fetched_doc_overrides_link_only_entry():
    assert not corpus.starter_documents()["D037"].has_text
    doc = corpus.documents()["D037"]
    assert doc.has_text and doc.origin == "team-fetched"
    assert "218-12" in doc.text()


def test_quote_check_works_on_extra_doc():
    assert corpus.find_quote("X001", HOBOKEN_QUOTE)
    assert corpus.find_quote("X001", HOBOKEN_QUOTE + " and also something invented") is None
    assert corpus.quote_in_corpus(HOBOKEN_QUOTE)


def test_pack_docs_unchanged():
    pack = corpus.starter_documents()
    merged = corpus.documents()
    assert len(pack) == 87
    assert set(pack) <= set(merged)
    for doc_id, doc in pack.items():
        if doc.has_text:
            assert merged[doc_id] == doc and merged[doc_id].origin == "starter"
    for r in _extra_rows():
        assert merged[r["doc_id"]].origin == "team-fetched"
