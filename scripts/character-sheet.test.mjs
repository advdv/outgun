import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { IDENTITY_CHOICES, ITEM_CHOICES, ROLE_ITEMS, TROPE_FEATS, adventurePageUrl, chooseIdentity, chooseItem, itemChoices, newCharacter, parseCharacter, markValue } from '../site/assets/character-sheet/model.ts';

const pageText = page => readFileSync(new URL(
  `../html/outgunned-adventure-standalone-genre-book-v1.1-en/page-${String(page + 2).padStart(4, '0')}.md`,
  import.meta.url,
), 'utf8').toLowerCase();

test('defaults preserve baselines and independent character records', () => {
  const a = newCharacter();
  const b = newCharacter();
  assert.equal(Object.keys(a.ratings).length, 25);
  assert.equal(a.ratings.NERVES, 2);
  assert.equal(a.ratings.STEALTH, 1);
  a.feats[1] = 'Changed';
  a.ratings.STEALTH = 3;
  assert.equal(b.feats[1], '');
  assert.equal(b.ratings.STEALTH, 1);
});

test('asymmetric edited character round-trips without losing zeroes or line breaks', () => {
  const a = newCharacter();
  a.identity.name = 'Élodie van Rijn';
  a.identity.catchphrase = 'Maps lie. People lie more.';
  a.ratings.FOCUS = 3;
  a.ratings.HEAL = 2;
  a.luck = 4;
  a.grit = 12;
  a.cash = 0;
  a.ammo = [0, 3, 1];
  a.feats[5] = 'Sailor\nKnow the currents.';
  a.backpack = 'Rope\nNotebook\nCompass';
  assert.deepEqual(parseCharacter(JSON.stringify(a)), a);
});

test('invalid imports are rejected, not clamped or partially accepted', () => {
  for (const edit of [
    a => a.version = 2,
    a => a.grit = 13,
    a => a.luck = -1,
    a => a.cash = 1.5,
    a => a.ratings.BRAWN = 1,
    a => a.ratings.FIGHT = 4,
    a => a.gear.pop(),
    a => a.ammo = [1, '2', 0],
    a => a.identity = null,
    a => a.portrait = 'https://example.com/tracking.png',
    a => a.portrait = 'data:image/svg+xml;base64,PHN2Zz4=',
  ]) {
    const a = newCharacter();
    edit(a);
    assert.throws(() => parseCharacter(JSON.stringify(a)));
  }
  assert.throws(() => parseCharacter('null'));
  assert.throws(() => parseCharacter('{broken'));
});

test('tracker can fill, lower and clear; attribute and skill floors remain', () => {
  assert.equal(markValue(0, 6), 6);
  assert.equal(markValue(6, 6), 5);
  assert.equal(markValue(6, 2), 2);
  assert.equal(markValue(1, 1), 0);
  assert.equal(markValue(2, 2, 2), 2);
  assert.equal(markValue(3, 3, 2), 2);
  assert.equal(markValue(1, 1, 1), 1);
});

test('pickers contain the ten standard roles and fifteen tropes, with correct book pages', () => {
  for (const [field, count, indexPage] of [['role', 10, 20], ['trope', 15, 44]]) {
    const options = IDENTITY_CHOICES[field];
    assert.equal(options.length, count);
    assert.equal(new Set(options.map(([name]) => name)).size, count);
    for (const [name, page] of options) {
      assert(pageText(indexPage).includes(`**${name.toLowerCase()}**`), `${name} is not in the book's ${field} list`);
      assert(pageText(Number(page)).includes(name.toLowerCase()), `Incorrect source page for ${name}`);
    }
  }
  assert(!IDENTITY_CHOICES.role.some(([name]) => name.includes('Fortune Seeker')));
});

