// ---------------------------------------------------------------------------
// config.js — every tunable number.
//
// The colony is a BURROW, not a maze: rounded chambers of varying size joined
// by tunnels of varying width, with soil hills rising from the floor. Walls
// are where the ceiling sinks down to meet the floor, so nothing is a box.
// ---------------------------------------------------------------------------

// Bumped whenever the build changes, and shown on the title screen and the
// pause card, so which version is live is never a guess.
export const BUILD = 'v3.3 · phones';

export const SPAN = 300;          // world units across one burrow level
export const FIELD = 220;         // heightfield resolution (FIELD x FIELD)
export const LEVEL_DROP = 26;     // vertical gap between levels
export const SHAFT_RADIUS = 4.2;

// Headroom below this is solid soil you cannot enter.
export const MIN_HEADROOM = 2.6;
export const CRAWL_HEADROOM = 4.0;   // below this you are squeezing; slower

export const PLAYER = {
  walkSpeed: 11.5,
  sprintSpeed: 19.5,
  crawlFactor: 0.55,
  accel: 78,
  friction: 15,
  jumpSpeed: 12.5,
  gravity: 30,
  radius: 1.0,
  height: 2.2,
  stepUp: 1.9,           // how tall a lip the ant climbs without jumping
  maxHealth: 190,

  maxStamina: 100,
  staminaDrain: 19,
  staminaRegen: 24,

  maxScent: 100,         // pheromone sense fuel
  scentDrain: 26,
  scentRegen: 7,

  invulnTime: 0.6,
  swimSpeed: 6.0,
};

// Wings: folded along the back until you dash, then they snap open and blur.
export const WING = {
  dashSpeed: 44,
  dashTime: 0.36,
  dashCooldown: 1.1,     // short enough to chain through a corridor
  dashCost: 18,
  glideFall: 6.0,
};

export const ACID = {
  boltSpeed: 92,
  boltRadius: 1.5,
  cloudRadius: 2.4,
  cloudLife: 0.95,
  cloudDps: 11,
  burstRadius: 7.0,      // the charged shot, unlocked from a boss
  burstLife: 5.0,
  burstDps: 40,
  burstCost: 12,
  burstCooldown: 6.5,
};

export const WEAPONS = {
  acid: {
    key: 'acid', name: 'Formic acid', kind: 'spray',
    damage: 30, crit: 2.0, rate: 0.14, range: 95,
    ammoMax: 70, ammoStart: 70, regen: 2.2,
    tint: 0xb6f24a, hue: '#a8e83c',
  },
  bite: {
    key: 'bite', name: 'Mandibles', kind: 'melee',
    damage: 58, crit: 1.6, rate: 0.5, range: 4.6, arc: 1.1,
    ammoMax: 0, ammoStart: 0, regen: 0,
    tint: 0xffb37a, hue: '#e08a4a',
  },
};

// Ants only. Species chosen to look distinct at a glance.
export const ENEMY_TYPES = {
  scout: {
    label: 'Red scout', speed: 9.2, hp: 38, damage: 9,
    bodyRadius: 1.0, headY: 1.2, sight: 46, hearing: 20, contact: 2.6,
    attackCd: 0.8, scale: 1.0, drop: 0.5, guard: false,
    body: 0x8e2f16, head: 0xa83a19, legs: 0x5e1e0e, gaster: 0x3a1206,
  },
  soldier: {
    label: 'Amber soldier', speed: 7.8, hp: 78, damage: 16,
    bodyRadius: 1.35, headY: 1.6, sight: 50, hearing: 24, contact: 3.1,
    attackCd: 1.0, scale: 1.5, drop: 0.7, guard: true,
    body: 0xc98a1e, head: 0xe0a62c, legs: 0x8a5c10, gaster: 0x3f2a06,
  },
  bullet: {
    label: 'Bullet ant', speed: 12.6, hp: 56, damage: 20,
    bodyRadius: 1.1, headY: 1.35, sight: 54, hearing: 30, contact: 2.7,
    attackCd: 0.6, scale: 1.25, drop: 0.8, guard: false,
    body: 0x1d1d26, head: 0x343440, legs: 0x101016, gaster: 0x0d0d14,
  },
  major: {
    label: 'Elephant major', speed: 5.6, hp: 165, damage: 30,
    bodyRadius: 2.1, headY: 2.5, sight: 44, hearing: 26, contact: 4.0,
    attackCd: 1.3, scale: 2.5, drop: 1.0, guard: true,
    body: 0x3e2d1d, head: 0x63492c, legs: 0x261b11, gaster: 0x2c2013,
  },
};

