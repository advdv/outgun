import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCharacter, parseCharacter, markValue } from '../site/assets/character-sheet/model.ts';

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
