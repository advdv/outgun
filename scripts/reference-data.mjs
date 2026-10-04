// Rebuild the reference catalog from the extracted Adventure book, not the
// character builder's smaller list of trope-offered Feats.
// node scripts/reference-data.mjs --write (or --check)
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = n => readFileSync(new URL(`html/outgunned-adventure-standalone-genre-book-v1.1-en/page-${String(n).padStart(4, '0')}.md`, root), 'utf8');
const clean = text => text.replace(/<!-- Start of picture text -->[\s\S]*?<!-- End of picture text -->/g, '')
  .replace(/\n(?:Adventurers\s*)?\*{0,2}\d+\*{0,2}\s*(?:adventure)?\s*$/i, '').trim();

export function referenceData() {
  const attributes = [];
  for (const [, name, meaning] of source(53).matchAll(/^\s*(?:- )?\*\*([^*]+):\*\* (.+)$/gm)) {
    if (['BRAWN', 'NERVES', 'SMOOTH', 'FOCUS', 'CRIME'].includes(name)) attributes.push({ name, meaning: meaning.trim(), skills: [] });
    else attributes.at(-1).skills.push({ name, meaning: meaning.trim() });
  }
  assert.equal(attributes.length, 5);
  assert(attributes.every(a => a.skills.length === 4));

  // Lightning symbols are omitted by the text extraction. Verified visually
  // against existing site/static/books/adventure/page-0055.webp … page-0061.webp
  // (printed pp. 53–59). Their meaning is in page-0054.md, printed p. 52.
  const luck = new Set([
    'BODYGUARD', 'CHIN UP', 'DISGUISE', 'EYE FOR DETAILS', 'FAST REFLEXES', 'GET DOWN!',
    'HAWKEYE', 'I MEANT TO DO THAT!', 'LINGUIST', 'MONEYBAGS', 'QUICK FINGERS',
    'REASSURE', 'SADDLE UP', 'SENSIBLE PACKER', 'TEAMWORK', 'THAT WAS CLOSE!',
    'TRAILBLAZER', 'WATCH AND LEARN',
  ]);
  const feats = [];
  for (let n = 55; n <= 61; n++) {
    const chunks = clean(source(n)).split(/^#{1,3} \*\*([^*]+)\*\*\s*$/m);
    for (let i = 1; i < chunks.length; i += 2) {
      feats.push({ name: chunks[i], body: chunks[i + 1].split('\n# Free Re-roll')[0].trim(), luck: luck.has(chunks[i]), page: n - 2 });
    }
  }
  feats.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  assert.equal(feats.length, 42);
  assert.equal(feats.filter(f => f.luck).length, 18);
  assert(feats.find(f => f.name === 'SENSIBLE PACKER').body.endsWith('after the end of this Scene.'));
  assert(feats.find(f => f.name === 'TOO YOUNG TO DIE').body.endsWith('You cannot choose this Feat while Advancing.'));

  const gearFeats = {};
  for (let n = 136; n <= 137; n++) {
    const chunks = clean(source(n)).split(/^## \*\*([^*]+)\*\*\s*$/m);
    for (let i = 1; i < chunks.length; i += 2) {
      gearFeats[chunks[i]] = chunks[i + 1].split('\n# ')[0].split('\n\nIn Outgunned Adventure we keep things simple')[0].trim();
    }
  }
  assert.equal(Object.keys(gearFeats).length, 12);
  const names = [
    'Elegant Clothes', 'Lockpicking Set', 'Tool-bag', 'Knife', 'First-aid Kit', 'Grappling Hook', 'Rope', 'Compass',
    'Winter Clothes', 'Lantern', 'Climbing Gear', 'Camping Cookware', 'Musical Instrument', 'Old Ride', 'Lighter', 'Radio',
    'Pistol/Revolver', 'Old Rifle', 'Hunting Rifle', 'Shotgun', 'Machine Gun', 'Gatling Gun', 'Bow', 'Hunting Bow',
    'Dynamite', 'Machete/Axe', 'Club/Hammer', 'Boomerang', 'Whip', 'Rocket Launcher', 'Projectiles', 'Mags (2)',
  ];
  const gear = {};
  for (const n of [134, 135]) {
    const rows = source(n).split('<!-- Start of picture text -->')[1].split('<!-- End of picture text -->')[0].trim().split('<br>').filter(s => s.trim());
    for (const raw of rows) {
      const row = raw.replaceAll('Rif l e', 'Rifle').trim();
      const name = names.filter(name => row.includes(name)).sort((a, b) => b.length - a.length)[0];
      assert(name, row);
      assert(!gear[name], `Duplicate item: ${name}`);
      let detail = row.slice(row.indexOf(name) + name.length).trim();
      const cost = row.match(/^(\d+)\$/)?.[1] ?? '—';
      const traits = Object.keys(gearFeats).filter(t => detail.toUpperCase().includes(t))
        .sort((a, b) => detail.toUpperCase().indexOf(a) - detail.toUpperCase().indexOf(b));
      for (const trait of traits) detail = detail.replace(new RegExp(trait, 'i'), '');
      detail = detail.replace('(See Weapon and Gear Feats)', '').replace(/^[\s,.]+|[\s,]+$/g, '').replace(/\.\s*\.$/, '.').trim();
      if (detail && !detail.endsWith('.')) detail += '.';
      gear[name] = { name, cost, detail, traits, page: n - 2 };
    }
  }
  assert.equal(Object.keys(gear).length, 32);
  assert.deepEqual(gear['Rocket Launcher'].traits, ['BOOM!', 'SINGLE SHOT', 'SLOW RELOAD', 'UNCOMMON']);
  assert.deepEqual(gear.Radio.traits, ['BULKY']);
  return { attributes, feats, gearFeats, gear };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('site/assets/reference-sheets.json', root);
  if (process.argv[2] === '--write') writeFileSync(target, `${JSON.stringify(referenceData(), null, 2)}\n`);
  else {
    assert.equal(process.argv[2], '--check', 'Use --write or --check');
    assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), referenceData(), 'Regenerate reference-sheets.json from the extracted book');
  }
  console.log('PASS: 5 attributes, 20 skills, 42 complete Feats, 18 verified Luck markers, 32 items and 12 gear Feats');
}
