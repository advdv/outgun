export const GROUPS = [
  ['BRAWN', ['ENDURE', 'FIGHT', 'FORCE', 'STUNT']],
  ['NERVES', ['COOL', 'DRIVE', 'SHOOT', 'SURVIVAL']],
  ['SMOOTH', ['FLIRT', 'LEADERSHIP', 'SPEECH', 'STYLE']],
  ['FOCUS', ['DETECT', 'FIX', 'HEAL', 'KNOW']],
  ['CRIME', ['AWARENESS', 'DEXTERITY', 'STEALTH', 'STREETWISE']],
] as const;

export const IDENTITY = ['name', 'role', 'trope', 'background', 'age', 'flaw', 'catchphrase'] as const;
export type IdentityKey = typeof IDENTITY[number];

// Outgunned Adventure, printed pages (the extracted files are numbered two higher).
// Standard roles: pp. 20–41. Tropes: pp. 44–49. Fortune Seeker is omitted as a role.
// Personal-data suggestions are pooled across roles, with duplicates listed once.
export const IDENTITY_CHOICES = {
  role: [
    ['The Daredevil', '22'], ['The Guardian', '24'], ['The Captain', '26'],
    ['The Hunter', '28'], ['The Heart', '30'], ['The Star', '32'],
    ['The Professor', '34'], ['The Technician', '36'], ['The Scoundrel', '38'],
    ['The Smuggler', '40'],
  ],
  trope: [
    ['Action Archeologist', '45'], ['Adventuring Author', '45'], ['Born Rebel', '45'],
    ['Cold and Distant', '46'], ['Cowardly Lion', '46'], ['Detestable Bastard', '46'],
    ['Dreamer', '47'], ['Flying Steamroller', '47'], ['Gentle Giant', '47'],
    ['Indispensable Rogue', '48'], ['Parental Figure', '48'], ['Proper Gentleman/Lady', '48'],
    ['Reluctant Hero', '49'], ['Salty Dog', '49'], ['Wild at Heart', '49'],
  ],
  background: [
    ['Former Soldier', '22'], ['Explorer', '22'], ['Tomb Robber', '22'],
    ['Bodyguard', '24'], ['Field Medic', '24'], ['Ancient Order', '24'],
    ['Aviator', '26'], ['Ship Captain', '26'], ['Veteran', '26'],
    ['Saved by Natives', '28'], ['Poacher', '28'], ['Military Veteran', '28'],
    ['Musician', '30'], ['Cook', '30'], ['University Professor', '30'],
    ['Heir', '32'], ['Great Performer', '32'], ['Aristocrat', '32'],
    ['Librarian', '34'], ['Researcher', '34'],
    ['Mechanic', '36'], ['Demolition Expert', '36'], ['Sapper', '36'],
    ['Criminal', '38'], ['Salesperson', '38'],
    ['Archeologist', '40'], ['Grave Robber', '40'], ['Pilot', '40'],
  ],
  age: [['Adult', '19']],
  flaw: [
    ['I’m afraid of spiders', '18'],
    ['I act without thinking', '22'], ['I never back down from a challenge', '22'], ['I hide a dangerous secret', '22'],
    ['I never change my mind', '24'], ['I don’t cooperate with the enemy', '24'], ['My mission comes first', '24'],
    ['I can’t resist a challenge', '26'], ['I have a debt to repay', '26'], ['I have a peg-leg', '26'],
    ['I’m obsessed with the past', '28'], ['I never listen to advice', '28'], ['I have an old wound', '28'],
    ['I believe I can save everyone', '30'], ['I feel like a burden', '30'], ['I always have to do what’s right', '30'],
    ['I hate getting dirty', '32'], ["I'm afraid of bugs", '32'], ['I’m picky about food', '32'],
    ['I always have a theory to test', '34'], ['I don’t know when to shut up', '34'], ['Without my glasses, I am nearly blind', '34'],
    ['I don’t take advice', '36'], ['I’m a fatalist and a pessimist', '36'], ['I can’t swim', '36'],
    ['I never tell the whole truth', '38'], ['I have a secret', '38'], ['I never go first', '38'],
    ['I need money', '40'], ['I have unfinished business', '40'], ['I don’t believe in my friends', '40'],
    ['I never know when to stop', '42'], ['I always put the Treasure first', '42'], ['I have an eyepatch', '42'],
  ],
  catchphrase: [
    ['I’ve had worse!', '18'],
    ['Leave it to me', '22'], ['Nothing ventured nothing gained', '22'], ['I only gamble with my life', '22'],
    ['If it were to fall into the wrong hands…', '24'], ['Nobody gets left behind', '24'], ['Go! I’ll take care of this', '24'],
    ['I chart my own course', '26'], ['Of course I can drive that', '26'], ['First time for everything', '26'],
    ['Try not to do anything stupid', '28'], ['I don’t like this silence', '28'], ['You can never win against Nature', '28'],
    ['We can do this. Together', '30'], ['We won’t let this stop us', '30'], ['You’re stronger than you think', '30'],
    ['I performed in the greatest theaters', '32'], ['No one says no to me', '32'], ['Everything has a price', '32'],
    ['I’ve read it in a book', '34'], ['We never stop learning', '34'], ['The pen is mightier than the sword', '34'],
    ['It doesn’t work like that…', '36'], ['What did I tell you?', '36'], ['Step back a little', '36'],
    ['Do you trust me?', '38'], ['I’ve never seen this man before', '38'], ['It’s fine, they will never find us', '38'],
    ["Who d’you think you're talking to?", '40'], ['They don’t need it anymore', '40'], ['Either I do this, or somebody else will', '40'],
    ['Could we talk about it later?', '42'], ['I’m sorry, I have to do this', '42'], ['I am the master of my own destiny', '42'],
  ],
} as const;
export type ChoiceField = keyof typeof IDENTITY_CHOICES;

