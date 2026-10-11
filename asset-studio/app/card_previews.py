"""Small AIBP display images; original bytes remain available for zooming."""
from __future__ import annotations

import hashlib
import io
import re

MAX_EDGE = 1600
QUALITY = 86
BOARD_SOURCE = "ss/battle-board/battle-board.jpg"
LEGACY_BOARD_SOURCE = "ss/battle-board.jpg"
PUBLIC_CARD = re.compile(r"aibp/ps/(?:[A-Z][A-Z0-9_]+|other|other/trait)/[^/]+\.(?:jpg|jpeg|png)$", re.I)


def canonical_board_path(target: str) -> str:
    if target in (LEGACY_BOARD_SOURCE, LEGACY_BOARD_SOURCE + ".preview.jpg"):
        return BOARD_SOURCE + target[len(LEGACY_BOARD_SOURCE):]
    return target


def is_public_card(target: str) -> bool:
    return bool(PUBLIC_CARD.fullmatch(target)) and not target.endswith(".preview.jpg")


def is_preview_source(target: str) -> bool:
    return is_public_card(target) or target == BOARD_SOURCE


def make_preview(raw: bytes, *, max_edge: int = MAX_EDGE, quality: int = QUALITY,
                 always: bool = False) -> bytes | None:
    # Pillow is optional for exporters used without the image toolkit.
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return None
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if not always and max(image.size) <= max_edge:
                return None
            image = ImageOps.exif_transpose(image)
            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                background = Image.new("RGB", image.size, "white")
                rgba = image.convert("RGBA")
                background.paste(rgba, mask=rgba.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
            output = io.BytesIO()
            image.save(output, "JPEG", quality=quality, optimize=True)
            preview = output.getvalue()
            return preview if always or len(preview) < len(raw) else None
    except (OSError, ValueError):
        return None


def preview_for(target: str, raw: bytes) -> bytes | None:
    if target == BOARD_SOURCE:
        # AIBP uses only this thumbnail; the second screen retains the original.
        return make_preview(raw, max_edge=1024, quality=82, always=True)
    return make_preview(raw) if is_public_card(target) else None


def add_to_archive(archive, target: str, raw: bytes, entries: list[dict]) -> None:
    if not is_preview_source(target):
        return
    if target + ".preview.jpg" in archive.namelist():
        return
    preview = preview_for(target, raw)
    if preview is None:
        return
    member = target + ".preview.jpg"
    archive.writestr(member, preview)
    entries.append({
        "source": target, "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "target": member, "member": member, "bytes": len(preview),
        "sha256": hashlib.sha256(preview).hexdigest(), "mimeType": "image/jpeg",
    })
