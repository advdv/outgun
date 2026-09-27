# outgun
Outgunned TTRPG Resources

## Agent-readable HTML

`scripts/pdf_to_html.py` recursively converts PDFs into static HTML, with one
document per source PDF, stable `#page-N` anchors (1-based PDF page positions),
per-page Markdown, and a JSON manifest. It uses local PyMuPDF4LLM layout analysis
and Tesseract OCR fallback; no documents are sent to an external API.

Run once in the orb (Python dependencies are pinned in the script and installed
automatically by `uv`):

```sh
sudo apt-get update && sudo apt-get install -y tesseract-ocr tesseract-ocr-eng
uv run scripts/pdf_to_html.py --output html
```

Agents can read `html/index.html`, follow the document links, or search the
per-page Markdown directly. Keep the generated directory if you want future
agents to avoid processing the PDFs again. The output directory must be empty.

The `html/` directory mirrors the source paths, replacing each `.pdf` with a
directory of the same name:

```text
html/
├── index.html
├── manifest.json
├── outgunned-core-rulebook-en/
│   ├── index.html
│   ├── page-0001.md
│   └── …
└── outgunned-adventure-sheets-en/
    └── outgunned-adventure-adventurer-sheet-blank-en/
        ├── index.html
        └── page-0001.md
```

To evaluate a reproducible random page from each PDF before a full conversion:

```sh
uv run scripts/pdf_to_html.py --sample 1 --seed 20260927 \
  --preview --compare-ocr --output .amp/in/artifacts/pdf-preview
```

The preview places original page images beside the extracted HTML and includes
an expandable forced-OCR comparison. Single-page sheets are always included.
OCR can introduce stray characters from artwork; character-sheet rating marks,
custom dice symbols, and complex table relationships are not reliably preserved.
Use the original PDF to verify those details. The HTML is a text reference, not a
pixel-perfect replacement for the books. Generated copyrighted material should
remain within the same access scope as the source PDFs.
