import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BASE_RATINGS, GROUPS, IDENTITY_CHOICES, ITEM_CHOICES, ROLE_ITEMS, ROLE_POINTS, TROPE_FEATS, TROPE_POINTS, WEAPONS, adventurePageUrl, changeManualPoint, chooseIdentity, chooseItem, chooseTropeAttribute, itemChoices, newCharacter, parseCharacter, markValue, ratingDetails, referencePages, tropeAttributes } from '../site/assets/character-sheet/model.ts';

const pageSource = page => readFileSync(new URL(
  `../html/outgunned-adventure-standalone-genre-book-v1.1-en/page-${String(page + 2).padStart(4, '0')}.md`,
  import.meta.url,
), 'utf8');
const pageText = page => pageSource(page).toLowerCase();

test('defaults preserve baselines and independent character records', () => {
  const a = newCharacter();
  const b = newCharacter();
  assert.equal(Object.keys(a.manualPoints).length, 25);
  assert.equal(ratingDetails(a).NERVES.total, 2);
  assert.equal(ratingDetails(a).STEALTH.total, 1);
  assert.equal(a.luck, 1);
  assert.equal(a.cash, 1);
  assert.equal(a.grit, 0);
  a.feats[1] = 'Changed';
  a.manualPoints.STEALTH = 2;
  assert.equal(b.feats[1], '');
  assert.equal(b.manualPoints.STEALTH, 0);
});

test('new defaults do not refill spent Luck or Cash in current or legacy saves', () => {
  const current = { ...newCharacter(), luck: 0, cash: 0 };
  assert.deepEqual(parseCharacter(JSON.stringify(current)), current);
  const { manualPoints, tropeAttribute, ...legacy } = current;
  legacy.version = 1;
  legacy.ratings = { ...BASE_RATINGS };
  assert.deepEqual(parseCharacter(JSON.stringify(legacy)), current);
});

