#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf==1.28.2", "pillow==11.3.0"]
# ///
"""Render every Adventure PDF page to the website's Git LFS-backed image catalog."""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image
import pymupdf


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outgunned-adventure-standalone-genre-book-v1.1-en.pdf"
DPI = 216


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "site/static/books/adventure")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(SOURCE) as pdf:
        for index, page in enumerate(pdf):
            pixmap = page.get_pixmap(dpi=DPI, colorspace=pymupdf.csRGB, alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            # Use 1-based PDF positions, including both front-matter pages.
            image.save(args.output / f"page-{index + 1:04d}.webp", quality=90, method=6)
            if (index + 1) % 20 == 0 or index + 1 == len(pdf):
                print(f"Rendered {index + 1}/{len(pdf)} pages", flush=True)
        manifest = {
            "source": SOURCE.name,
            "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "pageCount": len(pdf),
            "printedPageOffset": 2,
            "dpi": DPI,
            "format": "webp",
        }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
