#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pymupdf4llm==1.28.2", "pymupdf==1.28.2", "pymupdf-layout==1.28.2", "markdown==3.11", "bleach==6.3.0"]
# ///
"""Convert repository PDFs to agent-readable HTML; optionally preview random pages."""

import argparse
import html
import json
from pathlib import Path
import random
import shutil
import time
from urllib.parse import quote

import bleach
import markdown
import pymupdf
import pymupdf4llm


CSS = """
body { margin: 0; color: #202b32; background: #f4f2ed;
       font: 17px/1.65 system-ui, sans-serif; }
main { max-width: 1400px; padding: 32px; margin: auto; }
a { color: #075c79; } h1, h2, h3 { line-height: 1.25; }
header { border-bottom: 2px solid #c8c5bc; margin-bottom: 24px; }
.meta { color: #52616a; font-size: 14px; overflow-wrap: anywhere; }
section { background: white; padding: 24px; margin: 24px 0; border: 1px solid #ddd; }
.comparison { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; }
.text { max-width: 80ch; overflow-wrap: anywhere; }
img { width: 100%; height: auto; border: 1px solid #ddd; }
figure { margin: 0; } summary { cursor: pointer; font-weight: bold; }
table { border-collapse: collapse; display: block; overflow-x: auto; }
td, th { border: 1px solid #ccc; padding: 6px 10px; }
pre { white-space: pre-wrap; } li { margin: 8px 0; }
@media (max-width: 800px) { main { padding: 16px; } .comparison { grid-template-columns: 1fr; } }
"""


def document(title, body):
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{html.escape(title)}</title><style>{CSS}</style></head>'
        f'<body><main>{body}</main></body></html>'
    )


def extract(pdf, page, force_ocr=False):
    return pymupdf4llm.to_markdown(
        pdf, pages=[page], use_ocr=True, force_ocr=force_ocr,
        ocr_language="eng", ocr_dpi=300, write_images=False,
        header=True, footer=True,
    )