test('flavor suggestions are deduplicated and each citation contains its exact text', () => {
  for (const [field, count] of [['background', 28], ['age', 1], ['flaw', 34], ['catchphrase', 34]]) {
    const options = IDENTITY_CHOICES[field];
    assert.equal(options.length, count);
    assert.equal(new Set(options.map(([name]) => name)).size, count);
    for (const [name, page] of options) {
      assert(pageText(Number(page)).includes(name.toLowerCase()), `Incorrect text or page for ${field}: ${name}`);
    }
  }
  assert.deepEqual(IDENTITY_CHOICES.age, [['Adult', '19']]);
  assert(IDENTITY_CHOICES.flaw.some(([name]) => name === 'I have a debt to repay'));
  assert(!IDENTITY_CHOICES.catchphrase.some(([name]) => name === 'I have a debt to repay'));
  assert(IDENTITY_CHOICES.catchphrase.some(([name]) => name === 'I chart my own course'));
  assert(!IDENTITY_CHOICES.flaw.some(([name]) => name === 'I chart my own course'));
});

test('book links account for the two-page offset between printed and extracted pages', () => {
  const base = 'https://github.com/advdv/outgun/blob/main/html/outgunned-adventure-standalone-genre-book-v1.1-en/';
  assert.equal(adventurePageUrl('19'), `${base}page-0021.md`);
  assert.equal(adventurePageUrl('34'), `${base}page-0036.md`);
  assert.equal(adventurePageUrl('42'), `${base}page-0044.md`);
});

test('every flavor choice is available across roles and tropes without changing mechanics', () => {
  for (const [role, trope] of [['', ''], ['The Professor', 'Born Rebel'], ['The Guardian', 'Salty Dog']]) {
    const original = newCharacter();
    Object.assign(original.identity, { role, trope, background: 'Librarian', age: 'Old', flaw: 'A custom flaw', catchphrase: 'Keep moving!' });
    original.ratings.FOCUS = 3;
    original.luck = 2;
    original.feats[1] = 'Linguist';
    const untouched = structuredClone(original);
    for (const field of ['background', 'age', 'flaw', 'catchphrase']) {
      for (const [name] of IDENTITY_CHOICES[field]) {
        const expected = structuredClone(original);
        expected.identity[field] = name;
        const chosen = chooseIdentity(original, field, name);
        assert.deepEqual(chosen, expected);
        assert.deepEqual(parseCharacter(JSON.stringify(chosen)), expected);
      }
    }
    assert.deepEqual(original, untouched);
  }
});

test('selections immediately replace only the chosen field and survive a backup round-trip', () => {
  const original = newCharacter();
  original.identity.background = 'Librarian';
  original.ratings.FOCUS = 3;
  original.feats[2] = 'Linguist\nSpeaks Dutch';
  original.gear[4] = 'Old map';
  original.cash = 4;
  const untouched = structuredClone(original);
  const expected = structuredClone(original);
  expected.identity.role = 'The Smuggler';
  expected.identity.trope = 'Wild at Heart';
  let chosen = chooseIdentity(original, 'role', 'The Professor');
  chosen = chooseIdentity(chosen, 'trope', 'Action Archeologist');
  chosen = chooseIdentity(chosen, 'role', 'The Smuggler');
  chosen = chooseIdentity(chosen, 'trope', 'Wild at Heart');
  assert.deepEqual(chosen, expected);
  assert.deepEqual(parseCharacter(JSON.stringify(chosen)), expected);
  assert.deepEqual(chooseIdentity(chosen, 'trope', 'Wild at Heart'), expected);
  assert.deepEqual(original, untouched);
});

test('unlisted values, excluded special role, and choices from the wrong field cannot be selected', () => {
  const original = newCharacter();
  for (const [field, value] of [
    ['role', 'Custom explorer'], ['role', 'The Fortune Seeker'], ['role', 'Born Rebel'],
    ['trope', 'The Professor'], ['trope', ''], ['age', 'Young'], ['age', 'Old'],
    ['background', 'The Fortune Seeker'], ['flaw', 'Leave it to me'], ['catchphrase', 'I can’t swim'],
  ]) assert.strictEqual(chooseIdentity(original, field, value), original);
});

test('legacy manual values remain intact until that field receives a book selection', () => {
  const legacy = newCharacter();
  legacy.identity.role = 'My explorer';
  legacy.identity.trope = 'My adventurer';
  legacy.identity.age = 'Old';
  legacy.identity.background = 'A custom background';
  legacy.identity.flaw = 'A custom flaw';
  legacy.identity.catchphrase = 'Keep moving!';
  const loaded = parseCharacter(JSON.stringify(legacy));
  assert.deepEqual(loaded, legacy);
  const chosen = chooseIdentity(loaded, 'role', 'The Hunter');
  assert.equal(chosen.identity.role, 'The Hunter');
  assert.equal(chosen.identity.trope, 'My adventurer');
  assert.equal(loaded.identity.role, 'My explorer');
  assert.equal(chosen.identity.age, 'Old');
  assert.equal(chosen.identity.background, 'A custom background');
  assert.equal(chosen.identity.flaw, 'A custom flaw');
  assert.equal(chosen.identity.catchphrase, 'Keep moving!');
});