// All distinct feats offered by the tropes on pp. 45–49, cited at first occurrence.
// Gear follows the equipment tables on pp. 132–133; neither list is role/trope-limited.
export const ITEM_CHOICES = {
  feats: [
    ['Archeology', '45'], ['Artist', '45'], ['Big and Strong', '47'], ['Bodyguard', '47'],
    ['Chin Up', '47'], ['Disguise', '46'], ['Estimate', '49'], ['Explorer', '47'],
    ['Eye for Details', '45'], ['Fast Reflexes', '45'], ['Favored Weapon', '48'], ['Fighter', '47'],
    ['Fix-it', '45'], ['Get Down!', '46'], ['Guide', '46'], ['Gunslinger', '45'],
    ['Hardened', '47'], ['Heartbreaker', '47'], ['I Meant to Do That!', '46'], ['Linguist', '45'],
    ['Lockpicker', '48'], ['Maverick', '45'], ['Moneybags', '48'], ['Pilot', '47'],
    ['Quick and Nimble', '46'], ['Quick Fingers', '46'], ['Reassure', '47'], ['Saddle Up', '46'],
    ['Sailor', '49'], ['Silver Tongue', '45'], ['Skulker', '49'], ['Subterfuge', '46'],
    ['Teamwork', '45'], ['That Was Close!', '49'], ['Thrill Seeker', '45'], ['Trailblazer', '48'],
    ['Watch and Learn', '47'],
  ],
  gear: [
    ['Elegant Clothes', '132'], ['Lockpicking Set', '132'], ['Tool-bag', '132'], ['Knife', '132'],
    ['First-aid Kit', '132'], ['Grappling Hook', '132'], ['Rope', '132'], ['Compass', '132'],
    ['Winter Clothes', '132'], ['Lantern', '132'], ['Climbing Gear', '132'], ['Camping Cookware', '132'],
    ['Musical Instrument', '132'], ['Old Ride', '132'], ['Lighter', '132'], ['Radio', '132'],
    ['Pistol/Revolver', '133'], ['Old Rifle', '133'], ['Hunting Rifle', '133'], ['Shotgun', '133'],
    ['Machine Gun', '133'], ['Gatling Gun', '133'], ['Bow', '133'], ['Hunting Bow', '133'],
    ['Dynamite', '133'], ['Machete/Axe', '133'], ['Club/Hammer', '133'], ['Boomerang', '133'],
    ['Whip', '133'], ['Rocket Launcher', '133'], ['Projectiles', '133'], ['Mags (2)', '133'],
  ],
} as const;
export type ItemField = keyof typeof ITEM_CHOICES;

// Item-of-choice allowances use the prices on pp. 132–133. Uncommon weapons
// need the Director's approval (p. 134), so are not ordinary starting choices.
const ONE_CASH_GEAR = ['Tool-bag', 'Knife', 'Grappling Hook', 'Rope', 'Compass', 'Winter Clothes',
  'Lantern', 'Camping Cookware', 'Lighter', 'Pistol/Revolver', 'Old Rifle', 'Machete/Axe', 'Club/Hammer', 'Whip', 'Mags (2)'];
const TWO_CASH_GEAR = ['Lockpicking Set', 'First-aid Kit', 'Climbing Gear', 'Musical Instrument',
  'Hunting Rifle', 'Shotgun', 'Bow', 'Dynamite', 'Boomerang'];
