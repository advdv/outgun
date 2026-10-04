// node scripts/character-reference.e2e.mjs <builder-url> [review-artifact-directory]
// Uses the reference-sheet workflow: agent-browser, CDP PDFs, and PyMuPDF.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ITEM_CHOICES, newCharacter } from '../site/assets/character-sheet/model.ts';
import { referenceData } from './reference-data.mjs';

const url = process.argv[2];
assert(url, 'Supply the running character-builder URL');
const scratch = mkdtempSync(join(tmpdir(), 'outgun-selected-reference-'));
const artifacts = process.argv[3] ? resolve(process.argv[3]) : scratch;
mkdirSync(artifacts, { recursive: true });
const session = `selected-${process.pid}`;
const browser = (...args) => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert(response.success, JSON.stringify(response.error));
  return response.data;
};
const evaluate = code => browser('eval', code).result;
const wait = code => browser('wait', '--fn', code);
const ready = () => evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
const check = (code, message) => assert(evaluate(code), message);
const normalize = text => text.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
const source = referenceData();
const equipment = new Map(Object.entries(source.gear));
const pad = values => [...values, ...Array(6 - values.length).fill('')];
const names = kind => evaluate(`[...document.querySelectorAll('.reference-card[data-kind="${kind}"]')].map(e => e.dataset.name)`);
const importCharacter = character => {
  writeFileSync(join(scratch, 'character.json'), JSON.stringify(character));
  evaluate('window.confirm = () => true');
  browser('upload', '[aria-label="Import character backup"]', join(scratch, 'character.json'));
  wait(`localStorage.getItem('outgun.character.v1') === ${JSON.stringify(JSON.stringify(character))}`);
  ready();
};
const fits = () => check(`(() => {
  const sheet = document.querySelector('.character-reference'), page = sheet.getBoundingClientRect();
  const scale = page.width / sheet.offsetWidth, content = sheet.querySelector('.character-reference-content');
  const footer = sheet.querySelector('.reference-legend').getBoundingClientRect();
  const columns = [...content.children], boxes = columns.map(e => e.getBoundingClientRect());
  return !document.querySelector('.builder-warning') && !document.querySelector('.builder-primary').disabled
    && content.scrollWidth <= content.clientWidth + 1 && content.scrollHeight <= content.clientHeight + 1
    && columns.length === 3 && columns.slice(0, 2).every(column => column.childElementCount > 0)
    && boxes.every((box, i) => Math.abs(box.top - boxes[0].top) < .5
      && Math.abs(box.width - boxes[0].width) < .5 && (!i || box.left > boxes[i-1].right))
    && columns.every(column => !column.lastElementChild?.classList.contains('character-reference-section'))
    && columns.flatMap(column => [...column.children]).every(card => {
      const box = card.getBoundingClientRect(), column = card.parentElement.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(card);
      return card.getClientRects().length === 1 && box.bottom < footer.top && box.left >= page.left + 25*scale
        && box.right <= page.right - 25*scale && Math.abs(box.width - column.width) < .5
        && [...range.getClientRects()].every(r =>
          r.left >= box.left-.5 && r.right <= box.right+.5 && r.top >= box.top-.5 && r.bottom <= box.bottom+.5);
    });
})()`, 'Every selected card and its full text fits in three columns with safe margins, no split cards or disabled print');
const verify = character => {
  const feats = [...new Set(character.feats.filter(Boolean))], gear = [...new Set(character.gear.filter(Boolean))];
  const traits = [...new Set(gear.flatMap(name => equipment.get(name)?.traits ?? []))];
  assert.deepEqual(names('feat'), feats);
  assert.deepEqual(names('gear'), gear);
  assert.deepEqual(names('trait'), traits);
  const cards = evaluate(`[...document.querySelectorAll('.reference-card')].map(e => ({
    name: e.dataset.name, kind: e.dataset.kind, body: e.querySelector('.reference-card-body')?.textContent ?? '',
    label: e.querySelector('.reference-luck,.reference-cost')?.textContent ?? ''
  }))`);
  for (const card of cards) {
    const feat = source.feats.find(f => f.name === card.name.toUpperCase()), item = equipment.get(card.name);
    const text = card.kind === 'feat' ? feat?.body ?? '' : card.kind === 'gear'
      ? item ? [item.detail, item.traits.join(' · ')].filter(Boolean).join('') : '' : source.gearFeats[card.name];
    assert.equal(normalize(card.body), normalize(text), `${card.kind} ${card.name}: complete source text`);
    assert.equal(card.label, card.kind === 'feat' && feat?.luck ? '1 Luck' : card.kind === 'gear' && item
      ? item.cost === '—' ? '—' : `${item.cost} Cash` : '', `${card.name}: cost label`);
  }
  fits();
};
const select = (field, slot, value) => {
  browser('click', `.sheet-choice[aria-label^="${field} ${slot}:"]`);
  const filter = '.picker-filter input';
  if (evaluate(`document.querySelector('${filter}').checked`)) browser('click', filter);
  browser('click', `.picker-option input[value=${JSON.stringify(value)}]`);
  ready();
  const character = evaluate("JSON.parse(localStorage.getItem('outgun.character.v1'))");
  verify(character); // Must update while the selection panel is still open.
  browser('press', 'Escape');
  return character;
};

