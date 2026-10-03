# outgun
Outgunned TTRPG Resources

## Homebrew website

The website uses **Hugo 0.167.0**, **Tailwind CSS 4**, and the Tailwind
Typography plugin. All CSS is compiled locally by Hugo's `css.TailwindCSS`
pipeline. Content pages need no JavaScript; the editable character sheet uses
React, bundled locally with Hugo's `js.Build`. No third-party font/CDN requests
are needed.

```sh
mise install hugo node
npm ci
mise exec -- npm run dev
mise exec -- npm run check
```

`npm run dev` starts Hugo with live reload on port 1313. `npm run build`
writes the production site to `public/`. The check runs TypeScript validation,
character-data tests, and checks for local links, anchors, assets, the GitHub
Pages subpath, and exclusion of source books.

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
type, and brown side panels. The general site's map and paper SVGs are original
assets; the character sheet reuses artwork from the supplied original sheet.
Neither the source PDFs nor `html/` is copied into the published site.

### Editable character sheet

Open `/character-builder/` from the homepage. This is a manual-entry sheet,
not yet a rules-guided character builder. Text, ratings, trackers, and a portrait
save in this browser only. Export/import a JSON backup to transfer a character
or protect against cleared browser storage. No account or server storage is used.

The sheet stays **297 × 210 mm (A4 landscape)** in both screen and print styles.
Fit width scales the whole page; 100% allows horizontal scrolling on small
screens. Print / Save PDF prints only the sheet. Choose A4 landscape, no margins,
100% scale, and no browser headers/footers. Text that exceeds its writing area
is flagged before printing rather than silently changing the layout.

React and TypeScript live in `site/assets/character-sheet/`; Hugo builds the
bundle only for this page, without a separate Vite server. The backdrop is one
SVG containing the adapted layout, original map/paper textures, logo, backpack,
and outlined display lettering. Regenerate it after layout changes with:

```sh
uv run scripts/create_simplified_sheet.py --web-backdrop site/static/sheet/sheet.svg
```

This prototype contains adapted Two Little Mice character-sheet artwork;
confirm redistribution permission before a public release. In an Amp orb,
`amp orb services ensure` starts the supervised Hugo server and prints portal
links for the builder and homepage. The builder sends `X-Amp-Review-Widget: off`
to prevent the portal's feedback button from appearing in printed output.
Portal reviews remain enabled on the homepage.

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
