# pipeline.py: one command for the whole chain, offline by default: extract -> resolve -> lookups ->
# changes -> validate. Each step runs as `python -m realrent.<step>` in a staging copy of the repo, so a
# failing step never leaves half-written outputs; --check compares the staged outputs with the repo (A2).

import argparse
import difflib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from realrent import paths

PACKAGE = Path(__file__).resolve().parent
# Variables that let a step call a model (extraction, LLM explanations); removed unless --online.
LLM_ENV = ("ANTHROPIC_API_KEY", "REALRENT_LLM_EXPLAIN")
RESULT_ORDER = ("applies", "unknown", "superseded", "not_yet_effective", "pending")
STATUS_ORDER = ("in_force", "not_yet_effective", "pending", "failed")

# What to do when a step exits non-zero.
HINTS = {
    "extract": "Check the output above; online runs also need ANTHROPIC_API_KEY.",
    "resolve": "Offline resolution reads the cached Census responses in derived/census/; "
               "without them run with --online (network).",
    "lookups": "Check the output above (engine.evaluate over every address and demo date).",
    "changes": "Check the output above (change tests T1-T5 from data/dev/change_tests.json).",
    "validate": "The regenerated files do not validate; see the errors above.",
}

Runner = Callable[[list[str], Path, dict], int]


class StepError(Exception):
    """A step failed; the message names the step and what to do."""


@dataclass(frozen=True)
class Step:
    name: str
    argv: list[str]  # arguments after `python -m`


def subprocess_runner(argv: list[str], cwd: Path, env: dict) -> int:
    return subprocess.run([sys.executable, "-m", *argv], cwd=cwd, env=env).returncode


def step_env(online: bool) -> dict:
    """Environment for the steps: no model key unless --online, so offline runs are deterministic."""
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    if not online:
        for k in LLM_ENV:
            env.pop(k, None)
    return env


def plan(online: bool, skip_extract: bool, have_key: bool) -> list[Step]:
    steps = []
    if not skip_extract:
        steps.append(Step("extract", ["realrent.extract"] + ([] if online and have_key else ["--offline"])))
    steps += [
        Step("resolve", ["realrent.resolve"] + ([] if online else ["--offline"])),
        Step("lookups", ["realrent.lookups"]),
        Step("changes", ["realrent.changes"]),
        Step("validate", ["realrent.validate"]),
    ]
    return steps


# ---------------------------------------------------------------- staging


def link_dir(link: Path, target: Path) -> None:
    """Directory link: a symlink, or on Windows without the symlink privilege a junction (no admin
    needed). Removing the staging tree removes the link, never the target."""
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        if os.name != "nt":
            raise
        import _winapi
        _winapi.CreateJunction(str(target.resolve()), str(link))


def stage_tree(root: Path, stage: Path, online: bool, skip_extract: bool) -> None:
    """Mirror of the repo for the steps: a copy of the code (so paths.ROOT is `stage`), links to the
    read-only inputs and to the caches (runs/raw/, derived/census/), and empty output folders.
    tests/fixtures/ is left out on purpose: a step that falls back to fixture data fails instead."""
    shutil.copytree(PACKAGE, stage / "realrent", ignore=shutil.ignore_patterns("__pycache__"))
    link_dir(stage / "data", root / "data")
    if (root / "data_extra").is_dir():  # team-fetched texts (data_extra/README.md) are read-only inputs too
        link_dir(stage / "data_extra", root / "data_extra")
    for cache in ("runs/raw", "derived/census"):
        src = root / cache
        if online:
            src.mkdir(parents=True, exist_ok=True)  # online calls must land in the repo's cache
        (stage / cache).parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            link_dir(stage / cache, src)
    (stage / "submission").mkdir()
    if skip_extract and (root / "submission" / "rules.json").exists():
        shutil.copyfile(root / "submission" / "rules.json", stage / "submission" / "rules.json")


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _rules(stage: Path) -> list:
    path = stage / "submission" / "rules.json"
    return (_read(path).get("rules") or []) if path.exists() else []


def require_rules(stage: Path) -> None:
    if not _rules(stage):
        raise StepError("rules: submission/rules.json has no rules, so there is nothing to look up. "
                        "Run without --skip-extract (cached outputs in runs/raw/, or --online with "
                        "ANTHROPIC_API_KEY).")


def after_extract(stage: Path) -> None:
    """extract.run logs documents it could not process and still exits 0; an incomplete rules.json
    must not replace the committed one, so any logged error fails the step."""
    logs = sorted((stage / "runs").glob("extract-*.jsonl"))
    if not logs:
        raise StepError("extract: no audit log was written to runs/ (A14).")
    entries = [json.loads(line) for line in logs[-1].read_text(encoding="utf-8").splitlines() if line.strip()]
    errors = [e for e in entries if e.get("action") == "error"]
    if errors:
        raise StepError(f"extract: {len(errors)} documents have no model output (first: "
                        f"{errors[0].get('doc_id')}, {errors[0].get('reason')}). Offline runs rebuild "
                        "rules.json only from the cached outputs in runs/raw/; run with --online and "
                        "ANTHROPIC_API_KEY to extract the missing documents.")
    require_rules(stage)


