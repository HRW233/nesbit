/**
 * Hobbies are the slow part of the bird: picked up, practised, and levelled
 * over sessions. They persist in localStorage and each one has a real activity
 * behind it, not just a counter.
 */
export const HOBBIES = [
  {
    id: 'watching',
    name: 'Birdwatching',
    line: 'He reads up on other birds and takes notes on them.',
    prompt: 'unusual bird',
    spot: 'lookout',
    verb: 'watching',
  },
  {
    id: 'mapping',
    name: 'Cartography',
    line: 'He draws the island badly and with total conviction.',
    spot: 'shore',
    verb: 'surveying',
  },
  {
    id: 'verse',
    name: 'Verse',
    line: 'Short poems, written between two flights.',
    spot: 'grove',
    verb: 'writing',
  },
  {
    id: 'webcraft',
    name: 'Webcraft',
    line: 'He builds little websites for things nobody asked about.',
    spot: 'nest',
    verb: 'building',
  },
  {
    id: 'coding',
    name: 'Coding',
    line: 'Small interactive toys, mostly clocks and particles.',
    spot: 'nest',
    verb: 'tinkering',
  },
  {
    id: 'gardening',
    name: 'Gardening',
    line: 'He plants palms on the island and checks on them.',
    spot: 'grove',
    verb: 'planting',
  },
];

export const LEVELS = [
  { at: 0, name: 'curious' },
  { at: 24, name: 'keen' },
  { at: 60, name: 'devoted' },
  { at: 120, name: 'obsessed' },
];

export function levelOf(xp = 0) {
  let current = LEVELS[0];
  for (const level of LEVELS) if (xp >= level.at) current = level;
  const next = LEVELS.find((level) => level.at > xp) || null;
  return { ...current, next };
}

export function findHobby(text) {
  const lower = text.toLowerCase();
  return HOBBIES.find((hobby) => lower.includes(hobby.name.toLowerCase()) || lower.includes(hobby.id));
}

export function emptyHobbies() {
  const out = {};
  for (const hobby of HOBBIES) out[hobby.id] = { xp: 0, sessions: 0, since: null, last: null };
  return out;
}
