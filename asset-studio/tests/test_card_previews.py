import hashlib
import io
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

from PIL import Image
from app.card_previews import BOARD_SOURCE, LEGACY_BOARD_SOURCE, add_to_archive, is_public_card, is_preview_source, make_preview, preview_for


class CardPreviewTests(unittest.TestCase):
    def image_bytes(self, size):
        output = io.BytesIO()
        Image.effect_noise(size, 64).convert("RGB").save(output, "JPEG", quality=95)
        return output.getvalue()

    def test_preview_resizes_without_modifying_zoom_bytes(self):
        raw = self.image_bytes((2400, 1800))
        preview = make_preview(raw)
        self.assertIsNotNone(preview)
        self.assertLess(len(preview), len(raw))
        self.assertEqual(Image.open(io.BytesIO(preview)).size, (1600, 1200))
        self.assertEqual(Image.open(io.BytesIO(raw)).size, (2400, 1800))

    def test_small_images_and_invalid_images_need_no_sidecar(self):
        self.assertIsNone(make_preview(self.image_bytes((800, 600))))
        self.assertIsNone(make_preview(b"not an image"))
        self.assertFalse(is_public_card("aibp/ps/other/private/secret.jpg"))
        self.assertFalse(is_public_card("aibp/ps/TITAN_X/TITAN_X.jpg.preview.jpg"))

    def test_board_thumbnail_is_smaller_and_always_available_even_for_small_originals(self):
        for size, expected in [((2400, 1800), (1024, 768)), ((800, 600), (800, 600))]:
            raw = self.image_bytes(size)
            preview = preview_for(BOARD_SOURCE, raw)
            self.assertIsNotNone(preview)
            self.assertEqual(Image.open(io.BytesIO(preview)).size, expected)
            self.assertEqual(Image.open(io.BytesIO(raw)).size, size)
        self.assertTrue(is_preview_source(BOARD_SOURCE))
        self.assertFalse(is_preview_source(BOARD_SOURCE + ".preview.jpg"))
        self.assertFalse(is_preview_source("ss/private.jpg"))

    def test_board_archive_includes_thumbnail_with_original_hash(self):
        raw = self.image_bytes((1800, 1800))
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr(BOARD_SOURCE, raw)
            entries = []
            add_to_archive(archive, BOARD_SOURCE, raw, entries)
            self.assertEqual(archive.read(BOARD_SOURCE), raw)
            self.assertEqual(entries[0]["sourceSha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(Image.open(io.BytesIO(archive.read(BOARD_SOURCE + ".preview.jpg"))).size, (1024, 1024))

    def test_generator_migrates_old_board_and_preserves_existing_new_board(self):
        spec = importlib.util.spec_from_file_location("aibp_preview_generator",
            Path(__file__).resolve().parents[2] / "tools/generate_aibp_previews.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            legacy = root / LEGACY_BOARD_SOURCE
            legacy.parent.mkdir()
            raw = self.image_bytes((1800, 1200))
            legacy.write_bytes(raw)
            generator.generate(root)
            board = root / BOARD_SOURCE
            preview = board.with_name(board.name + ".preview.jpg")
            self.assertEqual(board.read_bytes(), raw)
            self.assertEqual(legacy.read_bytes(), raw)
            with Image.open(preview) as image:
                self.assertEqual(image.size, (1024, 683))
            board.write_bytes(self.image_bytes((800, 600)))
            generator.generate(root)
            with Image.open(board) as image:
                self.assertEqual(image.size, (800, 600))
            with Image.open(preview) as image:
                self.assertEqual(image.size, (800, 600))

    def test_old_board_install_targets_use_the_new_directory(self):
        from app.installer import installable_relative
        self.assertEqual(installable_relative(LEGACY_BOARD_SOURCE), BOARD_SOURCE)
        self.assertEqual(installable_relative(LEGACY_BOARD_SOURCE + ".preview.jpg"), BOARD_SOURCE + ".preview.jpg")

    def test_archive_links_preview_to_the_exact_packed_original(self):
        target = "aibp/ps/TITAN_X/TITAN_X.jpg"
        raw = self.image_bytes((2400, 1800))
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr(target, raw)
            entries = []
            add_to_archive(archive, target, archive.read(target), entries)
        with zipfile.ZipFile(output) as archive:
            self.assertEqual(archive.read(target), raw)
            entry = entries[0]
            self.assertEqual(entry["sourceSha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(entry["sha256"], hashlib.sha256(archive.read(entry["target"])).hexdigest())
