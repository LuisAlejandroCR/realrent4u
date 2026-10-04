# corpus.py: loads the corpus manifest, document texts and sample addresses.
# Team-fetched texts in data_extra/ (see data_extra/README.md) override link-only entries of the pack.
# Also holds the quote check: a rule survives only if its quoted span exists in its source text
# (compared with whitespace collapsed, since the captured texts keep PDF line breaks).

import csv
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from realrent import paths

_WS = re.compile(r"\s+")

EXTRA = paths.ROOT / "data_extra"
EXTRA_MANIFEST = EXTRA / "manifest.csv"


@dataclass(frozen=True)
class Document:
    doc_id: str
    jurisdiction: str
    url: str
    source_type: str
    retrieved_at: str
    text_file: Path | None
    origin: str = "starter"  # "starter" (data/, organizer pack) or "team-fetched" (data_extra/)

    @property
    def has_text(self) -> bool:
        return self.text_file is not None

    def text(self) -> str:
        """Document body without the SOURCE/RETRIEVED header lines."""
        if self.text_file is None:
            return ""
        raw = self.text_file.read_text(encoding="utf-8")
        lines = raw.splitlines()
        while lines and (lines[0].startswith(("SOURCE:", "RETRIEVED:")) or not lines[0].strip()):
            lines.pop(0)
        return "\n".join(lines)


def collapse(text: str) -> str:
    return _WS.sub(" ", text).strip()


def _load(manifest: Path, base: Path, origin: str) -> dict[str, Document]:
    with manifest.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    docs = {}
    for r in rows:
        text_file = base / r["text_file"] if r["status"] == "ok" and r["text_file"] else None
        docs[r["doc_id"]] = Document(
            doc_id=r["doc_id"],
            jurisdiction=r["jurisdictions"],
            url=r["url"],
            source_type=r["source_type"],
            retrieved_at=r["retrieved_at"],
            text_file=text_file,
            origin=origin,
        )
    return docs


@lru_cache(maxsize=1)
def starter_documents() -> dict[str, Document]:
    """The 87 documents of the organizer pack, as shipped in data/corpus/."""
    return _load(paths.MANIFEST, paths.CORPUS, "starter")


@lru_cache(maxsize=1)
def documents() -> dict[str, Document]:
    """Pack documents plus team-fetched ones; a fetched text replaces a link-only entry, never a captured one."""
    docs = dict(starter_documents())
    if EXTRA_MANIFEST.exists():
        for doc_id, doc in _load(EXTRA_MANIFEST, EXTRA, "team-fetched").items():
            if doc_id in docs and docs[doc_id].has_text:
                continue
            docs[doc_id] = doc
    return docs


@lru_cache(maxsize=None)
def _collapsed_text(doc_id: str) -> str:
    return collapse(documents()[doc_id].text())


def find_quote(doc_id: str, quote: str) -> str | None:
    """Return the quote as it appears in the document (whitespace collapsed), or None."""
    if doc_id not in documents():
        return None
    needle = collapse(quote)
    if len(needle) < 20:
        return None
    return needle if needle in _collapsed_text(doc_id) else None


def quote_in_corpus(quote: str) -> bool:
    """True if the quote exists in any captured document."""
    needle = collapse(quote)
    return any(needle in _collapsed_text(d) for d, doc in documents().items() if doc.has_text)


@lru_cache(maxsize=1)
def addresses() -> list[dict[str, str]]:
    with paths.ADDRESSES.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))