def _require(step: str, rel: str) -> Callable[[Path], None]:
    def check(stage: Path) -> None:
        if not (stage / rel).exists():
            raise StepError(f"{step}: exited 0 but did not write {rel}.")
    return check


AFTER = {
    "extract": after_extract,
    "resolve": _require("resolve", "derived/jurisdictions.json"),
    "lookups": _require("lookups", "submission/lookups.json"),
    "changes": _require("changes", "submission/changes.json"),
}


# ---------------------------------------------------------------- outputs


def outputs(stage: Path, skip_extract: bool) -> list[str]:
    """Generated files, relative to the repo root (audit logs excluded: they are new on every run)."""
    rels = [] if skip_extract else ["submission/rules.json"]
    rels += ["derived/jurisdictions.json", "submission/lookups.json", "submission/changes.json"]
    rels += sorted(f"derived/lookups/{p.name}" for p in (stage / "derived" / "lookups").glob("*.json"))
    return rels


def is_placeholder(root: Path) -> bool:
    """True while the repo's submission/lookups.json and changes.json are both the empty files that
    `validate --init` writes (no lookup items, no change results, no notes). Until a full run is
    committed, --check compares only rules.json and jurisdictions.json."""
    try:
        lk = _read(root / "submission" / "lookups.json")
        ch = _read(root / "submission" / "changes.json")
    except (OSError, ValueError):
        return False
    return (not any(lk.get("lookups", {}).values())
            and not any(e.get("affected_address_ids") or e.get("conflict_flag_address_ids") or e.get("notes")
                        for e in ch.values()))


def downstream(rel: str) -> bool:
    """Outputs built from rules.json (lookups and change tests), as opposed to rules and jurisdictions."""
    return rel in ("submission/lookups.json", "submission/changes.json") or rel.startswith("derived/lookups/")


def compare(root: Path, stage: Path, rels: list[str], max_diff: int = 12) -> tuple[list[str], int]:
    """(report lines, number of files that differ): every generated file vs the repo's copy, with the
    start of a diff for each one that regenerating would change, plus stale files in derived/lookups/.
    Lookups and change results are skipped while the repo holds the `validate --init` placeholders."""
    placeholder = is_placeholder(root)
    lines, bad = [], 0
    for rel in rels:
        old, new = root / rel, stage / rel
        if placeholder and downstream(rel):
            lines.append(f"skipped  {rel} (repo has the validate --init placeholder; compared once a full "
                         "run is committed)")
            continue
        if not old.exists():
            lines.append(f"MISSING  {rel} (regenerated, not in the repo)")
        elif old.read_bytes() != new.read_bytes():
            lines.append(f"DIFFERS  {rel}")
            diff = difflib.unified_diff(old.read_text(encoding="utf-8").splitlines(),
                                        new.read_text(encoding="utf-8").splitlines(),
                                        f"repo/{rel}", f"regenerated/{rel}", n=1, lineterm="")
            lines += [f"    {line}" for _, line in zip(range(max_diff), diff)]
        else:
            lines.append(f"same     {rel}")
            continue
        bad += 1
    produced = set(rels)
    for p in sorted((root / "derived" / "lookups").glob("*.json")):
        rel = f"derived/lookups/{p.name}"
        if rel not in produced and not placeholder:
            lines.append(f"STALE    {rel} (in the repo, no longer regenerated)")
            bad += 1
    return lines, bad


def promote(root: Path, stage: Path, rels: list[str], skip_extract: bool) -> list[str]:
    """Copy the staged outputs (and the new extract audit log) into the repo."""
    written = []
    logs = [] if skip_extract else [f"runs/{p.name}" for p in sorted((stage / "runs").glob("extract-*.jsonl"))]
    for rel in rels + logs:
        dst = root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(stage / rel, dst)
        written.append(rel)
    return written