test('feat and gear catalogs cite only the requested pages, with distinct source-backed entries', () => {
  for (const [field, count, pages] of [['feats', 37, [45, 46, 47, 48, 49]], ['gear', 32, [132, 133]]]) {
    const options = ITEM_CHOICES[field];
    assert.equal(options.length, count);
    assert.equal(new Set(options.map(([name]) => name)).size, count);
    assert.deepEqual([...new Set(options.map(([, page]) => Number(page)))].sort((a, b) => a - b), pages);
    for (const [name, page] of options) {
      // The extraction splits the ligature in "Rifle" into "Rif l e".
      const source = pageText(Number(page)).replaceAll('rif l e', 'rifle');
      assert(source.includes(name.toLowerCase()), `Incorrect text or page for ${field}: ${name}`);
    }
  }
  assert.equal(ITEM_CHOICES.gear.filter(([, page]) => page === '132').length, 16);
  assert.equal(ITEM_CHOICES.gear.filter(([, page]) => page === '133').length, 16);
  assert.equal(adventurePageUrl('45').split('/').at(-1), 'page-0047.md');
  assert.equal(adventurePageUrl('49').split('/').at(-1), 'page-0051.md');
  assert.equal(adventurePageUrl('132').split('/').at(-1), 'page-0134.md');
  assert.equal(adventurePageUrl('133').split('/').at(-1), 'page-0135.md');
});

test('any role or trope can select and clear any item in any slot without altering other data', () => {
  for (const [role, trope] of [['', ''], ['The Professor', 'Born Rebel'], ['The Guardian', 'Salty Dog']]) {
    const original = newCharacter();
    Object.assign(original.identity, { role, trope });
    original.feats = ['Custom feat\nWith notes', 'Artist', '', 'Guide', 'Sailor', 'Linguist'];
    original.gear = ['Old map', '', 'Compass', 'Radio', 'Knife', 'Rope'];
    original.ratings.FOCUS = 3;
    original.cash = 4;
    original.ammo = [2, 0, 3];
    const untouched = structuredClone(original);
    for (const field of ['feats', 'gear']) {
      for (const index of [0, 2, 5]) {
        for (const name of ['', ...ITEM_CHOICES[field].map(([name]) => name)]) {
          const expected = structuredClone(original);
          expected[field][index] = name;
          const chosen = chooseItem(original, field, index, name);
          assert.deepEqual(chosen, expected);
          assert.deepEqual(parseCharacter(JSON.stringify(chosen)), expected);
        }
      }
    }
    assert.deepEqual(original, untouched);
    assert.deepEqual(parseCharacter(JSON.stringify(original)), original);
  }
});

test('item selections reject custom entries and entries from the wrong catalog', () => {
  const original = newCharacter();
  for (const [field, value] of [['feats', 'Custom feat'], ['feats', 'Pistol/Revolver'], ['gear', 'Custom gear'], ['gear', 'Gunslinger']]) {
    assert.strictEqual(chooseItem(original, field, 3, value), original);
  }
});

test('starting feat mappings cover every role and trope and match their source sections', () => {
  for (const [field, data, count] of [['role', ROLE_ITEMS, 6], ['trope', TROPE_FEATS, 4]]) {
    assert.deepEqual(Object.keys(data).sort(), IDENTITY_CHOICES[field].map(([name]) => name).sort());
    for (const [name, page] of IDENTITY_CHOICES[field]) {
      const names = field === 'role' ? data[name].feats : data[name];
      assert.equal(new Set(names).size, count);
      const source = field === 'role' ? pageText(Number(page))
        : pageText(Number(page)).split(`<mark>${name.toLowerCase()}</mark>`)[1].split('# <mark>')[0];
      for (const feat of names) assert(source.includes(feat.toLowerCase()), `${feat} is not offered by ${name}`);
    }
  }
});