export const PICKUP_TYPES = {
  crumb:  { kind: 'food', value: 1, color: 0xd8b271, label: 'Leaf crumb' },
  seed:   { kind: 'food', value: 2, color: 0xc08a48, label: 'Seed' },
  acid:   { kind: 'acid', value: 20, color: 0xf2d54a, label: 'Honeydew' },
  nectar: { kind: 'heal', value: 50, color: 0xf06a8a, label: 'Nectar' },
};

// Chamber identities. Landmarks are how you navigate a burrow — every chamber
// looks different so you can orient yourself without a map.
export const ROOM_KINDS = [
  'brood',    // pale larvae and pupae in rows
  'larder',   // honeypot repletes hanging from the ceiling
  'fungus',   // grey-green fungus combs on mounds
  'granary',  // seed husks heaped up
  'midden',   // refuse pile: husks, dead ants, dark soil
  'gallery',  // plain tall chamber with root columns
];

export const LEVELS = [
  {
    name: 'Entrance galleries',
    tagline: 'Follow the tunnels down. Scouts work these galleries.',
    foodNeeded: 6,
    rooms: 6, roomMin: 19, roomMax: 30, tunnelMin: 5.5, tunnelMax: 9,
    height: [7, 14], hills: 7, loops: 2,
    fog: 0x2a1c10, fogDensity: 0.0125, lamp: 0xffb45e, soil: 0x6b4f30,
    enemies: { scout: 7 },
    pickups: { crumb: 9, seed: 4, acid: 4, nectar: 2 },
    repletes: 3, larvae: 4, boss: 'gatekeeper',
    hazards: [],
  },
  {
    name: 'Cistern galleries',
    tagline: 'Rain is getting in. When the water comes, ride a leaf.',
    foodNeeded: 8,
    rooms: 7, roomMin: 21, roomMax: 33, tunnelMin: 6, tunnelMax: 10,
    height: [8, 15], hills: 20, loops: 3,
    hillRadius: [11, 24], hillHeight: [5.0, 9.0], flatTops: true,
    fog: 0x16292c, fogDensity: 0.013, lamp: 0x86cfdd, soil: 0x5b5340,
    enemies: { scout: 6, soldier: 3 },
    pickups: { crumb: 10, seed: 5, acid: 5, nectar: 2 },
    repletes: 3, larvae: 4, leaves: 12, boss: 'tidecaller',
    hazards: ['flood'],
  },
  {
    name: 'The blocked deep',
    tagline: 'Cave-ins have sealed the way down. You cannot shift stone alone.',
    foodNeeded: 9,
    rooms: 7, roomMin: 20, roomMax: 32, tunnelMin: 5.5, tunnelMax: 9.5,
    height: [7, 14], hills: 8, loops: 3,
    fog: 0x24170d, fogDensity: 0.0135, lamp: 0xf0a860, soil: 0x6a4a2c,
    enemies: { scout: 6, soldier: 4, bullet: 2 },
    pickups: { crumb: 10, seed: 6, acid: 6, nectar: 3 },
    repletes: 4, larvae: 5, boss: 'stonebreaker',
    hazards: ['blockade'],
  },
  {
    name: 'Fungus deeps',
    tagline: 'The combs are guarded. Majors patrol between the mounds.',
    foodNeeded: 11,
    rooms: 8, roomMin: 22, roomMax: 34, tunnelMin: 6, tunnelMax: 10,
    height: [8, 16], hills: 10, loops: 4,
    fog: 0x1d2a1a, fogDensity: 0.013, lamp: 0x9fe08a, soil: 0x55603c,
    enemies: { scout: 6, soldier: 5, bullet: 3, major: 1 },
    pickups: { crumb: 11, seed: 7, acid: 6, nectar: 3 },
    repletes: 4, larvae: 5, boss: 'warden',
    hazards: ['collapse'],
  },
  {
    name: "The queen's vault",
    tagline: 'Everything left alive is between you and the way out.',
    foodNeeded: 12, final: true, timeLimit: 240,
    rooms: 8, roomMin: 22, roomMax: 36, tunnelMin: 6, tunnelMax: 11,
    height: [9, 17], hills: 18, loops: 4,
    hillRadius: [10, 22], hillHeight: [4.5, 8.5], flatTops: true,
    fog: 0x2a0d08, fogDensity: 0.014, lamp: 0xff7a44, soil: 0x5a3324,
    enemies: { scout: 6, soldier: 6, bullet: 4, major: 2 },
    pickups: { crumb: 12, seed: 8, acid: 8, nectar: 4 },
    repletes: 5, larvae: 6, leaves: 10, boss: 'blackqueen',
    hazards: ['flood', 'collapse', 'blockade'],
  },
];