test('asymmetric edited character round-trips without losing zeroes or line breaks', () => {
  const a = newCharacter();
  a.identity.name = 'Élodie van Rijn';
  a.identity.catchphrase = 'Maps lie. People lie more.';
  a.manualPoints.FOCUS = 1;
  a.manualPoints.HEAL = 1;
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
    a => a.version = 3,
    a => a.grit = 13,
    a => a.luck = -1,
    a => a.cash = 1.5,
    a => a.manualPoints.BRAWN = 2,
    a => a.manualPoints.FIGHT = 3,
    a => a.manualPoints.FIGHT = -1,
    a => a.manualPoints.FIGHT = 0.5,
    a => delete a.manualPoints.KNOW,
    a => a.manualPoints = null,
    a => a.tropeAttribute = 'BRAWN',
    a => delete a.tropeAttribute,
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

test('book image URLs preserve the site base path and two-page PDF offset', () => {
  for (const base of ['/books/adventure/', '/outgun/books/adventure/', 'https://example.com/custom/books/adventure/']) {
    assert.equal(adventurePageUrl('19', base), `${base}page-0021.webp`);
    assert.equal(adventurePageUrl(34, base), `${base}page-0036.webp`);
    assert.equal(adventurePageUrl('42', base), `${base}page-0044.webp`);
    assert.equal(adventurePageUrl(260, base), `${base}page-0262.webp`);
  }
});

test('only role references open two consecutive pages, including the last standard role', () => {
  assert.deepEqual(referencePages('role', '22'), [22, 23]);
  assert.deepEqual(referencePages('role', '40'), [40, 41]);
  for (const field of ['trope', 'background', 'age', 'flaw', 'catchphrase', 'feats', 'gear']) {
    assert.deepEqual(referencePages(field, '22'), [22]);
  }
  assert.deepEqual(referencePages('gear', '133'), [133]);
});

test('every flavor choice is available across roles and tropes without changing mechanics', () => {
  for (const [role, trope] of [['', ''], ['The Professor', 'Born Rebel'], ['The Guardian', 'Salty Dog']]) {
    const original = chooseIdentity(chooseIdentity(newCharacter(), 'role', role), 'trope', trope);
    Object.assign(original.identity, { background: 'Librarian', age: 'Old', flaw: 'A custom flaw', catchphrase: 'Keep moving!' });
    original.manualPoints.FOCUS = 1;
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

test('selections preserve manual points and other data and survive a backup round-trip', () => {
  const original = newCharacter();
  original.identity.background = 'Librarian';
  original.manualPoints.FOCUS = 1;
  original.feats[2] = 'Linguist\nSpeaks Dutch';
  original.gear[4] = 'Old map';
  original.cash = 4;
  const untouched = structuredClone(original);
  const expected = structuredClone(original);
  expected.identity.role = 'The Smuggler';
  expected.identity.trope = 'Wild at Heart';
  expected.tropeAttribute = 'BRAWN';
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
    ['trope', 'The Professor'], ['background', ''], ['age', 'Young'], ['age', 'Old'],
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

test('feat and gear catalogs cite their descriptions, with distinct source-backed entries', () => {
  for (const [field, count, pages] of [['feats', 37, [53, 54, 55, 56, 57, 58, 59]], ['gear', 34, [32, 34, 132, 133]]]) {
    const options = ITEM_CHOICES[field];
    assert.equal(options.length, count);
    assert.equal(new Set(options.map(([name]) => name)).size, count);
    assert.deepEqual([...new Set(options.map(([, page]) => Number(page)))].sort((a, b) => a - b), pages);
    for (const [name, page] of options) {
      // The extraction splits the ligature in "Rifle" into "Rif l e".
      const source = pageText(Number(page)).replaceAll('rif l e', 'rifle');
      // A mention in another feat's example is not the feat's description.
      const entries = field === 'feats' ? [...source.matchAll(/^#+ \*\*(.+)\*\*\s*$/gm)].map(match => match[1]) : [source];
      assert(entries.some(entry => field === 'feats' ? entry === name.toLowerCase() : entry.includes(name.toLowerCase())),
        `Incorrect text or page for ${field}: ${name}`);
    }
  }
  // Changing citations must not add role-only or age-only feats to the catalog.
  assert.deepEqual(ITEM_CHOICES.feats.map(([name]) => name).sort(), [...new Set(Object.values(TROPE_FEATS).flat())].sort());
  assert.equal(ITEM_CHOICES.gear.filter(([, page]) => page === '132').length, 16);
  assert.equal(ITEM_CHOICES.gear.filter(([, page]) => page === '133').length, 16);
  assert.equal(adventurePageUrl('53', '/books/adventure/'), '/books/adventure/page-0055.webp');
  assert.equal(adventurePageUrl('59', '/books/adventure/'), '/books/adventure/page-0061.webp');
  assert.equal(adventurePageUrl('132', '/books/adventure/'), '/books/adventure/page-0134.webp');
  assert.equal(adventurePageUrl('133', '/books/adventure/'), '/books/adventure/page-0135.webp');
});

test('every feat has its own complete italic introduction from its cited page', () => {
  for (const [name, page, description] of ITEM_CHOICES.feats) {
    const entries = [...pageSource(Number(page)).matchAll(/^#+ \*\*(.+)\*\*\s*\n+_([^_]+)_/gm)];
    const introduction = entries.find(([, heading]) => heading === name.toUpperCase())?.[2];
    assert(introduction, `Missing source introduction for ${name}`);
    assert.equal(description, introduction, `${name}: use the full introduction, not mechanics or another feat's text`);
  }
});

test('weapon grouping includes knives and uncommon weapons but excludes ammunition and tools', () => {
  const weapons = ITEM_CHOICES.gear.filter(([name]) => WEAPONS.includes(name)).map(([name]) => name);
  assert.equal(weapons.length, 15);
  assert.equal(new Set(WEAPONS).size, 15);
  for (const name of ['Knife', 'Gatling Gun', 'Rocket Launcher', 'Dynamite', 'Machete/Axe', 'Club/Hammer', 'Whip']) {
    assert(weapons.includes(name), `${name} should be a weapon regardless of its page or rarity`);
  }
  for (const name of ['Projectiles', 'Mags (2)', 'Tool-bag', 'Grappling Hook', 'Rope', 'Lighter']) {
    assert(!WEAPONS.includes(name), `${name} is not a weapon`);
  }
});

test('any role or trope can select and clear any item in any slot without altering other data', () => {
  for (const [role, trope] of [['', ''], ['The Professor', 'Born Rebel'], ['The Guardian', 'Salty Dog']]) {
    const original = chooseIdentity(chooseIdentity(newCharacter(), 'role', role), 'trope', trope);
    original.feats = ['Custom feat\nWith notes', 'Artist', '', 'Guide', 'Sailor', 'Linguist'];
    original.gear = ['Old map', '', 'Compass', 'Radio', 'Knife', 'Rope'];
    original.manualPoints.FOCUS = 1;
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
    ['The Star', ['Elegant Clothes', 'Precious item of choice']], ['The Professor', ['Diary and pencil']], ['', []],
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

test('all point-grant lists match the book columns: ten role skills, eight trope skills', () => {
  const title = name => name[0] + name.slice(1).toLowerCase();
  const skillPattern = new RegExp(`\\b(${GROUPS.flatMap(([, skills]) => skills).map(title).join('|')})(?![-a-zA-Z])\\b`, 'g');
  const attributePattern = /\b(Brawn|Nerves|Smooth|Focus|Crime)\b/g;
  for (const [field, data, count] of [['role', ROLE_POINTS, 10], ['trope', TROPE_POINTS, 8]]) {
    assert.deepEqual(Object.keys(data).sort(), IDENTITY_CHOICES[field].map(([name]) => name).sort());
    for (const [name, page] of IDENTITY_CHOICES[field]) {
      let source = pageSource(Number(page));
      if (field === 'trope') source = source.split(/^# <mark>/m).find(section => section.toLowerCase().startsWith(`${name.toLowerCase()}</mark>`));
      source = source.slice(source.indexOf('**Attribute Point:'));
      const actualSkills = [...new Set([...source.matchAll(skillPattern)].map(match => match[1].toUpperCase()))];
      const actualAttributes = [...new Set([...source.matchAll(attributePattern)].map(match => match[1].toUpperCase()))];
      assert.equal(data[name].skills.length, count, name);
      assert.equal(data[name].attributes.length, field === 'role' ? 1 : 2, name);
      assert.deepEqual([...data[name].skills].sort(), actualSkills.sort(), name);
      assert.deepEqual([...data[name].attributes].sort(), actualAttributes.sort(), name);
    }
  }
});

test('every role/trope combination grants two attributes and eighteen skills without accumulating points', () => {
  let c = newCharacter();
  for (const [role] of IDENTITY_CHOICES.role) {
    for (const [trope] of IDENTITY_CHOICES.trope) {
      c = chooseIdentity(chooseIdentity(c, 'role', role), 'trope', trope);
      const details = ratingDetails(c);
      assert.equal(GROUPS.reduce((sum, [attribute]) => sum + details[attribute].total - 2, 0), 2, `${role}/${trope}`);
      assert.equal(GROUPS.flatMap(([, skills]) => skills).reduce((sum, skill) => sum + details[skill].total - 1, 0), 18);
      assert(Object.values(details).every(p => p.overlap === 0 && p.total <= 3));
      assert.deepEqual(chooseIdentity(chooseIdentity(c, 'role', role), 'trope', trope), c);
      assert.deepEqual(parseCharacter(JSON.stringify(c)), c);
      const cleared = chooseIdentity(chooseIdentity(c, 'trope', ''), 'role', '');
      assert.deepEqual(cleared, newCharacter());
    }
  }
});

test('role and trope skill overlap stacks, while clearing one removes only its contribution', () => {
  let c = chooseIdentity(chooseIdentity(newCharacter(), 'role', 'The Daredevil'), 'trope', 'Action Archeologist');
  assert.equal(c.tropeAttribute, 'FOCUS');
  assert.deepEqual(Object.fromEntries(Object.entries(ratingDetails(c)).map(([key, value]) => [key, value.total])), {
    BRAWN: 3, ENDURE: 2, FIGHT: 3, FORCE: 1, STUNT: 3,
    NERVES: 2, COOL: 2, DRIVE: 1, SHOOT: 3, SURVIVAL: 2,
    SMOOTH: 2, FLIRT: 2, LEADERSHIP: 2, SPEECH: 2, STYLE: 1,
    FOCUS: 3, DETECT: 2, FIX: 1, HEAL: 1, KNOW: 2,
    CRIME: 2, AWARENESS: 1, DEXTERITY: 2, STEALTH: 3, STREETWISE: 2,
  });
  c = chooseIdentity(c, 'role', '');
  assert.equal(ratingDetails(c).BRAWN.total, 2);
  assert.equal(ratingDetails(c).FOCUS.total, 3);
  assert.equal(ratingDetails(c).FIGHT.total, 2);
  assert.equal(ratingDetails(c).ENDURE.total, 1);
  assert.equal(ratingDetails(c).KNOW.total, 2);
  c = chooseIdentity(c, 'trope', '');
  assert.deepEqual(c, newCharacter());
});

test('trope attribute choice respects the role, preserves valid choices, and avoids manual overlap by default', () => {
  let c = changeManualPoint(newCharacter(), 'BRAWN', 3);
  c = chooseIdentity(c, 'trope', 'Action Archeologist');
  assert.equal(c.tropeAttribute, 'FOCUS');
  assert.deepEqual(tropeAttributes(c.identity), ['BRAWN', 'FOCUS']);
  c = chooseTropeAttribute(c, 'BRAWN');
  assert.equal(ratingDetails(c).BRAWN.overlap, 1);
  c = chooseIdentity(c, 'role', 'The Daredevil');
  assert.deepEqual(tropeAttributes(c.identity), ['FOCUS']);
  assert.equal(c.tropeAttribute, 'FOCUS');
  assert.strictEqual(chooseTropeAttribute(c, 'BRAWN'), c);
  assert.strictEqual(chooseTropeAttribute(c, 'NERVES'), c);
  c = chooseIdentity(c, 'role', 'The Captain');
  assert.equal(c.tropeAttribute, 'FOCUS');
  c = chooseIdentity(c, 'role', 'The Professor');
  assert.equal(c.tropeAttribute, 'BRAWN');
  assert.equal(c.manualPoints.BRAWN, 1);
  assert.throws(() => parseCharacter(JSON.stringify({ ...c, tropeAttribute: 'FOCUS' })));
  assert.throws(() => parseCharacter(JSON.stringify({ ...c, tropeAttribute: '' })));
});

test('manual additions survive capped grants, switching, clearing and round-trips', () => {
  let c = changeManualPoint(newCharacter(), 'FIGHT', 3);
  c = changeManualPoint(c, 'HEAL', 2);
  c = changeManualPoint(c, 'SMOOTH', 3);
  const original = structuredClone(c);
  for (const [role] of IDENTITY_CHOICES.role) {
    for (const [trope] of IDENTITY_CHOICES.trope) {
      c = chooseIdentity(chooseIdentity(c, 'role', role), 'trope', trope);
      assert.deepEqual(c.manualPoints, original.manualPoints);
      assert(Object.values(ratingDetails(c)).every(p => p.total <= 3 && p.manual <= p.total - p.base));
      c = parseCharacter(JSON.stringify(c));
      const cleared = chooseIdentity(chooseIdentity(c, 'role', ''), 'trope', '');
      assert.deepEqual(cleared, original);
    }
  }
  c = chooseIdentity(chooseIdentity(original, 'role', 'The Daredevil'), 'trope', 'Action Archeologist');
  assert.deepEqual(ratingDetails(c).FIGHT, { base: 1, manual: 2, granted: 2, total: 3, overlap: 2 });
  c = changeManualPoint(c, 'FIGHT', 3);
  assert.deepEqual(ratingDetails(c).FIGHT, { base: 1, manual: 1, granted: 2, total: 3, overlap: 1 });
  c = changeManualPoint(c, 'FIGHT', 3);
  assert.deepEqual(ratingDetails(c).FIGHT, { base: 1, manual: 0, granted: 2, total: 3, overlap: 0 });
  assert.strictEqual(changeManualPoint(c, 'FIGHT', 3), c, 'automatic point is locked');
  assert.equal(c.manualPoints.HEAL, 1);
  c = chooseIdentity(chooseIdentity(c, 'role', ''), 'trope', '');
  assert.equal(ratingDetails(c).FIGHT.total, 1);
  assert.equal(ratingDetails(c).HEAL.total, 2);
  assert.equal(ratingDetails(c).SMOOTH.total, 3);
});

test('manual clicks fill empty slots, remove only blue points and never alter grants', () => {
  let c = chooseIdentity(newCharacter(), 'role', 'The Captain');
  c = changeManualPoint(c, 'SHOOT', 3);
  assert.equal(c.manualPoints.SHOOT, 1);
  assert.equal(ratingDetails(c).SHOOT.total, 3);
  assert.strictEqual(changeManualPoint(c, 'SHOOT', 2), c);
  c = changeManualPoint(c, 'SHOOT', 3);
  assert.equal(c.manualPoints.SHOOT, 0);
  assert.equal(ratingDetails(c).SHOOT.total, 2);
  c = changeManualPoint(c, 'FORCE', 3);
  assert.equal(c.manualPoints.FORCE, 2);
  c = changeManualPoint(c, 'FORCE', 2);
  assert.equal(c.manualPoints.FORCE, 0);
  for (const point of [0, -1, 4, 1.5]) assert.strictEqual(changeManualPoint(c, 'FORCE', point), c);
});

test('v1 migration preserves every manual addition and never reapplies bonuses on subsequent loads', () => {
  const { manualPoints, tropeAttribute, ...old } = newCharacter();
  old.version = 1;
  old.ratings = { ...BASE_RATINGS, NERVES: 3, FORCE: 3, KNOW: 2 };
  Object.assign(old.identity, { role: 'The Captain', trope: 'Salty Dog' });
  old.gear[5] = 'Legacy item';
  let c = parseCharacter(JSON.stringify(old));
  assert.equal(c.version, 2);
  assert.equal(c.tropeAttribute, 'FOCUS');
  assert.deepEqual(c.manualPoints, { ...manualPoints, NERVES: 1, FORCE: 2, KNOW: 1 });
  assert.equal(ratingDetails(c).NERVES.overlap, 1);
  for (let i = 0; i < 3; i++) assert.deepEqual(parseCharacter(JSON.stringify(c)), c);
  c = chooseIdentity(chooseIdentity(c, 'role', ''), 'trope', '');
  assert.deepEqual(Object.fromEntries(Object.entries(ratingDetails(c)).map(([key, value]) => [key, value.total])), old.ratings);
  assert.equal(c.gear[5], 'Legacy item');
  for (const invalid of [{ ...old.ratings, NERVES: 1 }, { ...old.ratings, FORCE: 4 }]) {
    assert.throws(() => parseCharacter(JSON.stringify({ ...old, ratings: invalid })));
  }
});
