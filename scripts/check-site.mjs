import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
const files = readdirSync('public', { recursive: true });
assert(!files.some(file => /\.pdf$|page-\d+\.md$|(^|\/)html\//.test(file)), 'Source books leaked into output');
console.log(`PASS: ${checked} local links/assets across homepage and builder, CSS assets, Pages base path, and source-book exclusion`);
