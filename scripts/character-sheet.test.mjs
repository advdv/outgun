import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { IDENTITY_CHOICES, chooseIdentity, newCharacter, parseCharacter, markValue } from '../site/assets/character-sheet/model.ts';

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
  const pageText = page => readFileSync(new URL(
    `../html/outgunned-adventure-standalone-genre-book-v1.1-en/page-${String(page + 2).padStart(4, '0')}.md`,
    import.meta.url,
  ), 'utf8').toLowerCase();
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
    ['trope', 'The Professor'], ['trope', ''],
  ]) assert.strictEqual(chooseIdentity(original, field, value), original);
});

test('legacy manual values remain intact until that field receives a book selection', () => {
  const legacy = newCharacter();
  legacy.identity.role = 'My explorer';
  legacy.identity.trope = 'My adventurer';
  const loaded = parseCharacter(JSON.stringify(legacy));
  assert.deepEqual(loaded, legacy);
  const chosen = chooseIdentity(loaded, 'role', 'The Hunter');
  assert.equal(chosen.identity.role, 'The Hunter');
  assert.equal(chosen.identity.trope, 'My adventurer');
  assert.equal(loaded.identity.role, 'My explorer');
});