def render(text):
    # The extractor emits <br> and <sup> inside tables. Keep those, but do not
    # allow PDF-supplied scripts, event handlers, or unsafe link protocols.
    converted = markdown.markdown(text, extensions=["tables", "fenced_code"])
    return bleach.clean(
        converted,
        tags={"p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em",
              "ul", "ol", "li", "blockquote", "pre", "code", "hr", "br",
              "sup", "sub", "table", "thead", "tbody", "tr", "th", "td", "a"},
        attributes={"a": ["href", "title"]}, strip=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, default=Path("html"))
    parser.add_argument("--sample", type=int, help="Random pages per PDF instead of all pages")
    parser.add_argument("--seed", type=int, default=20260927)
    parser.add_argument("--preview", action="store_true", help="Include source-page images")
    parser.add_argument("--compare-ocr", action="store_true", help="Also force OCR (sample only)")
    args = parser.parse_args()
    if args.sample is not None and args.sample < 1:
        parser.error("--sample must be positive")
    if args.compare_ocr and args.sample is None:
        parser.error("--compare-ocr requires --sample")
    if not shutil.which("tesseract"):
        parser.error("Install OCR first: sudo apt-get install tesseract-ocr tesseract-ocr-eng")
    root, output = args.root.resolve(), args.output.resolve()
    pdfs = sorted(p for p in root.rglob("*.pdf") if not any(
        part.startswith(".") for part in p.relative_to(root).parts
    ) and not p.is_relative_to(output))
    if not pdfs:
        parser.error(f"No PDFs found under {root}")
    if output.exists() and any(output.iterdir()):
        parser.error("Output directory must be empty; use a new path to preserve earlier results")
    output.mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    manifest = {"sample_per_pdf": args.sample, "seed": args.seed, "documents": []}
    links = []
    for source in pdfs:
        relative = source.relative_to(root)
        target = output / relative.with_suffix("")
        target.mkdir(parents=True, exist_ok=True)
        records, sections = [], []
        with pymupdf.open(source) as pdf:
            pages = sorted(rng.sample(range(len(pdf)), min(args.sample, len(pdf)))) if args.sample else range(len(pdf))
            for page in pages:
                started = time.monotonic()
                text = extract(pdf, page)
                number = page + 1
                native_chars = len(pdf[page].get_text().strip())
                print(f"{relative}: PDF page {number}/{len(pdf)} — {len(text)} extracted characters", flush=True)
                (target / f"page-{number:04}.md").write_text(text, encoding="utf-8")
                content = f'<div class="text">{render(text) or "<p>No text detected.</p>"}</div>'
                if args.preview:
                    image = f"page-{number:04}.jpg"
                    pdf[page].get_pixmap(dpi=120).save(target / image)
                    content = (
                        f'<div class="comparison"><figure><a href="{image}">'
                        f'<img src="{image}" loading="lazy" alt="Original PDF page {number}"></a>'
                        '<figcaption>Original page · click to enlarge</figcaption></figure>'
                        f'<div><h3>Extracted HTML · automatic OCR fallback</h3>{content}</div></div>'
                    )
                if args.compare_ocr:
                    ocr = extract(pdf, page, force_ocr=True)
                    (target / f"page-{number:04}-ocr.md").write_text(ocr, encoding="utf-8")
                    content += f'<details><summary>Compare forced Tesseract OCR</summary><div class="text">{render(ocr)}</div></details>'
                records.append({"pdf_page": number, "native_characters": native_chars,
                                "markdown_characters": len(text), "seconds": round(time.monotonic() - started, 2)})
                sections.append(
                    f'<section id="page-{number}" data-pdf-page="{number}"><h2>PDF page {number}</h2>'
                    f'<p class="meta">{native_chars:,} native characters · {len(text):,} extracted Markdown characters · '
                    f'<a href="page-{number:04}.md">Raw Markdown</a></p>{content}</section>'
                )
            manifest["documents"].append({"source": str(relative), "total_pages": len(pdf), "pages": records})
        home = "../" * len(relative.with_suffix("").parts) + "index.html"
        title = source.stem.replace("-", " ")
        toc = " · ".join(f'<a href="#page-{r["pdf_page"]}">{r["pdf_page"]}</a>' for r in records)
        body = (
            f'<header><a href="{home}">← All documents</a><h1>{html.escape(title)}</h1>'
            f'<p class="meta">Source: {html.escape(str(relative))}. Page numbers are 1-based PDF positions, '
            'not necessarily printed page numbers.</p>'
            f'<nav aria-label="Pages">Pages: {toc}</nav></header>' + "".join(sections)
        )
        (target / "index.html").write_text(document(title, body), encoding="utf-8")
        href = quote((relative.with_suffix("") / "index.html").as_posix())
        links.append(f'<li><a href="{href}">{html.escape(title)}</a> <span class="meta">— PDF pages {", ".join(str(r["pdf_page"]) for r in records)}</span></li>')
    mode = f"Random sample · seed {args.seed}" if args.sample else "Complete conversion"
    body = (
        f'<header><p class="meta">OUTGUNNED / PDF TEXT LIBRARY</p><h1>Agent-readable rulebooks</h1><p>{mode}</p></header>'
        '<p>Static HTML with real headings, paragraphs and tables. No JavaScript or PDF reader required. '
        'PyMuPDF4LLM preserves digital text and uses local Tesseract OCR when needed.</p>'
        '<p>Extraction is not authoritative: decorative text, dice symbols, form marks and complex tables '
        'may be omitted or misread. Check the original PDF for exact rules and character ratings.</p>'
        f'<ul>{"".join(links)}</ul><p><a href="manifest.json">Conversion manifest</a></p>'
    )
    (output / "index.html").write_text(document("Outgunned PDF text library", body), encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {sum(len(d['pages']) for d in manifest['documents'])} pages to {output}")


if __name__ == "__main__":
    main()
