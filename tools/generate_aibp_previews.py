"""Generate local AIBP display images without modifying originals.

Run after adding/replacing card images: python tools/generate_aibp_previews.py
Resource pack exporters also generate these previews automatically.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "asset-studio"))
from app.card_previews import BOARD_SOURCE, LEGACY_BOARD_SOURCE, is_preview_source, preview_for


def generate(root: Path) -> dict:
    board = root / BOARD_SOURCE
    legacy = root / LEGACY_BOARD_SOURCE
    if not board.exists() and legacy.is_file() and not legacy.is_symlink():
        board.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(legacy, board)
    stats = {"generated": 0, "unchanged": 0, "originalBytes": 0, "previewBytes": 0}
    sources = [*(root / "aibp/ps").glob("**/*"), root / BOARD_SOURCE]
    for source in sorted(sources):
        target = source.relative_to(root).as_posix()
        if not source.is_file() or source.is_symlink() or not is_preview_source(target):
            continue
        preview = source.with_name(source.name + ".preview.jpg")
        if preview.is_file() and preview.stat().st_mtime_ns >= source.stat().st_mtime_ns:
            stats["unchanged"] += 1
            continue
        raw = source.read_bytes()
        small = preview_for(target, raw)
        if small is None:
            # A replacement may no longer need a preview; don't retain the old face.
            if preview.is_file():
                preview.unlink()
            continue
        staging = preview.with_name(preview.name + ".partial")
        staging.write_bytes(small)
        staging.replace(preview)
        stats["generated"] += 1
        stats["originalBytes"] += len(raw)
        stats["previewBytes"] += len(small)
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    import json
    print(json.dumps(generate(args.root.resolve()), ensure_ascii=False))
