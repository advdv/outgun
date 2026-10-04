// Run against the supervised Hugo preview:
// node scripts/character-guide.e2e.mjs <builder-url> [review-artifact-directory]
// Requires the orb's agent-browser, ImageMagick, and uv (for PDF inspection).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const url = process.argv[2];
assert(url, 'Supply the running character-builder URL');
const scratch = mkdtempSync(join(tmpdir(), 'outgun-guide-'));
const artifacts = process.argv[3] ? resolve(process.argv[3]) : scratch;
mkdirSync(artifacts, { recursive: true });
const session = `guide-e2e-${process.pid}`;
const browser = (...args) => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...args], { encoding: 'utf8' }));
  assert(response.success, JSON.stringify(response.error));
  return response.data;
};
const evaluate = code => browser('eval', code).result;
const wait = code => browser('wait', '--fn', code);
const click = selector => browser('click', selector);
const heading = text => wait(`document.querySelector('#guide-heading')?.textContent === ${JSON.stringify(text)}`);
const check = (expression, message) => assert(evaluate(expression), message || expression);
const fill = (name, value) => browser('fill', `[aria-label=${JSON.stringify(name)}]`, value);
const capture = name => {
  wait("[...document.images].every(i => i.complete) && (!document.querySelector('.react-joyride__floater') || getComputedStyle(document.querySelector('.react-joyride__floater')).opacity === '1')");
  evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
  browser('screenshot', join(artifacts, `${name}.png`));
};
const showGuide = index => {
  if (evaluate("!!document.querySelector('.guide-popover')")) click('.guide-close');
  click(`#guide-pin-${index}`);
  wait(`document.querySelector('.guide-progress')?.textContent.startsWith('${index + 1} of 8')`);
};
const chooser = name => {
  click(`.sheet-choice[aria-label^=${JSON.stringify(name)}]`);
  wait("!!document.querySelector('#choice-picker') && !document.querySelector('.guide-popover')");
  check("[...document.querySelectorAll('.picker-page')].every(e => e.querySelector('.info-icon[aria-hidden=true]') && /p{1,2}[.] [0-9]/.test(e.textContent))", 'Every page reference needs an info icon and page number');
  if (name === 'Role:' || name === 'Trope:') {
    assert.equal(evaluate("document.querySelectorAll('.picker-description').length"), name === 'Role:' ? 10 : 15);
    check(`(() => {
      const options = [...document.querySelectorAll('.picker-option')];
      return options.every(option => {
        const input = option.querySelector('input'), description = option.querySelector('.picker-description');
        return input.value ? description?.textContent.length > 0 && description.htmlFor === input.id
          && input.getAttribute('aria-describedby')?.split(' ').includes(description.id) : !description;
      });
    })()`, 'Every role/trope description labels its own radio; the empty choice has none');
  }
  if (name === 'Role:') {
    wait("document.querySelectorAll('.picker-illustration img').length === 10 && [...document.querySelectorAll('.picker-illustration img')].every(i => i.complete && i.naturalWidth === 320 && i.naturalHeight === 480)");
    check(`(() => {
      const base = document.querySelector('#character-builder').dataset.roleArt;
      return [...document.querySelectorAll('.picker-option')].every(option => {
        const input = option.querySelector('input'), image = option.querySelector('img');
        if (!input.value) return !image;
        const page = option.querySelector('.picker-page').textContent.match(/\\d+/)[0];
        return image.getAttribute('src') === base + 'role-' + page + '.webp' && image.alt === ''
          && image.parentElement.htmlFor === input.id;
      });
    })()`, 'Each role has its own decorative, clickable crop; No role has none');
  } else check("!document.querySelector('.picker-illustration')", 'Illustrations are exclusive to the role picker');
};
const reference = (name, pages) => {
  click(`.picker-page[aria-label^=${JSON.stringify(name + ':')}]`);
  wait("document.querySelector('.book-viewer')?.open && [...document.querySelectorAll('.book-page img')].every(i => i.complete && i.naturalWidth > 0)");
  assert.deepEqual(evaluate("[...document.querySelectorAll('.book-page figcaption')].map(e => e.textContent)"), pages.map(p => `Page ${p}`));
  check("!document.querySelector('.guide-popover')");
  browser('press', 'Escape');
  wait("!document.querySelector('.book-viewer') && !!document.querySelector('#choice-picker')");
  check("document.activeElement.matches('.picker-page')", 'Page viewer restores focus to its info link');
};
const choose = value => click(`.picker-option input[value=${JSON.stringify(value)}]`);
const closePicker = () => { browser('press', 'Escape'); wait("!document.querySelector('#choice-picker') && !!document.querySelector('.guide-popover')"); };
const featOrigin = name => evaluate(`(() => {
  const input = [...document.querySelectorAll('.picker-option input')].find(e => e.value === ${JSON.stringify(name)});
  return input.getAttribute('aria-describedby')?.split(' ').map(id => document.getElementById(id))
    .find(e => e?.classList.contains('picker-origin'))?.textContent ?? '';
})()`);