const COMMON_WEAPONS = ['Knife', 'Pistol/Revolver', 'Old Rifle', 'Hunting Rifle', 'Shotgun', 'Machine Gun',
  'Bow', 'Hunting Bow', 'Dynamite', 'Machete/Axe', 'Club/Hammer', 'Boomerang', 'Whip'];

// Role starting choices, pp. 22–40. Lists are intersected with ITEM_CHOICES:
// this filter does not expand the catalogs or enforce quantities/either-or picks.
export const ROLE_ITEMS = {
  'The Daredevil': {
    feats: ['Fighter', 'Get Down!', 'Gunslinger', 'Hardened', 'That Was Close!', 'Thrill Seeker'],
    gear: ['Pistol/Revolver', 'Knife', 'Rope'],
  },
  'The Guardian': {
    feats: ['Big and Strong', 'Bodyguard', 'Explorer', 'Favored Weapon', 'Hardened', 'Physician'],
    gear: [...COMMON_WEAPONS, ...ONE_CASH_GEAR],
  },
  'The Captain': {
    feats: ['Fix-it', 'Guide', 'Pilot', 'Reassure', 'Saddle Up', 'Sailor'],
    gear: ['Pistol/Revolver', 'Old Ride', 'Compass'],
  },
  'The Hunter': {
    feats: ['Explorer', 'Favored Weapon', 'Guide', 'Hardened', 'Hawkeye', 'Skulker'],
    gear: ['Hunting Rifle', 'Hunting Bow', 'Knife', ...ONE_CASH_GEAR],
  },
  'The Heart': {
    feats: ['Artist', 'Chin Up', 'Physician', 'Reassure', 'Silver Tongue', 'That Was Close!'],
    gear: [...ONE_CASH_GEAR, ...TWO_CASH_GEAR],
  },
  'The Star': {
    feats: ['Artist', 'Heartbreaker', 'I Meant to Do That!', 'Maverick', 'Moneybags', 'That Was Close!'],
    gear: ['Elegant Clothes'], // The precious item is not in the equipment catalog.
  },
  'The Professor': {
    feats: ['Archeology', 'Eye for Details', 'I Meant to Do That!', 'Linguist', 'Specialist', 'Watch and Learn'],
    gear: [], // Diary and pencil are not in the equipment catalog.
  },
  'The Technician': {
    feats: ['Big and Strong', 'Fix-it', 'Pilot', 'Sensible Packer', 'Specialist', 'Trailblazer'],
    gear: ['Old Rifle', 'Dynamite', 'Tool-bag', 'Knife', 'Lighter'],
  },
  'The Scoundrel': {
    feats: ['Disguise', 'Quick and Nimble', 'Quick Fingers', 'Sensible Packer', 'Subterfuge', 'That Was Close!'],
    gear: ['Knife', 'Lighter', ...ONE_CASH_GEAR],
  },
  'The Smuggler': {
    feats: ['Archeology', 'Estimate', 'Lockpicker', 'Maverick', 'Quick Fingers', 'Subterfuge'],
    gear: ['Pistol/Revolver', 'Rope', 'Lockpicking Set'],
  },
} satisfies Record<typeof IDENTITY_CHOICES.role[number][0], { feats: string[]; gear: string[] }>;

export const TROPE_FEATS = {
  'Action Archeologist': ['Archeology', 'Eye for Details', 'Fast Reflexes', 'Thrill Seeker'],
  'Adventuring Author': ['Artist', 'Eye for Details', 'Linguist', 'Silver Tongue'],
  'Born Rebel': ['Fix-it', 'Gunslinger', 'Maverick', 'Teamwork'],
  'Cold and Distant': ['Get Down!', 'Guide', 'Gunslinger', 'Quick and Nimble'],
  'Cowardly Lion': ['I Meant to Do That!', 'Quick and Nimble', 'Saddle Up', 'Silver Tongue'],
  'Detestable Bastard': ['Disguise', 'Linguist', 'Quick Fingers', 'Subterfuge'],
  'Dreamer': ['Explorer', 'I Meant to Do That!', 'Reassure', 'Watch and Learn'],
  'Flying Steamroller': ['Fix-it', 'Hardened', 'Heartbreaker', 'Pilot'],
  'Gentle Giant': ['Big and Strong', 'Bodyguard', 'Chin Up', 'Fighter'],
  'Indispensable Rogue': ['Fix-it', 'Lockpicker', 'Quick Fingers', 'Trailblazer'],
  'Parental Figure': ['Archeology', 'Chin Up', 'Reassure', 'Silver Tongue'],
  'Proper Gentleman/Lady': ['Archeology', 'Favored Weapon', 'Heartbreaker', 'Moneybags'],
  'Reluctant Hero': ['Gunslinger', 'Reassure', 'That Was Close!', 'Thrill Seeker'],
  'Salty Dog': ['Estimate', 'Fix-it', 'Hardened', 'Sailor'],
  'Wild at Heart': ['Explorer', 'Favored Weapon', 'Guide', 'Skulker'],
} satisfies Record<typeof IDENTITY_CHOICES.trope[number][0], string[]>;

