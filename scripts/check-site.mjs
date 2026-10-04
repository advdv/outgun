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
for (const page of ['index.html', 'kitchen-sink/index.html', 'character-builder/index.html']) {
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
const specimen = readFileSync('public/kitchen-sink/index.html', 'utf8');
assert(specimen.includes('<mark>'), 'Highlight shortcode did not render');
assert(specimen.includes('<details') && specimen.includes('<table'), 'Missing specimen components');
assert(!html.includes('Lorem ipsum') && !html.includes('<aside') && !html.includes('<details'), 'Homepage still contains specimen content');
assert.equal((html.match(/<h1\b/g) || []).length, 1, 'Landing page must have one title');
assert(html.includes('A New Adventure') && html.includes('Historical Timeline') && html.includes('Creating your Adventurer'), 'Missing landing content');
assert.equal((html.match(/<h2\b/g) || []).length, 4, 'Missing landing sections');
assert(!html.includes('Before you create an Adventurer'), 'Removed preparation section still present');
const timeline = html.match(/<ul>([\s\S]*?)<\/ul>/)?.[1];
assert(timeline, 'Missing historical timeline');
assert.equal((timeline.match(/<li\b/g) || []).length, 10, 'Preserve nine dates plus the conference invitation');
assert(timeline.indexOf('1929:') < timeline.indexOf('conference-ticket') && timeline.indexOf('conference-ticket') < timeline.indexOf('1933:'), 'Invitation must be between 1929 and 1933');
assert(/datetime=["']?1932-08/.test(timeline) && timeline.includes('London'), 'Missing conference date or location');
assert(timeline.includes('International Union of Prehistoric and Protohistoric Sciences') && timeline.includes('You are invited') && timeline.includes('Campaign opening'), 'Missing conference invitation content');
assert(html.indexOf('Creating your Adventurer') < html.indexOf('/images/adventure/expedition-chest.webp'), 'Chest must be in the creation section');
const creation = html.slice(html.indexOf('Creating your Adventurer'), html.indexOf('Illustrations by Daniela Giubellini'));
assert(creation.includes('on-screen guide') && !creation.includes('<ol>'), 'Landing instructions must defer to the sheet guide, not repeat its steps');
assert(creation.includes('saves in this browser') && creation.includes('Export backup') && creation.includes('Print / save PDF'), 'Keep the short save, backup, and print guidance');
assert(!creation.includes('does not store your sheet'), 'Outdated saving warning must not return');
for (const image of ['dart-trap', 'explorer', 'expedition-chest']) {
  assert(attributes.some(value => value.endsWith(`/images/adventure/${image}.webp`)), `Missing landing illustration: ${image}`);
}
assert(html.includes('Daniela Giubellini'), 'Missing illustration credit');
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
