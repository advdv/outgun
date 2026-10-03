import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IDENTITY_CHOICES, ITEM_CHOICES, adventurePageUrl, referencePages } from '../site/assets/character-sheet/model.ts';

const html = readFileSync('public/index.html', 'utf8');
const base = new URL(process.env.HUGO_BASEURL || 'https://advdv.github.io/outgun/');
const pageAttributes = source => [...source.matchAll(/(?:href|src|data-artwork)=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)]
  .map(match => match[1] || match[2] || match[3]);
const attributes = pageAttributes(html);
let checked = 0;
const stylesheets = new Set();
for (const page of ['index.html', 'character-builder/index.html']) {
  const source = readFileSync(join('public', page), 'utf8');
  const pageUrl = new URL(page, base);
  for (const value of pageAttributes(source)) {
    const url = new URL(value, pageUrl);
    if (url.origin !== base.origin) continue;
    assert(url.pathname.startsWith(base.pathname), `Escapes Pages base path: ${value}`);
    let file = url.pathname.slice(base.pathname.length);
    if (!file || file.endsWith('/')) file += 'index.html';
    assert(existsSync(join('public', file)), `Missing local asset: ${value}`);
    if (url.hash && file.endsWith('.html')) {
      const target = readFileSync(join('public', file), 'utf8');
      const ids = new Set([...target.matchAll(/\bid=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)]
        .map(match => match[1] || match[2] || match[3]));
      assert(ids.has(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${value}`);
    }
    if (file.endsWith('.css')) stylesheets.add(url.href);
    checked++;
  }
}
const cssPath = attributes.find(value => value.endsWith('.css'));
assert(cssPath, 'Missing compiled stylesheet');
const css = readFileSync(join('public', new URL(cssPath, base).pathname.slice(base.pathname.length)), 'utf8');
assert(css.includes('.grid') && css.includes('.prose'), 'Missing Tailwind utilities or typography');
for (const stylesheet of stylesheets) {
  const text = readFileSync(join('public', new URL(stylesheet).pathname.slice(base.pathname.length)), 'utf8');
  for (const match of text.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^\)]+))\)/g)) {
    const value = match[1] || match[2] || match[3];
    if (value.startsWith('data:')) continue;
    const url = new URL(value, stylesheet);
    assert(url.pathname.startsWith(base.pathname), `CSS asset escapes Pages base: ${value}`);
    assert(existsSync(join('public', url.pathname.slice(base.pathname.length))), `Missing CSS asset: ${value}`);
  }
}
assert(html.includes('<mark>'), 'Highlight shortcode did not render');
assert(html.includes('<details') && html.includes('<table'), 'Missing specimen components');
assert(attributes.some(value => value.endsWith('/character-builder/')), 'Missing homepage builder link');
const builder = readFileSync('public/character-builder/index.html', 'utf8');
assert(builder.includes('data-artwork=') && /<script[^>]+type=.?module/.test(builder), 'Builder app not mounted');
assert(!html.includes('<script'), 'React should only load on the builder page');
const bookAttribute = builder.match(/\bdata-book-pages=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/);
assert(bookAttribute, 'Missing rulebook image base URL');
const bookUrl = new URL(bookAttribute[1] || bookAttribute[2] || bookAttribute[3], base);
assert(bookUrl.origin === base.origin && bookUrl.pathname.startsWith(base.pathname), 'Rulebook images escape Pages base path');
const bookDir = join('public', bookUrl.pathname.slice(base.pathname.length));
const manifest = JSON.parse(readFileSync(join(bookDir, 'manifest.json'), 'utf8'));
assert.equal(manifest.pageCount, 262, 'Adventure image catalog must include every PDF page');
assert.equal(manifest.printedPageOffset, 2);
assert.equal(readdirSync(bookDir).filter(file => file.endsWith('.webp')).length, manifest.pageCount);
for (let page = 1; page <= manifest.pageCount; page++) {
  const file = join(bookDir, `page-${String(page).padStart(4, '0')}.webp`);
  const image = readFileSync(file);
  assert(image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP',
    `Missing WebP data (possibly an unresolved Git LFS pointer): ${file}`);
}
for (const [field, choices] of Object.entries({ ...IDENTITY_CHOICES, ...ITEM_CHOICES })) {
  for (const [, first] of choices) {
    for (const page of referencePages(field, first)) {
      const imageUrl = new URL(adventurePageUrl(page, bookUrl.href));
      assert(existsSync(join('public', imageUrl.pathname.slice(base.pathname.length))), `Missing page image: ${imageUrl}`);
    }
  }
}
const files = readdirSync('public', { recursive: true });
assert(!files.some(file => /\.pdf$|page-\d+\.md$|(^|\/)html\//.test(file)), 'Source books leaked into output');
console.log(`PASS: ${checked} local links/assets, ${manifest.pageCount} rulebook WebPs, all panel citations, Pages base path, and source PDF/text exclusion`);
