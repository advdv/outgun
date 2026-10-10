# outgun
Outgunned TTRPG Resources

## Homebrew website

The website uses **Hugo 0.167.0**, **Tailwind CSS 4**, and the Tailwind
Typography plugin. All CSS is compiled locally by Hugo's `css.TailwindCSS`
pipeline. Content pages need no JavaScript; the editable character sheet uses
React, bundled locally with Hugo's `js.Build`. No third-party font/CDN requests
are needed.

```sh
git lfs install
git lfs pull --include="site/static/books/adventure/*.webp" --exclude=""
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

Open `/character-builder/` from the homepage. Role and trope selections grant
their attribute/skill points automatically; clearing or switching a selection
removes only its grants. Choose the trope's attribute in its panel; the role's
attribute cannot also receive the trope point. The gear catalog includes the
Star's precious item and the Professor's diary and pencil, cited to their role pages.

Brown diamonds are starting/role/trope points; blue diamonds with a pale center
are manual additions. Click an empty diamond to add manual points, or a blue
diamond to remove them. Totals cap at 3. Manual points are never discarded when
grants overlap them: they stay blue and an overlap notice appears below the sheet.
Free-point budgets are not enforced. Resources, feats, and gear remain manual selections.

Version 2 backups store manual additions separately from the derived totals.
Version 1 drafts/backups are migrated with all non-baseline points preserved as
manual additions; the old format cannot identify which were intended as role bonuses.
Text, ratings, trackers, and a portrait save in this browser only.
Export/import a JSON backup to transfer a character
or protect against cleared browser storage. No account or server storage is used.

Both sheets stay **297 × 210 mm (A4 landscape)** on screen and in print.
The second page updates with the selected feats, guns, and gear, using the full
book text from the reference catalog below. Duplicate selections and shared
equipment traits appear once. Role-only items or custom legacy entries without
catalog rules retain their names without inventing rules. The six feat and six
gear slots fit on one reference page, including the longest descriptions and
all twelve equipment traits, at fixed 9.5pt body type.

Both pages scale together and scroll horizontally on narrow screens; their
fields never rearrange. **Print both pages / save PDF** prints the main sheet
followed by the selected reference. Choose A4 landscape, all pages, no margins,
100% scale, and no browser headers/footers. Text that exceeds the available
space is flagged before printing rather than silently clipped or shrunk.

```sh
node scripts/character-reference.e2e.mjs <builder-url> [review-artifact-directory]
node scripts/character-guide.e2e.mjs <builder-url> [review-artifact-directory]
```

These check live picker updates, catalog text, card bounds, backups, and actual
two-page PDFs with a portrait, filled trackers, multiline text, and bottom fields.
Desktop, open-panel, and narrow scrolled PDFs must be pixel-identical. Native
Safari and physical printers still require device-specific testing.

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

### Printable player cheat sheet

Open `/player-cheat-sheet/` from the homepage for the compact player rules.
The copy lives in `site/content/player-cheat-sheet.md`; the visual difficulty
table lives in `site/layouts/shortcodes/cheat-difficulty.html`. Its identical
star dice have accessible matching-count labels, not numerical pips.

The page uses static Hugo cards, with a small TypeScript bundle for Fit/100%
zoom and printing. It remains readable and printable without JavaScript.
Screen and print share the same A4 landscape layout, 7 mm safe margins, normal
document flow, and the character sheet's 1px bottom rounding allowance. The
preview disables the portal review widget on this page too.

After `amp orb services ensure`, verify the running page with:

```sh
node scripts/player-cheat-sheet.e2e.mjs <cheat-sheet-url> [review-artifact-directory]
```

This uses `agent-browser` and `uv`/PyMuPDF to verify the landing link, accessible
dice, card bounds, zoom, scrolling, and four actual single-page A4 PDFs. Desktop,
narrow Fit, scrolled 100%, and JavaScript-disabled PDFs must be pixel-identical.
Chromium verification does not establish native Safari compatibility.

### Printable reference sheets

Open `/reference-sheets/` from the homepage. All seven pages stay visible in one
document: Attributes and Skills, three pages of all 42 Feats, and three pages of
guns, ammunition, other weapons, and general gear. Every equipment card repeats
its listed weapon/gear Feat definitions. **Print all 7 pages / save PDF** opens
the browser print dialog; choose **Save as PDF** and **All pages** to download
one seven-page PDF. Browser printing also works without JavaScript.

The page order and column groups live in `site/content/reference-sheets.md`.
`site/assets/reference-sheets.json` contains the extracted book text, generated
from `html/` (printed pp. 51, 53–59, 132–135):

```sh
node scripts/reference-data.mjs --write
node scripts/reference-data.mjs --check
```

The 18 Luck activation markers lost during text extraction were checked against
the site's existing book-page images. They render as small **1 Luck** labels;
the original Feat descriptions, including passive benefits, remain unchanged.
The production check detects catalog drift from the extracted source.

```sh
node scripts/reference-sheets.e2e.mjs <reference-sheets-url> [review-artifact-directory]
```

This exercises the real print button and verifies four seven-page A4 landscape
PDFs: desktop, narrow Fit, scrolled 100% on the last page, and JavaScript disabled.
It checks exact card text, Luck markers, item costs and traits, page order,
card bounds, print margins, exclusion of browser UI, and pixel-identical output
across all four states. Review PNGs are rendered from the actual PDF pages.
The print layout uses normal flow and the same 1px bottom allowance on every
page. Native Safari and physical printers still need device-specific testing.

### Rulebook page viewer

Page references in the selection panels open a full-screen image viewer.
Role references show their two-page spread; other references show one page.
Use **Zoom in** to read at full image resolution and **Fit pages** to see the
whole page/spread. Close or Escape returns to the same picker without selecting
an option. The viewer is excluded from character-sheet printing.

All 262 pages of the Adventure standalone rulebook, including front matter,
are rendered to `site/static/books/adventure/` as WebP images tracked by Git LFS.
Filenames use 1-based PDF positions: printed page 22 is `page-0024.webp`.
The adjacent manifest records the source checksum, page count, and resolution.
Regenerate locally with pinned Python dependencies:

```sh
git lfs pull --include="outgunned-adventure-standalone-genre-book-v1.1-en.pdf" --exclude=""
uv run scripts/render_adventure_pages.py
```

The site now publishes these rendered rulebook images, but still excludes the
source PDFs and extracted text. Confirm permission before a public release.
The Pages workflow fetches only the LFS page images before building; production
checks reject missing images or unexpanded LFS pointers.

The role picker uses head-to-upper-thigh crops of each role's main illustration.
Regenerate these from the existing page renders with `bash scripts/crop-role-art.sh`;
the script records the individual crop coordinates. The 320 × 480 WebPs in
`site/static/images/adventure/roles/` are named for the role's first printed page
and tracked in ordinary Git. They never replace the uploaded portrait or print.

### GitHub Pages

In repository **Settings → Pages**, select **GitHub Actions** as the source.
After the changes are pushed to `main`, `.github/workflows/pages.yml` builds,
checks, and deploys only `public/`. It can also be run manually. The default URL
is `https://advdv.github.io/outgun/`; the workflow takes the actual base URL
from GitHub Pages, including custom domains. No deployment has been performed
as part of the initial local setup.