// agent-browser's PDF shortcut defaults to Letter. Use the same browser's CDP
// with preferCSSPageSize so this verifies the actual @page A4 landscape layout.
async function printPdf(name) {
  evaluate('document.fonts.ready.then(() => Promise.all([...document.querySelectorAll(".character-sheet img")].map(i => i.decode())))');
  const socket = new WebSocket(browser('get', 'cdp-url').cdpUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  try {
    const { targetInfos } = await call('Target.getTargets');
    const target = targetInfos.find(t => t.type === 'page' && t.url === url);
    assert(target, 'Test page is available over CDP');
    const { sessionId } = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const { data } = await call('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false }, sessionId);
    writeFileSync(join(artifacts, `${name}.pdf`), Buffer.from(data, 'base64'));
  } finally { socket.close(); }
}

try {
  browser('open', url);
  browser('set', 'viewport', '1440', '1200', '2');
  evaluate('localStorage.clear()');
  browser('reload');
  heading('Pick a name');
  check("document.querySelectorAll('.guide-pin').length === 8");
  check("!document.querySelector('[aria-label=\"Sheet zoom\"]') && !document.querySelector('.builder-notes').textContent.includes('A4 landscape')");
  check("document.querySelector('.guide-popover').getAttribute('aria-modal') === 'false' && !document.querySelector('.react-joyride__overlay')");
  check("document.querySelector('[aria-label=\"Luck 1 of 6\"]').getAttribute('aria-pressed') === 'true' && document.querySelector('[aria-label=\"Cash 1 of 5\"]').getAttribute('aria-pressed') === 'true'");
  fill('Name', 'Mara Voss');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).identity.name === 'Mara Voss'");
  click('.guide-next');
  heading('Pick an avatar');
  const portrait = join(scratch, 'portrait.png');
  execFileSync('magick', ['-size', '404x568', 'xc:#d5bf94', '-fill', '#634123', '-draw', 'circle 202,182 202,85', '-draw', 'roundrectangle 60,310 344,620 110,110', portrait]);
  browser('upload', '[aria-label="Upload portrait"]', portrait);
  wait("document.querySelector('.sheet-portrait img')?.naturalWidth > 0");
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).portrait.startsWith('data:image/jpeg;')");
  click('.guide-next');
  heading('Pick a role');
  chooser('Role:');
  assert.equal(evaluate("document.querySelectorAll('.picker-page').length"), 10);
  reference('The Daredevil', [22, 23]);
  const uploadedPortrait = evaluate("JSON.parse(localStorage.getItem('outgun.character.v1')).portrait");
  click('.picker-option:has(input[value="The Guardian"]) .picker-illustration');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).identity.role === 'The Guardian' && document.activeElement.value === 'The Guardian'", 'Clicking the crop selects and focuses its role');
  browser('press', 'ArrowDown');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).identity.role === 'The Captain'", 'Keyboard selection works after clicking artwork');
  choose('');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).identity.role === ''", 'No role still clears the selection');
  click('.picker-option:has(input[value="The Daredevil"]) .picker-description');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).identity.role === 'The Daredevil' && document.querySelector('.picker-option input[value=\"The Daredevil\"]').checked", 'Clicking a role description saves only its name');
  assert.equal(evaluate("JSON.parse(localStorage.getItem('outgun.character.v1')).portrait"), uploadedPortrait, 'Role artwork must not replace the uploaded portrait');
  capture('guide-info-panel');
  closePicker();
  heading('Pick a role');
  check("document.querySelector('[aria-label=\"Brawn 3 of 3\"]').disabled");
  capture('guide-role');
  click('.guide-next');
  heading('Pick a trope');
  chooser('Trope:');
  reference('Action Archeologist', [45]);
  click('.picker-option:has(input[value="Action Archeologist"]) .picker-description');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).identity.trope === 'Action Archeologist' && document.querySelector('.picker-option input[value=\"Action Archeologist\"]').checked", 'Clicking a trope description saves only its name');
  check("document.querySelector('.picker-attribute select').value === 'FOCUS' && document.querySelector('.picker-attribute select').disabled");
  capture('guide-trope-descriptions');
  closePicker();
  click('.guide-next');
  heading('Add character flavor');
  check(`(() => {
    const highlight = document.querySelector('#guide-target-4.is-active').getBoundingClientRect();
    return ['Background (flavor):', 'Age (flavor):', 'Flaw (flavor):', 'Catchphrase (flavor):'].every(name => {
      const field = [...document.querySelectorAll('.sheet-choice')].find(e => e.getAttribute('aria-label').startsWith(name)).getBoundingClientRect();
      // pt-to-pixel rounding differs for Age's separate left/width coordinates.
      return field.left >= highlight.left - 1 && field.right <= highlight.right + 1 && field.top >= highlight.top - 1 && field.bottom <= highlight.bottom + 1;
    });
  })()`, 'Flavor highlight contains all four fields');
  check("document.querySelector('.guide-copy').textContent.includes('guide the Director')");
  check("document.querySelector('#guide-pin-4').getBoundingClientRect().right < document.querySelector('[aria-label=\"Grit 1 of 12\"]').getBoundingClientRect().left", 'Flavor pin leaves the first Grit control clear');
  for (const [field, value] of [['Background', 'Explorer'], ['Age', 'Adult'], ['Flaw', 'I’m afraid of spiders'], ['Catchphrase', 'I’ve had worse!']]) {
    chooser(`${field} (flavor):`);
    choose(value);
    closePicker();
    check(`JSON.parse(localStorage.getItem('outgun.character.v1')).identity[${JSON.stringify(field.toLowerCase())}] === ${JSON.stringify(value)}`);
  }
  capture('guide-flavor');
  click('.guide-next');
  heading('Pick extra attributes and skills');
  assert.equal(evaluate("document.querySelector('.guide-callout').textContent"), 'Now add 2 extra Skill points. Put 1 point in each of two Skills, or 2 points in one Skill. No Skill can have more than 3 points. There are no extra free Attribute points.');
  check("getComputedStyle(document.querySelector('.guide-callout')).borderLeftWidth === '3px' && getComputedStyle(document.querySelector('.guide-callout')).backgroundColor !== 'rgba(0, 0, 0, 0)'");
  check("[...document.querySelectorAll('.guide-copy > p')].some(p => p.textContent.startsWith('A dice roll uses')) && [...document.querySelectorAll('.guide-copy > p')].some(p => p.textContent === 'For example, Brawn 3 + Fight 2 gives you 5 dice.')");
  check("!document.querySelector('.guide-copy').textContent.includes('per rating') && !document.querySelector('.guide-copy').textContent.includes('Click empty diamonds')");
  capture('guide-points');
  click('[aria-label="Force 2 of 3"]');
  click('[aria-label="Heal 2 of 3"]');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).manualPoints.FORCE === 1 && JSON.parse(localStorage.getItem('outgun.character.v1')).manualPoints.HEAL === 1");
  click('.guide-next');
  heading('Pick feats');
  for (const [slot, feat, page] of [[1, 'Fighter', 55], [2, 'Gunslinger', 55], [3, 'Archeology', 53]]) {
    chooser(`Feat ${slot}:`);
    if (slot === 1) {
      for (const [name, origin] of [['', ''], ['Fighter', 'Role'], ['Gunslinger', 'Role'], ['Archeology', 'Trope'], ['Eye for Details', 'Trope'], ['Thrill Seeker', 'Role · Trope']]) {
        assert.equal(featOrigin(name), origin, `${name}: accessible feat origin`);
      }
      check("!document.querySelector('.picker-option input[value=\"\"]').closest('.picker-option').querySelector('.picker-origin')");
      click('.picker-filter input');
      assert.equal(featOrigin('Artist'), 'Outside role & trope');
      assert.equal(featOrigin('Thrill Seeker'), 'Role · Trope');
      capture('guide-feats-unfiltered');
      check("document.querySelectorAll('.picker-description').length === 37 && !document.querySelector('.picker-option input[value=\"\"]').closest('.picker-option').querySelector('.picker-description')");
      check(`(() => {
        const input = document.querySelector('.picker-option input[value="Estimate"]');
        const description = input.closest('.picker-option').querySelector('.picker-description');
        return description.textContent === 'Every object you see and handle tells you a story, and whispers to you its price.'
          && input.getAttribute('aria-describedby').split(' ').includes(description.id);
      })()`, 'Estimate has the exact book introduction as its accessible description');
      click('.picker-option:has(input[value="Estimate"]) .picker-description');
      check("JSON.parse(localStorage.getItem('outgun.character.v1')).feats[0] === 'Estimate' && document.querySelector('.picker-option input[value=Estimate]').checked", 'Clicking the description selects only the feat name');
      reference('Estimate', [54]);
      capture('guide-feat-descriptions');
      click('.picker-filter input');
    }
    reference(feat, [page]);
    choose(feat);
    if (slot === 1) {
      evaluate("document.querySelector('.picker-list').scrollTop = 180");
      capture('guide-feat-origins');
    }
    closePicker();
  }
  // Sources follow the selected identity, not just the initial filtered list.
  chooser('Role:');
  choose('The Professor');
  closePicker();
  chooser('Feat 1:');
  assert.equal(featOrigin('Archeology'), 'Role · Trope');
  click('.picker-filter input');
  assert.equal(featOrigin('Fighter'), 'Outside role & trope');
  click('.picker-filter input');
  closePicker();
  chooser('Trope:');
  choose('Born Rebel');
  closePicker();
  chooser('Feat 1:');
  assert.equal(featOrigin('Archeology'), 'Role');
  assert.equal(featOrigin('Gunslinger'), 'Trope');
  closePicker();
  chooser('Role:');
  choose('The Daredevil');
  closePicker();
  chooser('Trope:');
  choose('Action Archeologist');
  closePicker();
  click('.guide-next');
  heading('Pick gear');
  check("document.querySelector('.guide-copy').textContent.includes('3 items: a pistol or revolver, a knife, and a rope')");
  for (const [slot, gear, page] of [[1, 'Pistol/Revolver', 133], [2, 'Knife', 132], [3, 'Rope', 132]]) {
    chooser(`Gear ${slot}:`);
    reference(gear, [page]);
    choose(gear);
    closePicker();
  }
  click('.guide-next');
  check("!document.querySelector('.guide-pin') && !document.querySelector('.guide-popover') && document.querySelector('.guide-toggle').getAttribute('aria-checked') === 'false'");
  console.log('PASS: all eight creation steps, four flavor fields, highlighted Skill allowance, accessible feat origins (role/trope/both/outside), changed identity, and info/page viewer round trips');

  browser('reload');
  wait("!!document.querySelector('.guide-toggle')");
  check("!document.querySelector('.guide-pin')");
  click('.guide-toggle');
  heading('Pick gear');
  click('.guide-navigation button:first-child');
  heading('Pick feats');
  click('.guide-close');
  check("document.querySelectorAll('.guide-pin').length === 8 && !document.querySelector('.guide-popover') && document.activeElement.id === 'guide-pin-6'");
  showGuide(3);
  heading('Pick a trope');
  browser('press', 'Escape');
  check("!document.querySelector('.guide-popover') && JSON.parse(localStorage.getItem('outgun.guide.v1')).index === 3");
  browser('reload');
  wait("document.querySelectorAll('.guide-pin').length === 8");
  check("!document.querySelector('.guide-popover')");
  click('.guide-restart');
  heading('Pick a name');
  click('.guide-hide');
  click('.guide-toggle');
  heading('Pick a name');
  console.log('PASS: finish/hide/toggle, persistence, resume, Back, pin jumps, close/Escape without advancing, and restart');

  // Narrow viewport: scroll the same sheet, without rearranging any controls.
  click('.guide-close');
  browser('set', 'viewport', '390', '844', '2');
  click('.guide-restart');
  heading('Pick a name');
  for (let index = 0; index < 8; index++) {
    if (index > 0) click('.guide-next');
    wait(`document.querySelector('.guide-progress')?.textContent.startsWith('${index + 1} of 8')`);
    wait("(() => { const p = document.querySelector('.guide-popover').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth + 1 && p.top >= 0 && p.bottom <= innerHeight + 1; })()");
    check(`(() => { const p = document.querySelector('.guide-popover').getBoundingClientRect(), t = document.querySelector('#guide-target-${index}').getBoundingClientRect(); return p.right <= t.left || p.left >= t.right || p.bottom <= t.top || p.top >= t.bottom; })()`, `Narrow step ${index + 1} must not cover its target`);
    if (index === 2 || index === 3) {
      const field = index === 2 ? 'Role' : 'Trope';
      chooser(`${field}:`);
      browser('scrollintoview', `.picker-option:has(input[value="${index === 2 ? 'The Heart' : 'Cowardly Lion'}"])`);
      check(`(() => {
        const list = document.querySelector('.picker-list');
        return list.scrollWidth === list.clientWidth && [...list.querySelectorAll('.picker-description')].every(e =>
          e.scrollWidth === e.clientWidth && e.scrollHeight === e.clientHeight && getComputedStyle(e).overflow === 'visible');
      })()`, 'Role/trope descriptions wrap fully without clipping or horizontal overflow');
      capture(`guide-narrow-${field.toLowerCase()}`);
      if (field === 'Role') {
        browser('set', 'viewport', '320', '844', '2');
        check(`(() => {
          const list = document.querySelector('.picker-list');
          return list.scrollWidth === list.clientWidth && [...list.querySelectorAll('.picker-illustration img')].every(image => {
            const rect = image.getBoundingClientRect(), row = image.closest('.picker-option');
            const description = row.querySelector('.picker-description'), text = description.getBoundingClientRect();
            return Math.abs(rect.width / rect.height - 2 / 3) < 0.01 && text.left >= rect.right + 12
              && description.scrollWidth === description.clientWidth && description.scrollHeight === description.clientHeight
              && rect.bottom <= row.getBoundingClientRect().bottom;
          });
        })()`, 'Even at 320px, role crops retain their framing beside fully wrapped text');
        capture('guide-320-role');
        browser('set', 'viewport', '390', '844', '2');
      }
      browser('scrollintoview', '.picker-option:last-child');
      check("(() => { const last = document.querySelector('.picker-option:last-child').getBoundingClientRect(), list = document.querySelector('.picker-list').getBoundingClientRect(); return last.bottom <= list.bottom + 1 && last.top >= list.top; })()", 'The final role/trope remains fully reachable by scrolling');
      closePicker();
    }
    if (index === 4 || index === 5) capture(`guide-narrow-step-${index + 1}`);
    if (index === 6) {
      chooser('Feat 1:');
      assert.equal(featOrigin('Fighter'), 'Role');
      assert.equal(featOrigin('Archeology'), 'Trope');
      assert.equal(featOrigin('Thrill Seeker'), 'Role · Trope');
      check("document.querySelector('.picker-list').scrollWidth === document.querySelector('.picker-list').clientWidth", 'Feat names, origins, and page links fit the narrow panel');
      capture('guide-narrow-feats');
      click('.picker-filter input');
      assert.equal(featOrigin('Artist'), 'Outside role & trope');
      check("document.querySelector('.picker-list').scrollWidth === document.querySelector('.picker-list').clientWidth", 'Outside-source labels also fit the narrow panel');
      capture('guide-narrow-feats-unfiltered');
      browser('scrollintoview', '.picker-option:has(input[value="Linguist"])');
      check(`(() => {
        const input = document.querySelector('.picker-option input[value="Linguist"]');
        const description = input.closest('.picker-option').querySelector('.picker-description');
        return description.textContent === 'When you need it, you remember that you studied that language in college, or that you can understand the basics of an unknown dialect.'
          && description.scrollWidth === description.clientWidth && description.scrollHeight === description.clientHeight
          && getComputedStyle(description).overflow === 'visible';
      })()`, 'Long descriptions wrap fully without clipping or truncation');
      capture('guide-narrow-long-description');
      click('.picker-filter input');
      closePicker();
    }
  }
  check("document.querySelector('.sheet-viewport').scrollWidth > document.querySelector('.sheet-viewport').clientWidth && document.querySelector('.character-sheet').offsetWidth > 1100");
  capture('guide-narrow');
  click('.guide-close');
  browser('set', 'viewport', '1440', '1200', '2');
  fill('Backpack', 'Rope\nNotebook\nCompass\nSpare socks');
  fill('Bag', 'Old map\nLetters\nSilver key\nTrain ticket');
  click('[aria-label="Luck 4 of 6"]');
  click('[aria-label="Grit 9 of 12"]');
  click('[aria-label="Cash 3 of 5"]');
  click('[aria-label="Weapon 1 ammunition 2 of 3"]');
  // Add a multiline legacy feat and populated final slots via the real importer.
  const saved = evaluate("JSON.parse(localStorage.getItem('outgun.character.v1'))");
  saved.feats[5] = 'Sailor\nKnow the currents.';
  saved.gear[5] = 'Lantern';
  const backup = join(scratch, 'character.json');
  writeFileSync(backup, JSON.stringify(saved));
  evaluate('window.confirm = () => true');
  browser('upload', '[aria-label="Import character backup"]', backup);
  wait("document.querySelector('[aria-label^=\"Feat 6:\"]').textContent.includes('currents')");
  browser('reload');
  wait("document.querySelector('.sheet-portrait img')?.naturalWidth > 0");
  assert.deepEqual(evaluate("JSON.parse(localStorage.getItem('outgun.character.v1'))"), saved);
  showGuide(5);
  browser('scroll', 'down', '650');
  evaluate('window.__printCalled = false; window.print = () => { window.__printCalled = true; }');
  click('.builder-primary');
  wait('window.__printCalled');
  await printPdf('character-guide-on');
  showGuide(6);
  chooser('Feat 1:');
  await printPdf('character-picker-open');
  closePicker();
  for (const field of ['Role', 'Trope']) {
    chooser(`${field}:`);
    await printPdf(`character-${field.toLowerCase()}-picker-open`);
    closePicker();
  }
  click('.guide-toggle');
  browser('scroll', 'down', '550');
  await printPdf('character-guide-off');
  // Printing after horizontal scrolling and at a different scale must be identical.
  browser('set', 'viewport', '390', '844', '2');
  evaluate('document.querySelector(".sheet-viewport").scrollLeft = 450; window.scrollTo(0, document.body.scrollHeight)');
  await printPdf('character-narrow');
  execFileSync('uv', ['run', '--with', 'pymupdf', 'python', '-c', `
import pathlib, sys, pymupdf
folder = pathlib.Path(sys.argv[1])
pixels = []
for name in ['character-guide-on', 'character-picker-open', 'character-role-picker-open', 'character-trope-picker-open', 'character-guide-off', 'character-narrow']:
    doc = pymupdf.open(folder / (name + '.pdf'))
    assert len(doc) == 1, (name, len(doc))
    page = doc[0]
    assert abs(page.rect.width - 841.89) < 1 and abs(page.rect.height - 595.28) < 1, page.rect
    text = page.get_text()
    for expected in ['Mara Voss', 'The Daredevil', 'Action Archeologist', 'Explorer', 'Adult', 'afraid of spiders', 'had worse!', 'Fighter', 'Gunslinger', 'Archeology', 'Know the currents.', 'Lantern', 'Spare socks', 'Train ticket']:
        assert expected in text, (name, expected)
    for excluded in ['Pick gear', 'extra Skill points', 'For example', 'Your fists', 'whispers to you its price', 'An adventurer always ready', 'perfect blend of body and mind', 'CREATE YOUR ADVENTURER', 'Finish guide', 'Restart guide', 'Saved on this device']:
        assert excluded not in text, (name, excluded)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5))
    pixels.append(pix.samples)
    if name == 'character-guide-on': pix.save(folder / 'character-print.png')
assert all(p == pixels[0] for p in pixels), 'Guide/picker/viewport state changed printed pixels'
print('PASS: six populated PDFs, one A4 landscape page each; expected bottom/multiline text; guide on/off, open feat/role/trope pickers and narrow scrolled output pixel-identical')
`, artifacts], { stdio: 'inherit' });
  console.log('PASS: narrow-screen target visibility, autosave/import, populated portrait/trackers/multiline/bottom fields, and Print button');

  browser('set', 'viewport', '1440', '1000', '2');
  click('.guide-toggle');
  showGuide(2);
  check("(() => { const e = document.querySelector('.guide-toggle'), r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })()", 'The role bubble must leave the toolbar guide switch usable');
  capture('guide-populated');
  click('.guide-hide');
  for (const name of ['Luck 1 of 6', 'Cash 1 of 5']) {
    click(`[aria-label=${JSON.stringify(name)}]`);
    click(`[aria-label=${JSON.stringify(name)}]`);
  }
  browser('reload');
  wait("!!document.querySelector('.guide-toggle')");
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).luck === 0 && JSON.parse(localStorage.getItem('outgun.character.v1')).cash === 0 && !document.querySelector('.guide-pin')");
  evaluate('window.confirm = () => true');
  click('.builder-actions button:last-child');
  check("JSON.parse(localStorage.getItem('outgun.character.v1')).luck === 1 && JSON.parse(localStorage.getItem('outgun.character.v1')).cash === 1 && !document.querySelector('.guide-pin')");
  click('.guide-toggle');
  heading('Pick a role');
  click('.builder-actions button:last-child');
  heading('Pick a name');
  check("document.querySelector('[aria-label=Name]').value === '' && !document.querySelector('.sheet-portrait img')");
  console.log('PASS: spent Luck/Cash stay zero after reload; New sheet restores defaults and respects the guide preference');
  for (const [oldIndex, newIndex, title] of [[3, 3, 'Pick a trope'], [4, 5, 'Pick extra attributes and skills'], [6, 7, 'Pick gear']]) {
    evaluate(`localStorage.setItem('outgun.guide.v1', JSON.stringify({ enabled: true, open: true, index: ${oldIndex} }))`);
    browser('reload');
    heading(title);
    assert.equal(evaluate("JSON.parse(localStorage.getItem('outgun.guide.v1')).index"), newIndex);
    browser('reload');
    heading(title);
    assert.equal(evaluate("JSON.parse(localStorage.getItem('outgun.guide.v1')).index"), newIndex);
  }
  console.log('PASS: existing seven-step progress migrates once and retains the same topic');
  assert.deepEqual(browser('errors').errors, []);
  console.log('PASS: no browser errors');
} finally {
  browser('close');
  rmSync(scratch, { recursive: true, force: true });
}
