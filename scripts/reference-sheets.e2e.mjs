// node scripts/reference-sheets.e2e.mjs <reference-sheets-url> [review-artifact-directory]
// Uses the same agent-browser/CDP and PyMuPDF workflow as the player cheat sheet.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { referenceData } from './reference-data.mjs';

const url = process.argv[2];
assert(url, 'Supply the running reference-sheets URL');
const scratch = mkdtempSync(join(tmpdir(), 'outgun-reference-'));
const artifacts = process.argv[3] ? resolve(process.argv[3]) : scratch;
mkdirSync(artifacts, { recursive: true });
const session = `ref-e2e-${process.pid}`;
const browser = (...args) => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert(response.success, JSON.stringify(response.error));
  return response.data;
};
const evaluate = code => browser('eval', code).result;
const ready = () => evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
const check = (code, message) => assert(evaluate(code), message);
const normalize = text => text.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
const source = referenceData();
const titles = ['Attributes & skills', 'Feats / Archeology — Get Down!', 'Feats / Guide — Quick Fingers',
  'Feats / Reassure — Watch and Learn', 'Guns & ammunition', 'Other weapons', 'General gear'];
const equipmentPages = [
  ['Pistol/Revolver', 'Old Rifle', 'Hunting Rifle', 'Shotgun', 'Machine Gun', 'Gatling Gun', 'Mags (2)', 'Rocket Launcher', 'Projectiles'],
  ['Hunting Bow', 'Knife', 'Boomerang', 'Bow', 'Machete/Axe', 'Whip', 'Dynamite', 'Club/Hammer'],
  ['Elegant Clothes', 'Lockpicking Set', 'Tool-bag', 'First-aid Kit', 'Grappling Hook', 'Rope', 'Compass', 'Winter Clothes', 'Lantern', 'Climbing Gear', 'Camping Cookware', 'Musical Instrument', 'Old Ride', 'Lighter', 'Radio'],
];
const cardBody = card => card.body ?? [card.detail, ...card.traits.map(t => `${t} ${source.gearFeats[t]}`)].join(' ');
const pageCards = [[], source.feats.slice(0, 14), source.feats.slice(14, 28), source.feats.slice(28),
  ...equipmentPages.map(names => names.map(name => source.gear[name]))];
const expected = pageCards.map((cards, index) => ({
  title: titles[index].toUpperCase(),
  cards: cards.map(card => ({ name: card.name, body: normalize(cardBody(card)),
    label: card.luck ? '1 Luck' : card.cost ? card.cost === '—' ? '—' : `${card.cost} Cash` : '' })),
}));
expected[0].text = source.attributes.flatMap(a => [a.name, a.meaning, ...a.skills.flatMap(s => [s.name, s.meaning])]);
writeFileSync(join(scratch, 'expected.json'), JSON.stringify(expected));

const layout = () => evaluate(`Array.from(document.querySelectorAll('.reference-sheet'), sheet => {
  const page = sheet.getBoundingClientRect(), scale = page.width / sheet.offsetWidth;
  return [...sheet.querySelectorAll('.reference-card,.reference-attribute')].map(card => {
    const r = card.getBoundingClientRect();
    return [r.x-page.x, r.y-page.y, r.width, r.height].map(n => Math.round(n/scale));
  });
})`);
const fits = () => check(`Array.from(document.querySelectorAll('.reference-sheet')).every(sheet => {
  const page = sheet.getBoundingClientRect(), scale = page.width/sheet.offsetWidth;
  return [...sheet.querySelectorAll('.reference-card,.reference-attribute')].every(card => {
    const box = card.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(card);
    return box.bottom <= page.bottom-25*scale && box.right <= page.right-25*scale
      && [...range.getClientRects()].every(r => r.left >= box.left-.5 && r.right <= box.right+.5 && r.top >= box.top-.5 && r.bottom <= box.bottom+.5);
  });
})`, 'All card text must fit inside its borders and the paper margins');