test('limited feats are the deduplicated role-or-trope union within the existing catalog', () => {
  const identity = newCharacter().identity;
  const names = () => itemChoices('feats', identity, true).map(([name]) => name);
  Object.assign(identity, { role: 'The Daredevil', trope: 'Action Archeologist' });
  assert.deepEqual(names(), ['Archeology', 'Eye for Details', 'Fast Reflexes', 'Fighter', 'Get Down!',
    'Gunslinger', 'Hardened', 'That Was Close!', 'Thrill Seeker']);
  identity.role = 'The Professor';
  identity.trope = 'Born Rebel';
  assert.deepEqual(names(), ['Archeology', 'Eye for Details', 'Fix-it', 'Gunslinger', 'I Meant to Do That!',
    'Linguist', 'Maverick', 'Teamwork', 'Watch and Learn']);
  identity.role = '';
  assert.deepEqual(names(), ['Fix-it', 'Gunslinger', 'Maverick', 'Teamwork']);
  identity.role = 'The Captain';
  identity.trope = '';
  assert.deepEqual(names(), ['Fix-it', 'Guide', 'Pilot', 'Reassure', 'Saddle Up', 'Sailor']);
  for (const field of ['feats', 'gear']) {
    for (const role of ['', 'Custom role', 'toString', 'The Fortune Seeker']) {
      Object.assign(identity, { role, trope: 'constructor' });
      assert.deepEqual(itemChoices(field, identity, true), []);
      assert.strictEqual(itemChoices(field, identity, false), ITEM_CHOICES[field]);
    }
  }
});

test('gear filtering respects fixed kits, price allowances and ordinary weapon choices, never tropes', () => {
  const identity = newCharacter().identity;
  const names = role => itemChoices('gear', { ...identity, role, trope: 'Wild at Heart' }, true).map(([name]) => name).sort();
  for (const [role, expected] of [
    ['The Daredevil', ['Pistol/Revolver', 'Knife', 'Rope']],
    ['The Captain', ['Pistol/Revolver', 'Old Ride', 'Compass']],
    ['The Smuggler', ['Pistol/Revolver', 'Rope', 'Lockpicking Set']],
    ['The Technician', ['Old Rifle', 'Dynamite', 'Tool-bag', 'Knife', 'Lighter']],
    ['The Star', ['Elegant Clothes']], ['The Professor', []], ['', []],
  ]) assert.deepEqual(names(role), expected.sort());

  // Derive price groups independently from the book tables, including OCR spacing.
  const atPrice = price => ITEM_CHOICES.gear.filter(([name, page]) =>
    pageText(Number(page)).replace(/<!--[\s\S]*?-->/g, '').replaceAll('rif l e', 'rifle').split('<br>').some(line =>
      line.trim().startsWith(`${price}$`) && line.includes(name.toLowerCase()))).map(([name]) => name);
  const one = atPrice(1), two = atPrice(2);
  assert.equal(one.length, 15);
  assert.equal(two.length, 9);
  assert.deepEqual(names('The Heart'), [...one, ...two].sort());
  assert.deepEqual(names('The Scoundrel'), one.sort());
  assert.deepEqual(names('The Hunter'), [...one, 'Hunting Rifle', 'Hunting Bow'].sort());
  assert.deepEqual(names('The Guardian'), [...new Set([...one, 'Hunting Rifle', 'Shotgun', 'Machine Gun',
    'Bow', 'Hunting Bow', 'Dynamite', 'Boomerang'])].sort());
});

test('filtering preserves existing out-of-list selections, citations and the unrestricted catalogs', () => {
  const character = newCharacter();
  Object.assign(character.identity, { role: 'The Captain', trope: 'Salty Dog' });
  character.feats[4] = 'Custom feat\nLegacy notes';
  character.gear[1] = 'Rocket Launcher';
  const before = structuredClone(character);
  for (const field of ['feats', 'gear']) {
    for (const limited of [true, false, true]) {
      for (const choice of itemChoices(field, character.identity, limited)) {
        assert(ITEM_CHOICES[field].includes(choice));
      }
    }
    assert.strictEqual(itemChoices(field, character.identity, false), ITEM_CHOICES[field]);
  }
  assert.deepEqual(character, before);
});