let socket;
try {
  const response = await fetch(url);
  assert.equal(response.headers.get('x-amp-review-widget'), 'off');
  browser('open', url);
  browser('set', 'viewport', '1280', '1100', '2');
  browser('click', '.guide-toggle');
  ready();
  verify(newCharacter());
  check("document.querySelectorAll('.sheet-stage').length === 2 && [...document.querySelectorAll('.character-sheet,.character-reference')].every(e => e.offsetWidth === Math.round(297*96/25.4) && e.offsetHeight === Math.round(210*96/25.4))", 'Two fixed A4 landscape sheets, also when empty');

  socket = new WebSocket(browser('get', 'cdp-url').cdpUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error))); else request.resolve(message.result);
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetInfos } = await call('Target.getTargets');
  const { sessionId } = await call('Target.attachToTarget', { targetId: targetInfos.find(t => t.type === 'page' && t.url === url).targetId, flatten: true });
  const print = async (name, folder = scratch) => {
    ready();
    evaluate('Promise.all([...document.querySelectorAll(".character-sheet img")].map(i => i.decode()))');
    await call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
    ready();
    fits();
    const { data } = await call('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false }, sessionId);
    writeFileSync(join(folder, `${name}.pdf`), Buffer.from(data, 'base64'));
    await call('Emulation.setEmulatedMedia', { media: '' }, sessionId);
  };
  await print('empty');
  select('Feat', 1, 'Bodyguard');
  select('Gear', 1, 'Rocket Launcher');
  select('Feat', 1, 'Artist');
  select('Feat', 6, 'Gunslinger');
  select('Gear', 2, 'Rocket Launcher');
  select('Gear', 1, '');
  assert.deepEqual(names('gear'), ['Rocket Launcher'], 'Clearing one duplicate retains the other');
  select('Gear', 2, 'Lantern');
  assert.deepEqual(names('trait'), [], 'Replacing the final weapon removes all of its traits');
  select('Gear', 6, 'Diary and pencil');
  select('Feat', 1, '');
  console.log('PASS: live picker selection, replacement, clearing, duplicates, last slots and role-only gear; no stale or unselected rules');

  // Cover every source Feat, including legacy/import-only ones, and every picker item.
  for (let i = 0; i < source.feats.length; i += 6) {
    const character = { ...newCharacter(), feats: pad(source.feats.slice(i, i+6).map(f => f.name)),
      gear: pad(ITEM_CHOICES.gear.slice(i, i+6).map(([name]) => name)) };
    importCharacter(character);
    verify(character);
  }
  const legacy = { ...newCharacter(), feats: ['Sailor\nKnow the currents.', '<b>Custom feat</b>', '', '', '', ''],
    gear: ['toString', 'Precious item of choice', '', '', '', ''] };
  importCharacter(legacy);
  verify(legacy);
  check("!document.querySelector('.character-reference h3 b') && document.querySelector('.character-reference').textContent.includes('<b>Custom feat</b>')", 'Imported custom text is preserved, escaped, and not guessed as book rules');

  // The selection from the Safari report: CSS multicolumn printing stacked
  // page-wide cards and clipped the remaining rules off the right edge.
  const safari = { ...newCharacter(),
    feats: pad(['Guide', 'Explorer', 'Favored Weapon', 'Quick and Nimble']),
    gear: ['Knife', 'Old Rifle', 'Bow', 'Machete/Axe', 'Shotgun', 'Hunting Bow'] };
  importCharacter(safari);
  verify(safari);
  const safariText = evaluate("[...document.querySelectorAll('.reference-card')].map(e => e.textContent.replace(/\\s+/g, ' ').trim())");
  await print('safari-regression', artifacts);

  const stress = { ...newCharacter(),
    feats: ['Sensible Packer', 'Linguist', 'Bodyguard', 'Quick Fingers', 'Moneybags', 'Chin Up'],
    gear: ['Rocket Launcher', 'Gatling Gun', 'Hunting Bow', 'Machete/Axe', 'Club/Hammer', 'Radio'] };
  // Changing slot order changes column breaks and the order of shared traits.
  for (let offset = 1; offset <= 6; offset++) {
    const reordered = { ...stress, feats: [...stress.feats.slice(offset), ...stress.feats.slice(0, offset)],
      gear: [...stress.gear.slice(offset), ...stress.gear.slice(0, offset)].reverse() };
    importCharacter(reordered);
    verify(reordered);
  }
  importCharacter(stress);
  verify(stress);
  assert.equal(names('trait').length, 12, 'Stress fixture includes every equipment trait');
  const portrait = join(scratch, 'portrait.png');
  execFileSync('magick', ['-size', '404x568', 'xc:#d5bf94', '-fill', '#634123', '-draw', 'circle 202,182 202,85', '-draw', 'roundrectangle 60,310 344,620 110,110', portrait]);
  browser('upload', '[aria-label="Upload portrait"]', portrait);
  wait("document.querySelector('.sheet-portrait img')?.naturalWidth > 0");
  for (const [label, value] of [['Name', 'Mara Voss'], ['Backpack', 'Rope\nNotebook\nCompass\nSpare socks'], ['Bag', 'Old map\nLetters\nSilver key\nTrain ticket']]) {
    browser('fill', `[aria-label="${label}"]`, value);
  }
  for (const label of ['Luck 4 of 6', 'Grit 9 of 12', 'Cash 3 of 5', 'Weapon 1 ammunition 2 of 3']) browser('click', `[aria-label="${label}"]`);
  const saved = evaluate("JSON.parse(localStorage.getItem('outgun.character.v1'))");
  browser('reload');
  ready();
  verify(saved);
  assert.deepEqual(evaluate("JSON.parse(localStorage.getItem('outgun.character.v1'))"), saved);
  evaluate("window.__beforePrint = 0; addEventListener('beforeprint', () => window.__beforePrint++)");
  browser('click', '.builder-primary');
  wait('window.__beforePrint > 0');
  await print('selected-character', artifacts);
  browser('click', '.sheet-choice[aria-label^="Gear 6:"]');
  await print('picker-open');
  browser('press', 'Escape');
  browser('set', 'viewport', '390', '844', '2');
  ready();
  fits();
  evaluate('document.querySelector(".sheet-viewport").scrollLeft = 450; window.scrollTo(0, document.body.scrollHeight)');
  check("document.querySelector('.sheet-viewport').scrollLeft > 400 && window.scrollY > 1000", 'Print after horizontal and vertical scrolling');
  await print('narrow-scrolled');
  await call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  ready();
  fits();
  check("[...document.querySelectorAll('.sheet-stage')].every(e => getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().left === 0)", 'Normal-flow print has no scroll offset');
  await call('Emulation.setEmulatedMedia', { media: '' }, sessionId);
  console.log('PASS: all 42 complete Feats, 34 picker items, legacy text, six longest Feats plus all 12 traits fit; autosave/reload and native print event');

  writeFileSync(join(scratch, 'expected.json'), JSON.stringify({
    safariText,
    feats: saved.feats.map(name => ({ name: name.toUpperCase(), body: normalize(source.feats.find(f => f.name === name.toUpperCase()).body) })),
    gear: saved.gear.map(name => ({ name: name.toUpperCase(), detail: source.gear[name].detail })),
    traits: Object.entries(source.gearFeats).map(([name, body]) => ({ name, body: normalize(body) })),
  }));
  execFileSync('uv', ['run', '--with', 'pymupdf', 'python', '-c', `
import hashlib, json, pathlib, sys, pymupdf
scratch, artifacts = map(pathlib.Path, sys.argv[1:])
expected = json.loads((scratch / 'expected.json').read_text())
norm = lambda text: ' '.join(text.split())
empty = pymupdf.open(scratch / 'empty.pdf')
assert len(empty) == 2 and 'Choose feats' in empty[1].get_text(), 'Empty sheet still prints two pages'
safari = pymupdf.open(artifacts / 'safari-regression.pdf')
assert len(safari) == 2, 'Safari regression selection fits on two pages'
# Compare without whitespace: adjacent spans in textContent have no separating
# space, but PDF extraction inserts one between the title and price/body.
for card in expected['safariText']:
    assert ''.join(card.upper().split()) in ''.join(safari[1].get_text().upper().split()), ('Safari regression missing card text', card)
safari[1].get_pixmap(matrix=pymupdf.Matrix(2,2)).save(artifacts / 'safari-regression-page-2.png')
baseline = None
for folder, name in [(artifacts, 'selected-character'), (scratch, 'picker-open'), (scratch, 'narrow-scrolled')]:
    doc = pymupdf.open(folder / (name + '.pdf'))
    assert len(doc) == 2, (name, 'page count', len(doc))
    first, second = doc
    for phrase in ['Mara Voss', 'Spare socks', 'Train ticket', 'Chin Up', 'Radio']:
        assert phrase in first.get_text(), (name, 'main sheet missing text', phrase)
    assert first.get_images(), 'Uploaded portrait must remain in the PDF'
    text = norm(second.get_text())
    assert 'SELECTED FEATS, GUNS & GEAR' in text and '2 / 2' in text
    for kind in ['feats', 'gear', 'traits']:
        for item in expected[kind]:
            assert item['name'] in text, (name, kind, item['name'])
            assert item.get('body', item.get('detail', '')) in text, (name, 'missing full rules', item['name'])
    for word in second.get_text('words'):
        assert word[0]>=18 and word[1]>=18 and word[2]<=second.rect.width-18 and word[3]<=second.rect.height-18, (name, 'margin clipping', word)
    pixels = []
    for i, page in enumerate(doc):
        assert abs(page.rect.width-841.89)<1 and abs(page.rect.height-595.28)<1, (name, page.rect)
        for excluded in ['Print both pages', 'Back to Field Notes', 'Saved on this device', 'Only role starting gear', 'Custom entry']:
            assert excluded not in page.get_text(), (name, 'printed chrome', excluded)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2,2))
        pixels.append(hashlib.sha256(pix.samples).hexdigest())
        if name == 'selected-character': pix.save(artifacts / f'selected-character-page-{i+1}.png')
    if baseline is None: baseline = pixels
    else: assert pixels == baseline, (name, 'picker or scrolling changed printed pixels')
print('PASS: empty PDF, Safari regression selection and three populated PDFs; exactly 2 A4 landscape pages each; complete rules, portrait, multiline/bottom fields, safe margins, no UI; populated PDFs pixel-identical')
`, scratch, artifacts], { stdio: 'inherit' });
  evaluate('window.confirm = () => true');
  browser('click', '.builder-actions button:last-child');
  ready();
  verify(newCharacter());
  console.log('PASS: New sheet clears the reference as well as the main sheet');
  assert.deepEqual(browser('errors').errors, []);
} finally {
  socket?.close();
  browser('close');
  rmSync(scratch, { recursive: true, force: true });
}