let socket;
try {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-amp-review-widget'), 'off');
  browser('open', new URL('../', url).href);
  browser('set', 'viewport', '1280', '1100', '2');
  browser('click', 'main a[href$="/reference-sheets/"]');
  assert.equal(browser('get', 'url').url, url);
  ready();
  assert.deepEqual(evaluate("[...document.querySelectorAll('.reference-page-header h2')].map(e=>e.textContent)"), titles);
  check("document.querySelectorAll('.reference-sheet').length === 7 && [...document.querySelectorAll('.reference-sheet')].every(e=>e.getBoundingClientRect().height>0)", 'All seven pages visible together, not hidden behind tabs');
  check("[...document.querySelectorAll('.reference-sheet')].every(e=>e.offsetWidth===Math.round(297*96/25.4)&&e.offsetHeight===Math.round(210*96/25.4))", 'Every screen canvas is A4 landscape');
  const actualCards = evaluate(`Array.from(document.querySelectorAll('.reference-sheet'), page => [...page.querySelectorAll('.reference-card')].map(card => ({
    name: card.dataset.name, body: card.querySelector('.reference-card-body').innerText,
    label: card.querySelector('.reference-luck,.reference-cost')?.textContent ?? ''
  })))`);
  for (const [page, cards] of actualCards.entries()) {
    assert.deepEqual(cards.map(c => c.name), expected[page].cards.map(c => c.name), `Page ${page + 1}: card order`);
    for (const [i, card] of cards.entries()) {
      assert.deepEqual({ ...card, body: normalize(card.body) }, expected[page].cards[i], `${card.name}: exact text and correct traits/costs`);
    }
  }
  const attributes = evaluate("[...document.querySelectorAll('.reference-attribute h3,.reference-attribute p,.reference-skill h4')].map(e=>e.textContent)");
  assert.deepEqual(attributes, expected[0].text);
  fits();
  const originalLayout = layout();
  browser('screenshot', join(artifacts, 'reference-sheets-screen.png'));
  // Exercise the real print handler, not a stubbed window.print.
  evaluate("window.__beforePrint = 0; addEventListener('beforeprint',()=>window.__beforePrint++)");
  browser('click', '#reference-print');
  browser('wait', '--fn', 'window.__beforePrint > 0');
  console.log('PASS: homepage link; all 7 pages visible; 42 verbatim Feats, 18 Luck markers, all skills and 32 complete item cards; native print event');

  // agent-browser's PDF shortcut defaults to Letter. Honor CSS @page via CDP.
  socket = new WebSocket(browser('get', 'cdp-url').cdpUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetInfos } = await call('Target.getTargets');
  const target = targetInfos.find(t => t.type === 'page' && t.url === url);
  assert(target);
  const { sessionId } = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const print = async name => {
    evaluate('document.fonts.ready');
    const { data } = await call('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false }, sessionId);
    writeFileSync(join(artifacts, `${name}.pdf`), Buffer.from(data, 'base64'));
  };
  await print('reference-sheets');

  browser('set', 'viewport', '390', '844', '2');
  ready();
  check("document.querySelector('.reference-viewport').scrollWidth === document.querySelector('.reference-viewport').clientWidth", 'Fit has no hidden horizontal overflow');
  assert.deepEqual(layout(), originalLayout, 'Narrow Fit scales all seven pages without reflow');
  fits();
  browser('screenshot', join(artifacts, 'reference-sheets-narrow-fit.png'));
  await print('narrow-fit');
  browser('select', '#reference-zoom', 'actual');
  ready();
  assert.deepEqual(layout(), originalLayout, '100% retains desktop geometry');
  evaluate("document.querySelector('.reference-viewport').scrollLeft = 700; document.querySelector('.reference-stage:last-child').scrollIntoView()");
  check("document.querySelector('.reference-viewport').scrollLeft>=650 && window.scrollY>4000", 'Print from the last page with both axes scrolled');
  browser('screenshot', join(artifacts, 'reference-sheets-narrow-scrolled.png'));
  await print('narrow-scrolled');

  await call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  ready();
  fits();
  assert.deepEqual(layout(), originalLayout, 'Print preserves each card position and font size');
  check("[...document.querySelectorAll('.reference-stage')].every(e=>getComputedStyle(e).position!=='fixed') && document.querySelector('.reference-sheet').getBoundingClientRect().x===0", 'Normal-flow printing, with no horizontal scroll offset');
  await call('Emulation.setEmulatedMedia', { media: '' }, sessionId);
  await call('Emulation.setScriptExecutionDisabled', { value: true }, sessionId);
  browser('reload');
  check("document.querySelector('.reference-actions').hidden && [...document.querySelectorAll('.reference-sheet')].every(e=>e.style.transform==='')", 'JavaScript-disabled test is genuinely script-free');
  await print('no-javascript');
  await call('Emulation.setScriptExecutionDisabled', { value: false }, sessionId);

  execFileSync('uv', ['run', '--with', 'pymupdf', 'python', '-c', `
import hashlib, json, pathlib, sys, pymupdf
folder = pathlib.Path(sys.argv[1])
expected = json.loads(pathlib.Path(sys.argv[2]).read_text())
norm = lambda text: ' '.join(text.split())
baseline = None
for name in ['reference-sheets', 'narrow-fit', 'narrow-scrolled', 'no-javascript']:
    doc = pymupdf.open(folder / (name + '.pdf'))
    assert len(doc) == 7, (name, 'page count', len(doc))
    pixels = []
    for i, page in enumerate(doc):
        assert abs(page.rect.width-841.89)<1 and abs(page.rect.height-595.28)<1, (name, i, page.rect)
        text = norm(page.get_text())
        assert expected[i]['title'] in text and f'{i+1} / 7' in text, (name, i, 'page order')
        for phrase in expected[i].get('text', []):
            assert norm(phrase) in text, (name, i, 'missing attribute/skill', phrase)
        for card in expected[i]['cards']:
            assert card['name'].upper() in text, (name, i, 'missing card', card['name'])
            assert card['body'] in text, (name, i, 'missing full description', card['name'])
        if i in [1,2,3]:
            assert text.count('1 Luck') == sum(c['body'].count('1 Luck') + (c['label']=='1 Luck') for c in expected[i]['cards']) + 1, (name, i, 'Luck markers')
        for excluded in ['Print all 7 pages', 'Back to Field Notes', 'Kitchen sink', 'Unofficial ideas', 'Save as PDF']:
            assert excluded not in text, (name, i, 'printed chrome', excluded)
        for word in page.get_text('words'):
            assert word[0]>=18 and word[1]>=18 and word[2]<=page.rect.width-18 and word[3]<=page.rect.height-18, (name, i, 'clipped margin', word)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2,2))
        pixels.append(hashlib.sha256(pix.samples).hexdigest())
        if name=='reference-sheets': pix.save(folder / f'reference-page-{i+1}.png')
    if baseline is None: baseline = pixels
    else: assert pixels == baseline, (name, 'zoom/scroll/JavaScript changed printed layout')
print('PASS: four actual PDFs, exactly 7 A4 landscape pages each, correct order, complete source text and Luck markers, safe margins, no UI chrome; all four outputs pixel-identical')
`, artifacts, join(scratch, 'expected.json')], { stdio: 'inherit' });
  assert.deepEqual(browser('errors').errors, []);
  console.log('PASS: no browser errors');
} finally {
  socket?.close();
  browser('close');
  rmSync(scratch, { recursive: true, force: true });
}