def summary(stage: Path, skip_extract: bool, check: bool = False) -> list[str]:
    rules = _rules(stage)
    status = Counter(r.get("status") for r in rules)
    jur = {k: v for k, v in _read(stage / "derived" / "jurisdictions.json").items() if not k.startswith("_")}
    match = Counter(j.get("match") for j in jur.values())
    lk = _read(stage / "submission" / "lookups.json")
    items = [i for v in lk["lookups"].values() for i in v]
    results = Counter(i.get("result") for i in items)
    flags = sum(bool(i.get("conflict_flag")) for i in items)
    dates = len(list((stage / "derived" / "lookups").glob("*.json")))
    ch = _read(stage / "submission" / "changes.json")
    lines = [
        f"rules        {len(rules)}" + (" (from submission/rules.json, extraction skipped)" if skip_extract else "")
        + " · " + " · ".join(f"{status.get(s, 0)} {s}" for s in STATUS_ORDER),
        f"addresses    {len(lk['lookups'])} · {sum(bool(j.get('jurisdiction')) for j in jur.values())} in an "
        f"in-scope city · match " + " · ".join(f"{match.get(m, 0)} {m}" for m in ("exact", "fallback", "none")),
        f"lookups      {lk['as_of']}: {len(items)} items · "
        + " · ".join(f"{results.get(r, 0)} {r}" for r in RESULT_ORDER)
        + f" · {flags} conflict flags (+{dates} dates in derived/lookups/)",
        "changes      " + " · ".join(f"{t} {len(e.get('affected_address_ids', []))}/"
                                     f"{len(e.get('conflict_flag_address_ids', []))}" for t, e in ch.items())
        + "  (affected/conflict flags)",
    ]
    logs = sorted((stage / "runs").glob("extract-*.jsonl"))
    if logs and not skip_extract:
        lines.append(f"audit log    runs/{logs[-1].name}" + (" (not kept: --check writes nothing)" if check else ""))
    return lines


# ---------------------------------------------------------------- run


def run(root: Path = paths.ROOT, *, online: bool = False, skip_extract: bool = False, check: bool = False,
        runner: Runner = subprocess_runner, stage: Path | None = None) -> int:
    """Run every step in a staging folder, then promote the outputs to `root` (or, with check, compare
    them with `root`). Returns the exit code. A staging folder created here is always removed."""
    own_stage = stage is None
    stage = Path(tempfile.mkdtemp(prefix="realrent-pipeline-")) if own_stage else Path(stage)
    try:
        return _run(Path(root), stage, online, skip_extract, check, runner)
    finally:
        if own_stage:
            shutil.rmtree(stage, ignore_errors=True)


def _run(root: Path, stage: Path, online: bool, skip_extract: bool, check: bool, runner: Runner) -> int:
    have_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    if online and not skip_extract and not have_key:
        print("note: --online without ANTHROPIC_API_KEY: extraction reads the cache in runs/raw/ only.")
    stage.mkdir(parents=True, exist_ok=True)
    env = step_env(online)
    print(f"pipeline ({'check' if check else 'online' if online else 'offline'}) in a staging copy of {root}",
          flush=True)
    try:
        stage_tree(root, stage, online, skip_extract)
        if skip_extract:
            require_rules(stage)
        for step in plan(online, skip_extract, have_key):
            print(f"\n== {step.name}: python -m {' '.join(step.argv)}", flush=True)
            code = runner(step.argv, stage, env)
            if code != 0:
                raise StepError(f"{step.name}: exited with code {code}. {HINTS.get(step.name, '')}")
            if step.name in AFTER:
                AFTER[step.name](stage)
    except StepError as e:
        print(f"\nFAILED at {e}", file=sys.stderr)
        print("Nothing in submission/ or derived/ was changed"
              + (" (online calls may have filled the caches in runs/raw/ and derived/census/)" if online else "")
              + ".", file=sys.stderr)
        return 1

    print("\n== summary")
    for line in summary(stage, skip_extract, check):
        print(line)
    rels = outputs(stage, skip_extract)
    if check:
        report, bad = compare(root, stage, rels)
        print("\n== check: regenerated outputs vs the repo")
        print("\n".join(report))
        if bad:
            print(f"FAIL: {bad} generated files differ from the repo (A2). Run "
                  "`uv run python -m realrent.pipeline` and commit the result.")
            return 1
        same = sum(line.startswith("same") for line in report)
        print(f"OK: regenerating changes none of the {same} compared files (A2).")
        return 0
    written = promote(root, stage, rels, skip_extract)
    print("\n== wrote")
    print("\n".join(f"  {rel}" for rel in written))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="python -m realrent.pipeline",
        description="Run extract -> resolve -> lookups -> changes -> validate. Offline by default: rules "
                    "from runs/raw/, jurisdictions from derived/census/, no model key, no network.")
    ap.add_argument("--online", action="store_true",
                    help="allow model calls for documents without cached output (needs ANTHROPIC_API_KEY) "
                         "and live Census geocoding")
    ap.add_argument("--skip-extract", action="store_true",
                    help="keep the committed submission/rules.json instead of rebuilding it")
    ap.add_argument("--check", action="store_true",
                    help="regenerate into a temporary folder and fail if any committed file in submission/ "
                         "or derived/ would change; writes nothing. Lookups and change results are compared "
                         "once committed (skipped while they are the `validate --init` placeholders)")
    args = ap.parse_args(argv)
    if args.check and args.online:
        ap.error("--check is offline only: it verifies that the committed caches reproduce the outputs")
    return run(online=args.online, skip_extract=args.skip_extract, check=args.check)


if __name__ == "__main__":
    sys.exit(main())
