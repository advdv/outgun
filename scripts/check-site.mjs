import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync('public/index.html', 'utf8');
const base = new URL(process.env.HUGO_BASEURL || 'https://advdv.github.io/outgun/');
const attributes = [...html.matchAll(/(?:href|src)=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)]
  .map(match => match[1] || match[2] || match[3]);
const ids = new Set([...html.matchAll(/\bid=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)]
  .map(match => match[1] || match[2] || match[3]));
let checked = 0;
for (const value of attributes) {
  const url = new URL(value, base);
  if (url.origin !== base.origin) continue;
  assert(url.pathname.startsWith(base.pathname), `Escapes Pages base path: ${value}`);
  const file = url.pathname.slice(base.pathname.length) || 'index.html';
  assert(existsSync(join('public', file)), `Missing local asset: ${value}`);
  if (url.hash && file === 'index.html') assert(ids.has(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${value}`);
  checked++;
}
const cssPath = attributes.find(value => value.endsWith('.css'));
assert(cssPath, 'Missing compiled stylesheet');
const css = readFileSync(join('public', new URL(cssPath, base).pathname.slice(base.pathname.length)), 'utf8');
assert(css.includes('.grid') && css.includes('.prose'), 'Missing Tailwind utilities or typography');
for (const match of css.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^\)]+))\)/g)) {
  const value = match[1] || match[2] || match[3];
  if (value.startsWith('data:')) continue;
  const url = new URL(value, new URL(cssPath, base));
  assert(url.pathname.startsWith(base.pathname), `CSS asset escapes Pages base: ${value}`);
  assert(existsSync(join('public', url.pathname.slice(base.pathname.length))), `Missing CSS asset: ${value}`);
}
assert(html.includes('<mark>'), 'Highlight shortcode did not render');
assert(html.includes('<details') && html.includes('<table'), 'Missing specimen components');
const files = readdirSync('public', { recursive: true });
assert(!files.some(file => /\.pdf$|page-\d+\.md$|(^|\/)html\//.test(file)), 'Source books leaked into output');
console.log(`PASS: ${checked} local links/assets, CSS assets, Pages base path, specimen components, and source-book exclusion`);