export function itemChoices(field: ItemField, identity: Character['identity'], limited: boolean) {
  if (!limited) return ITEM_CHOICES[field];
  const role = Object.entries(ROLE_ITEMS).find(([name]) => name === identity.role)?.[1];
  const trope = Object.entries(TROPE_FEATS).find(([name]) => name === identity.trope)?.[1] ?? [];
  return ITEM_CHOICES[field].filter(([name]) =>
    role?.[field].some(item => item === name) || (field === 'feats' && trope.includes(name)));
}

export function referencePages(field: ChoiceField | ItemField, page: string) {
  const first = Number(page);
  return field === 'role' ? [first, first + 1] : [first];
}

export function adventurePageUrl(page: number | string, base: string) {
  const extractedPage = String(Number(page) + 2).padStart(4, '0');
  return `${base}page-${extractedPage}.webp`;
}

export type Character = {
  version: 1;
  identity: Record<IdentityKey, string>;
  ratings: Record<string, number>;
  luck: number;
  grit: number;
  cash: number;
  feats: string[];
  gear: string[];
  ammo: number[];
  backpack: string;
  bag: string;
  portrait: string | null;
};

export const STORAGE_KEY = 'outgun.character.v1';
export const MAX_BACKUP_BYTES = 1_000_000;

export function newCharacter(): Character {
  return {
    version: 1,
    identity: Object.fromEntries(IDENTITY.map(key => [key, ''])) as Character['identity'],
    ratings: Object.fromEntries(GROUPS.flatMap(([attribute, skills]) => [
      [attribute, 2], ...skills.map(skill => [skill, 1]),
    ])),
    luck: 0, grit: 0, cash: 0,
    feats: Array(6).fill(''), gear: Array(6).fill(''), ammo: [0, 0, 0],
    backpack: '', bag: '', portrait: null,
  };
}

export function chooseIdentity(character: Character, field: ChoiceField, value: string): Character {
  if (!IDENTITY_CHOICES[field].some(([name]) => name === value)) return character;
  return { ...character, identity: { ...character.identity, [field]: value } };
}

export function chooseItem(character: Character, field: ItemField, index: number, value: string): Character {
  if (value !== '' && !ITEM_CHOICES[field].some(([name]) => name === value)) return character;
  return { ...character, [field]: character[field].map((item, i) => i === index ? value : item) };
}

// Click a mark to fill through it; click the final filled mark to erase it.
export function markValue(current: number, mark: number, minimum = 0) {
  return Math.max(minimum, current === mark ? mark - 1 : mark);
}

export function parseCharacter(raw: string): Character {
  if (raw.length > MAX_BACKUP_BYTES) throw new Error('This backup is too large.');
  const value = JSON.parse(raw);
  const invalid = () => { throw new Error('This is not a valid version 1 character backup.'); };
  const record = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid();
  const string = (v: unknown, max = 4000): string =>
    typeof v === 'string' && v.length <= max ? v : invalid();
  const number = (v: unknown, min: number, max: number): number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : invalid();
  const list = (v: unknown, count: number): unknown[] =>
    Array.isArray(v) && v.length === count ? v : invalid();
  const data = record(value);
  if (data.version !== 1) invalid();
  const identity = record(data.identity);
  const ratings = record(data.ratings);
  const result = newCharacter();
  for (const key of IDENTITY) result.identity[key] = string(identity[key], 300);
  for (const [attribute, skills] of GROUPS) {
    result.ratings[attribute] = number(ratings[attribute], 2, 3);
    for (const skill of skills) result.ratings[skill] = number(ratings[skill], 1, 3);
  }
  result.luck = number(data.luck, 0, 6);
  result.grit = number(data.grit, 0, 12);
  result.cash = number(data.cash, 0, 5);
  result.feats = list(data.feats, 6).map(v => string(v));
  result.gear = list(data.gear, 6).map(v => string(v, 300));
  result.ammo = list(data.ammo, 3).map(v => number(v, 0, 3));
  result.backpack = string(data.backpack);
  result.bag = string(data.bag);
  if (data.portrait !== null) {
    const portrait = string(data.portrait, 600_000);
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(portrait)) invalid();
    result.portrait = portrait;
  }
  return result;
}
