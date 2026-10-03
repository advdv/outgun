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
// Standard roles: pp. 20–41. Tropes: pp. 44–49. Fortune Seeker is intentionally omitted.
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
} as const;
export type ChoiceField = keyof typeof IDENTITY_CHOICES;

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
