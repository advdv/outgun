import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { IDENTITY_CHOICES, adventurePageUrl, chooseIdentity, newCharacter, parseCharacter, markValue } from '../site/assets/character-sheet/model.ts';

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
