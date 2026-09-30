# outgun
Outgunned TTRPG Resources

## Homebrew website

The website uses **Hugo 0.167.0**, **Tailwind CSS 4**, and the Tailwind
Typography plugin. All CSS is compiled locally by Hugo's `css.TailwindCSS`
pipeline; the browser needs no JavaScript or third-party font/CDN requests.

```sh
mise install hugo node
npm ci
mise exec -- npm run dev
mise exec -- npm run check
```

`npm run dev` starts Hugo with live reload on port 1313. `npm run build`
writes the production site to `public/`. The check verifies local links,
anchors, assets, the GitHub Pages subpath, and exclusion of source books.

- **Write:** `site/content/_index.md` is the kitchen-sink homepage. Add other
  Markdown pages under `site/content/`; `site/layouts/page.html` renders them.
- **Style:** `site/assets/css/main.css` holds Tailwind theme tokens and prose
  styles. Hugo's build statistics discover classes in rendered Markdown and templates.
- **Images:** put publishable images in `site/static/images/`, referenced with
  Hugo's `relURL` in templates. For Hugo resizing or page bundles, put images in
  `site/assets/` or beside a bundle's `index.md` and use Hugo resource processing.
- **Components:** `note`, `details`, and `mark` shortcodes work inside Markdown;
  `toolkit` supplies the demonstration cards. Examples are in the homepage.
- **Fonts:** local WOFF2 subsets of Barlow Condensed and Source Sans 3 from
  Fontsource, with their SIL Open Font Licenses in `site/static/fonts/`.

The theme references the Adventure standalone book's cover and printed pages
13 and 29 (PDF pages 1, 15, and 31): parchment, cartographic detail, condensed
type, and brown side panels. The map and paper SVGs are original site assets.
Neither the source PDFs nor `html/` is copied into the published site.

### GitHub Pages

In repository **Settings → Pages**, select **GitHub Actions** as the source.
After the changes are pushed to `main`, `.github/workflows/pages.yml` builds,
checks, and deploys only `public/`. It can also be run manually. The default URL
is `https://advdv.github.io/outgun/`; the workflow takes the actual base URL
from GitHub Pages, including custom domains. No deployment has been performed
as part of the initial local setup.

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
