// node scripts/player-cheat-sheet.e2e.mjs <cheat-sheet-url> [review-artifact-directory]
// Uses the orb's agent-browser and uv/PyMuPDF to inspect actual printed PDFs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const url = process.argv[2];
assert(url, 'Supply the running player-cheat-sheet URL');
const scratch = mkdtempSync(join(tmpdir(), 'outgun-cheat-'));
const artifacts = process.argv[3] ? resolve(process.argv[3]) : scratch;
mkdirSync(artifacts, { recursive: true });
const session = `cheat-e2e-${process.pid}`;
const browser = (...args) => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert(response.success, JSON.stringify(response.error));
  return response.data;
};
const evaluate = code => browser('eval', code).result;
const ready = () => evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
const check = (code, message) => assert(evaluate(code), message);
const layout = () => evaluate(`(() => {
  const sheet = document.querySelector('.cheat-sheet');
  return [...document.querySelectorAll('.cheat-card')].map(card => {
    const rect = card.getBoundingClientRect(), page = sheet.getBoundingClientRect();
    const scale = page.width / sheet.offsetWidth;
    return [card.id, ...[rect.x - page.x, rect.y - page.y, rect.width, rect.height].map(n => Math.round(n / scale))];
  });
})()`);
const fits = () => check(`(() => {
  const page = document.querySelector('.cheat-sheet').getBoundingClientRect();
  return [...document.querySelectorAll('.cheat-card')].every(card => {
    const box = card.getBoundingClientRect();
    return box.bottom < page.bottom - 5 && box.right < page.right - 5
      && [...card.querySelectorAll('p, li, h2, h3, table, blockquote, .symbol-die')].every(el => {
        const r = el.getBoundingClientRect();
        return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
      });
  });
})()`, 'All text, tables and dice must fit inside their cards and the paper margins');

