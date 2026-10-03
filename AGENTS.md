# Sources

- `./html` contains extracted HTML and per-page Markdown from the Outgunned rulebooks and sheets.
- Ground responses in `./html`; inspect raw source files only when explicitly asked.

# Game Rules

When asked about game rules, ground answers in quotes from the extracted text in `./html`. Include the page number and the name of the source book for each quote.

# Character Sheet and Website

- Keep the sheet A4 landscape (297 × 210 mm). Browser and print share one layout; narrow screens scale or scroll, never rearrange fields.
- React is bundled by Hugo's `js.Build`; no separate Vite server is needed. Run checks with `mise exec -- npm run check`.
- Edit artwork in `scripts/create_simplified_sheet.py`, then regenerate `site/static/sheet/sheet.svg` using `--web-backdrop`. Don't hand-edit the generated SVG; keep artwork coordinates aligned with React controls.
- Preserve the approved omissions: Treasure, Experiences, Spotlight, conditions, Death Roulette, and Bad. Keep Hot, the backpack behind its writing panel, and no brown right-edge strip.
- Keep print layout in normal flow. Fixed positioning caused a reported Safari offset; exact full-page flow height can create an extra page. Preserve the 1px bottom rounding allowance below all content.
- Verify actual PDFs with uploaded portraits, filled trackers, multiline text, bottom fields, and scrolling—not just blank sheets. Check page count, clipping, and artwork alignment. Chromium or Linux WebKit success does not establish native Safari compatibility.
- Keep the logo clear of the populated portrait, not merely the blank frame. Reload after regenerating artwork before inspecting captures.
- Preserve `X-Amp-Review-Widget: off` on the builder: the injected portal feedback control appeared in printed output.
- Keep the portal server's `--renderToMemory`; otherwise production checks can overwrite preview files and break asset URLs. Start previews with `amp orb services ensure`.

# Git

- Always commit directly to `main`; never create pull requests.