### Cupboard webcam calibration

Open `/cupboard-sensor/` over HTTPS (or localhost for development), click
**Start camera**, and allow camera access. The page shows mean image brightness,
its rolling 10-second minimum/maximum, and mean absolute pixel lightness change
between samples, all on a 0–100% scale. It samples a 160 × 120 image roughly five
times a second while the tab is visible. No microphone, recording, or uploading
is involved.

Click **Enable music** once per page load to allow browser audio, and wait for
Ready or Playing. The supplied `site/static/audio/raiders-march.mp3` is downloaded
and decoded once using Web Audio. Every START plays from the applied **Start
offset**, never the previous position. The default is **0.06 seconds (60 ms)**,
not 0:06. Enter seconds in steps of 0.01 and click **Apply offset**; this restarts
any playing music. Empty, negative, fractional-step, and past-end values are
rejected without changing the applied offset. Before the track loads, its length
is unknown; an out-of-range offset prevents enabling music until corrected.
Reloading restores the default. Music loops from the offset to the end while
START remains active. STOP immediately stops the source; Disable music silences it without
stopping calibration. Use the Mac's volume controls. Audio interruptions require
clicking Enable music again, and loading/permission failures offer a retry.

Decoding the full track avoids streaming delays after arming, at the cost of
roughly 120 MB of decoded audio memory on the installation laptop. The MP3 is
bundled unchanged and will be publicly downloadable if this site is published;
confirm the necessary music redistribution/performance rights before publishing
or exhibiting. Loading the page offline after a reload is not implemented.

The visual **Music: START / STOP** flag defaults to Start at ≥54% and Stop at
≤52%, assuming brighter means open. These sit between the supplied calibration
graph's approximately 49–50% closed and 56–58% open plateaus, not its brief
39.9%/61.0% extremes. Each crossing must persist for 600 ms; values between the
thresholds retain the previous state. Comparisons use the displayed 0.1% precision.
The flag shows the sensor signal; the separate audio status reports whether
music is enabled and playing.

Edit the numeric thresholds and click **Apply thresholds** to update the solid
graph lines and rearm from STOP. Values must be 0–100% in steps of 0.1, with Stop
below Start; invalid edits leave the applied settings unchanged. Settings are
held only in memory, so reloading restores defaults. Camera stop, mute, a hidden
tab, or a sampling gap longer than one second resets the flag to STOP and stops
playback. Finishing a download after STOP cannot start stale playback.

The brightness graph keeps the last three minutes, with a fixed 0–100% axis and
labeled low/high dashed lines for that visible history (not trigger thresholds).
The time axis starts at 30 seconds and expands to three minutes as samples arrive.
It uses SVG without a charting dependency. Gaps longer than a second are not
joined by a line. **Stop camera** releases the webcam and clears live readings,
but freezes the graph and its low/high marks for inspection. **Reset graph**
clears history and readings without stopping the camera or changing the trigger
state; reloading also clears history. Restarting the camera resumes the rolling window.

Use the optional preview to aim the camera, then close it to keep screen glow
consistent. Reset the graph, then alternate open and closed for 20 seconds each,
three times. Stop the camera to inspect the graph without a screen recording.
Keep the laptop awake and screen brightness fixed. Real Mac/cupboard calibration
is still required; synthetic browser frames cannot establish a usable physical threshold.

```sh
node scripts/cupboard-sensor.e2e.mjs <sensor-url> [review-artifact-directory]
```

This checks the displayed measurements using synthetic video, including spatial
changes with unchanged average brightness, range expiry, graph low/high marks,
freeze/reset behaviour, trigger hysteresis and hold time, configurable thresholds,
and stop/retry behaviour. It captures real browser audio output and compares two
separate openings against the supplied MP3 at the default and a custom fractional
offset, checks validation and silence after STOP, and exercises load failure/retry
and closing the door during loading.
Chromium verification does not establish native Safari or speaker compatibility.

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