let socket;
try {
  for (const path of ['player-cheat-sheet/', 'character-builder/']) {
    const response = await fetch(new URL(`../${path}`, url));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-amp-review-widget'), 'off', `${path}: keep the portal widget out of print`);
  }
  browser('open', new URL('../', url).href);
  browser('set', 'viewport', '1280', '1100', '2');
  browser('click', `main a[href$="/player-cheat-sheet/"]`);
  assert.equal(browser('get', 'url').url, url, 'Homepage link reaches the cheat sheet');
  ready();
  assert.deepEqual(evaluate(`Array.from(document.querySelectorAll('#difficulty tbody tr'), row => [
    row.querySelector('th').textContent, row.querySelectorAll('svg').length,
    row.querySelector('[role=img]').getAttribute('aria-label')
  ])`), [
    ['Basic', 2, '2 matching dice'], ['Critical', 3, '3 matching dice'],
    ['Extreme', 4, '4 matching dice'], ['Impossible', 5, '5 matching dice'],
  ]);
  assert.equal(evaluate("new Set([...document.querySelectorAll('.symbol-die path')].map(e => e.getAttribute('d'))).size"), 1);
  check("!document.querySelector('.symbol-die circle')", 'No numerical pips');
  check("!(/\\bp{1,2}\\.\\s*\\d/.test(document.querySelector('.cheat-sheet').textContent))", 'No page references');
  check("document.querySelectorAll('.cheat-column').length === 3 && document.querySelectorAll('.cheat-card').length === 7", 'Seven cards in three fixed columns');
  check("document.querySelector('.cheat-sheet').offsetWidth === Math.round(297 * 96 / 25.4) && document.querySelector('.cheat-sheet').offsetHeight === Math.round(210 * 96 / 25.4)", 'Screen canvas is A4 landscape');
  fits();
  const originalLayout = layout();
  browser('screenshot', '.cheat-sheet', join(artifacts, 'player-cheat-sheet-screen.png'));
  evaluate('window.__printed = false; window.print = () => { window.__printed = true; }');
  browser('click', '#cheat-print');
  browser('wait', '--fn', 'window.__printed');
  console.log('PASS: landing link, seven readable cards, accessible 2/3/4/5 symbol dice, print button, and review-widget exclusion');

  // agent-browser's PDF shortcut defaults to Letter. Honor CSS @page via CDP.
  socket = new WebSocket(browser('get', 'cdp-url').cdpUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
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
    // The native font promise also resolves with page scripting disabled;
    // requestAnimationFrame callbacks do not run in that state.
    evaluate('document.fonts.ready');
    const { data } = await call('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false }, sessionId);
    writeFileSync(join(artifacts, `${name}.pdf`), Buffer.from(data, 'base64'));
  };
  await print('player-cheat-sheet');

  browser('set', 'viewport', '390', '844', '2');
  ready();
  check("document.querySelector('.cheat-viewport').scrollWidth === document.querySelector('.cheat-viewport').clientWidth", 'Fit page must not leave invisible horizontal overflow');
  assert.deepEqual(layout(), originalLayout, 'Narrow Fit scales the whole sheet, never reflows cards');
  browser('screenshot', join(artifacts, 'player-cheat-sheet-narrow-fit.png'));
  await print('narrow-fit');
  browser('select', '#cheat-zoom', 'actual');
  ready();
  check("document.querySelector('.cheat-viewport').scrollWidth > document.querySelector('.cheat-viewport').clientWidth", '100% enables horizontal scrolling');
  assert.deepEqual(layout(), originalLayout, '100% preserves desktop geometry');
  evaluate("document.querySelector('.cheat-viewport').scrollLeft = 700; window.scrollTo(0, 400)");
  check("document.querySelector('.cheat-viewport').scrollLeft >= 650 && window.scrollY > 0", 'Exercise both horizontal and vertical scroll before printing');
  browser('screenshot', join(artifacts, 'player-cheat-sheet-narrow-scrolled.png'));
  await print('narrow-scrolled');
  console.log('PASS: narrow Fit/100%, fixed card geometry, horizontal and vertical scrolling');

  await call('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  ready();
  fits();
  assert.deepEqual(layout(), originalLayout, 'Print uses the same card positions and type sizes');
  check("getComputedStyle(document.querySelector('.cheat-stage')).position !== 'fixed' && document.querySelector('.cheat-sheet').getBoundingClientRect().x === 0 && document.querySelector('.cheat-sheet').getBoundingClientRect().y === 0", 'Print starts at the paper origin in normal flow');
  await call('Emulation.setEmulatedMedia', { media: '' }, sessionId);
  await call('Emulation.setScriptExecutionDisabled', { value: true }, sessionId);
  browser('reload');
  check("document.querySelector('.cheat-actions').hidden && document.querySelector('.cheat-sheet').style.transform === ''", 'No-JavaScript case did not run the page script');
  await print('no-javascript');
  await call('Emulation.setScriptExecutionDisabled', { value: false }, sessionId);

  execFileSync('uv', ['run', '--with', 'pymupdf', 'python', '-c', `
import pathlib, sys, pymupdf
folder = pathlib.Path(sys.argv[1])
pixels = []
for name in ['player-cheat-sheet', 'narrow-fit', 'narrow-scrolled', 'no-javascript']:
    doc = pymupdf.open(folder / (name + '.pdf'))
    assert len(doc) == 1, (name, 'page count', len(doc))
    page = doc[0]
    assert abs(page.rect.width - 841.89) < 1 and abs(page.rect.height - 595.28) < 1, (name, page.rect)
    text = ' '.join(page.get_text().split())
    for expected in ['ROLLING DICE', 'ADVANTAGE & DISADVANTAGE', 'RE-ROLLS', 'FACING ENEMIES', 'DIFFICULTY', 'DANGEROUS ROLLS', 'DAMAGE CONTROL',
                     'Any Skill can pair with any Attribute.', 'Spend 1 Luck to gain +1 on an Action or Reaction Roll.',
                     'lose one previous success of your choice.', 'Better = an extra success or an upgraded success.',
                     'Allowed even with no successes on your first roll.', 'No improvement: lose ALL previous successes.',
                     'Take the Quick Action before or after the Action Roll.', 'Enemy attacks first: start with a Reaction Turn.',
                     'Any matching face counts.', 'Each Basic Success saves 1 Grit.', 'Each Critical Success saves 3 Grit.',
                     'No Damage Control on Impossible rolls.']:
        assert expected in text, (name, 'missing content', expected)
    for excluded in ['Print / save PDF', 'Back to Field Notes', 'Kitchen sink', 'Unofficial ideas', '100% scale']:
        assert excluded not in text, (name, 'printed chrome', excluded)
    for word in page.get_text('words'):
        assert word[0] >= 18 and word[1] >= 18 and word[2] <= page.rect.width - 18 and word[3] <= page.rect.height - 18, (name, 'clipped margin', word)
    stars = [d for d in page.get_drawings() if len(d['items']) == 4 and all(item[0] == 'c' for item in d['items']) and d['fill']]
    assert len(stars) == 14, (name, 'printed star dice', len(stars))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
    pixels.append(pix.samples)
    if name == 'player-cheat-sheet': pix.save(folder / 'player-cheat-sheet-print.png')
assert all(p == pixels[0] for p in pixels), 'Zoom, scroll, or JavaScript state changed printed pixels'
print('PASS: four PDFs, exactly one A4 landscape page each; 14 vector star dice; complete text within margins; desktop, narrow Fit, narrow scrolled 100%, and no-JavaScript output pixel-identical')
`, artifacts], { stdio: 'inherit' });
  assert.deepEqual(browser('errors').errors, []);
  console.log('PASS: no browser errors');
} finally {
  socket?.close();
  browser('close');
  rmSync(scratch, { recursive: true, force: true });
}