/**
 * One champion per floor, each holding the shaft. Beating one hands you the
 * power you need for the floor below, so the fight teaches the next mechanic.
 */
export const BOSSES = {
  gatekeeper: {
    name: 'The Gatekeeper', title: 'Soldier champion of the entrance',
    hp: 560, scale: 2.2, speed: 6.6, contact: 3.8, damage: 11, attackCd: 1.3,
    sight: 56, armour: 0,
    abilities: ['charge'], cadence: 5.4, enrageAt: 0.3,
    body: 0x191922, head: 0x5a3f26, gaster: 0x0d0d14, legs: 0x0b0b10,
    aura: 0xff7a3c, grants: 'glide',
  },
  tidecaller: {
    name: 'The Tidecaller', title: 'She who opens the cistern',
    hp: 850, scale: 2.5, speed: 6.4, contact: 4.2, damage: 15, attackCd: 1.2,
    sight: 60, armour: 0.08,
    abilities: ['slam', 'summon'], cadence: 5.0, enrageAt: 0.32,
    body: 0x1b2e33, head: 0x2d4a4f, gaster: 0x0d1a1d, legs: 0x101d20,
    aura: 0x5fd6e8, grants: 'burst',
  },
  stonebreaker: {
    name: 'The Stonebreaker', title: 'Major of the blocked deep',
    hp: 1250, scale: 3.0, speed: 5.2, contact: 4.8, damage: 20, attackCd: 1.3,
    sight: 58, armour: 0.22,
    abilities: ['charge', 'slam'], cadence: 4.6, enrageAt: 0.35,
    body: 0x43301e, head: 0x6b4d2c, gaster: 0x2d2013, legs: 0x281c11,
    aura: 0xffab45, grants: 'rally',
  },
  warden: {
    name: 'The Fungus Warden', title: 'Keeper of the combs',
    hp: 1600, scale: 3.0, speed: 6.4, contact: 4.6, damage: 22, attackCd: 1.2,
    sight: 62, armour: 0.15,
    abilities: ['spray', 'summon', 'charge'], cadence: 4.2, enrageAt: 0.38,
    body: 0x35401f, head: 0x5c6b2e, gaster: 0x1d2413, legs: 0x1a2011,
    aura: 0x9fe86a, grants: 'chitin',
  },
  blackqueen: {
    name: 'The Black Queen', title: 'Mother of the whole colony',
    hp: 2400, scale: 3.8, speed: 5.8, contact: 5.4, damage: 26, attackCd: 1.2,
    sight: 70, armour: 0.22,
    abilities: ['charge', 'slam', 'summon', 'spray'], cadence: 3.6, enrageAt: 0.4,
    body: 0x14101c, head: 0x33203c, gaster: 0x090710, legs: 0x0c0912,
    aura: 0xd34bff, grants: null,
  },
};

// What beating each champion unlocks. `key` is the keyboard prompt, `touch`
// the on-screen button it maps to, because telling a phone to press Space is
// no help at all.
export const POWERS = {
  glide:  { label: 'Long glide', key: 'Space', touch: 'Fly',
    blurb: 'Hold Space after a dash and your wings carry you further.',
    touchBlurb: 'Keep Fly held after a dash and your wings carry you further.' },
  burst:  { label: 'Acid burst', key: 'R', touch: 'Burst',
    blurb: 'Hold R to charge a lungful, then release a wide cloud.',
    touchBlurb: 'Hold Burst to charge a lungful, then let go for a wide cloud.' },
  rally:  { label: 'Rally', key: 'C', touch: 'Call',
    blurb: 'Twice the nestmates answer, and they come back sooner.' },
  chitin: { label: 'Chitin plating', key: '—', touch: '—',
    blurb: 'Hardened shell. Every bite takes a third less.' },
};

/*
 * Only this many ants commit to you at a time. The rest hold back and keep
 * patrolling, so a corridor fight is a fight instead of a pile-on.
 */
export const ENGAGE = {
  maxAttackers: 3,
  maxAttackersFinal: 5,
};

export const ALARM = {
  risePerSecond: 28,
  decayPerSecond: 12,
  sightBonusAtMax: 16,
  speedBonusAtMax: 1.35,
};

// Recruitment: the power picked up on the blocked level. Calling brings
// nestmates who haul stone and fight beside you.
export const RECRUIT = {
  cooldown: 16,
  count: 4,
  life: 38,
  speed: 11.5,
  hp: 55,
  damage: 12,
  hauling: 3,        // ants needed to shift one stone plug
  haulTime: 4.2,     // seconds of work per plug
  callRadius: 30,
};
