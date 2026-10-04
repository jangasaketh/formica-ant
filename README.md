# Formica — the deep burrow

**Build v3** — playtest fixes. The title screen and the pause card show the
build string, so you can tell at a glance which version is live.

What changed from v2, all from playtest feedback:

- **The freeze when firing acid is gone.** Each shot was creating two new
  PointLights, and changing the light count makes Three.js recompile every
  material in the scene. Measured: shader programs went 23 to 114 during
  sustained fire. They are now constant at 23, and the live light count never
  moves off 6.
- **Wings and sprint from the first floor.** The dash used to be locked behind
  the first champion, so it looked as though the ant could not fly at all.
  The Gatekeeper now grants a longer glide instead.
- **Much brighter.** Ambient, lamps, the ant's own lantern and exposure all
  raised, fog thinned, and the crevice shading no longer crushes to black.
- **An objective bar.** Always on screen: what to do next, how far away it is,
  and an arrow that points at it however the camera is turned.
- **A readable map.** Bigger, the burrow layout visible rather than blacked
  out, a pulsing DOWN marker on the shaft, a crop counter and a legend.
- **Champions you can beat.** All five are smaller and softer; the Gatekeeper
  went from 1250 hp at scale 3.4 to 560 at 2.2.
- **Three ants engage at a time.** The rest shadow you in a loose ring instead
  of the whole floor arriving at once.
- **Red and amber ants**, not a wall of black.
- **The pointer lock error is handled.** Browsers refuse a re-lock for about a
  second after you leave one; the game now waits that out and tells you if it
  is still blocked.
- **A reason to be down there.** Your queen was taken in a raid and is held on
  the fifth floor. Everything else is in service of getting her back.

A 3D browser game. You are a fire ant working down through five floors of a
living ant burrow, feeding as you go, with the colony trying to kill you.

No build step, no bundler, no external assets. Three.js is vendored, the ant
and the soil are generated in code, and the soundtrack is synthesised at
runtime — so the whole thing works offline and the repo stays small.

## Run it

Every file sits in one folder. Serve it and open the address it prints:

```bash
npx serve .                  # Node
python -m http.server 8000   # Windows
py -m http.server 8000       # Windows, launcher
python3 -m http.server 8000  # macOS / Linux
```

Or push all the files to a GitHub repo root and turn on Pages
(**Settings → Pages → Deploy from a branch → main / (root)**).

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move · Shift to run |
| Mouse | Aim. Left click sprays formic acid |
| Space | Jump — or, once you have your wings, a dash |
| 1 / 2 | Acid, or mandibles — far more damage, but you must close in |
| R | Hold to charge an acid burst, release for a wide cloud |
| E | Drink from a honeypot ant, or pick up and set down brood |
| C | Call nestmates, once you have the gland |
| Q | Hold to follow the scent trail when you are lost |
| Tab | Hold for the tactical view, click to send your nestmates |
| Esc | Pause · M mutes · R restarts from a death screen |

## The story

The title screen offers **Watch the story** or **Skip straight in**. The story
runs about a minute over the live burrow and you can leave it at any point with
the Skip button or Escape — it is never forced on you. It covers where she came
from, what she can do, and who is waiting on each floor.

There is also a trailer, `formica-journey.mp4`, cut from footage of the actual
game.

## Champions

Every floor has one, and it stands on the shaft. Filling your crop is not
enough — the way down stays shut until the champion is down. Each one hands
over the power you need for the floor below, so the fight teaches the next
mechanic rather than just gating it.

| Floor | Champion | How it fights | What it gives you |
| ----- | -------- | ------------- | ----------------- |
| 1 | The Gatekeeper | Charges in a straight line | **Wing dash** |
| 2 | The Tidecaller | Slams the floor, calls her guard | **Acid burst** |
| 3 | The Stonebreaker | Heavily armoured; charges and slams | **Rally** |
| 4 | The Fungus Warden | Spore clouds, summons, charges | **Chitin plating** |
| 5 | The Black Queen | All four, faster, and with more health | — |

Every move is telegraphed before it lands, so a death is always readable. Below
roughly a third health they enrage: the pauses between moves shorten and they
move faster.

Armour matters. The Stonebreaker takes 35% less from a direct hit, but acid gas
ignores a good slice of that — which is the fight teaching you why the burst is
worth charging.

## What she can do

**Formic acid.** A bolt of green vapour rather than a hitscan beam. It travels,
it is visible, and where it lands it leaves a small cloud that keeps burning.
Head hits do double.

**Acid burst.** Hold R to charge, release for a slow fat bolt that leaves a
wide, long-lived cloud. The tool for armoured targets and for a summoned pack.

**Wings.** Folded flat down her back until she dashes, then they snap open and
blur. The dash crosses a chamber in a third of a second and costs stamina. With
the wings out she also falls slowly enough to pick a landing.

**Mandibles.** 58 damage against acid's 30, and free, but you have to be in
biting range of something that bites back.

**Nestmates.** Call them with C. They fight beside you, they haul stone, and
with Rally you get twice as many for half the wait.

**Tactical view.** Hold Tab: the camera climbs to a command view, the action
drops to a third speed, and a click plants a rally point your nestmates march to
and hold. It is how you use a crew deliberately — flanking a champion, or
holding a tunnel mouth while you deal with what is behind you.

## It is a burrow, not a maze

There are no wall blocks anywhere. The colony is generated as two smooth
surfaces over the same ground: the floor you stand on, and how much air there
is above it. Solid earth is simply where that gap closes. So a wall is the
place where the ceiling curves down to meet the floor, and everything is
rounded, uneven and dug-looking.

That gives the things a real nest has:

- **Chambers of wildly different size**, from 19 to 36 units across and 7 to
  17 high, joined by tunnels 5 to 11 wide. Some are cathedrals; some you have
  to squeeze through, and the HUD says so when you do.
- **Hills rising out of the floor** inside the chambers. They are cover, they
  are high ground in a fight, and when the water comes they are islands.
- **Landmarks instead of a map.** Each chamber is dressed differently — brood
  rooms, the granary, the larder where the honeypot ants hang, fungus gardens,
  refuse heaps — and its name flashes up as you walk in. That is how you
  navigate, because the way down is not marked until you find it.

The shaft down sits in the chamber furthest from where you enter, two to six
tunnels away, and the minimap only fills in where you have actually been. When
you are properly lost, hold **Q** and a trail of scent motes drifts off toward
whatever you need next. It runs on a meter, so it is a hint, not a compass.

## What the reference films are in here

**Honeypot ants.** Repletes hang in the larder chambers with their gasters
swollen into translucent amber beads. Walk up and press **E** to drink —
trophallaxis — and the bead visibly empties. Two drinks each, and it is by far
the best healing in the game.

**Brood carrying.** Larvae lie in rows in the brood chambers. Pick one up with
**E** and carry it to the shaft for three crop. While it is in your mandibles
you cannot spray acid, so it is a real decision, not free money.

**Cooperative transport.** On the blocked floor, cave-ins have sealed the only
tunnel into the exit chamber. One ant cannot shift stone. Find the recruitment
gland first, then press **C** to call nestmates: they arrive, greet you with an
antennal tap, and a crew of three or more hauls the plug apart while you hold
the tunnel. They fight alongside you until they wander off.

**Rafting.** Fallen leaves lie around the cistern floors. When the monsoon
water comes up they come loose and float, and you can ride one — it drifts on
the current and carries you with it. The alternative is climbing a hill, or
swimming and drowning.

**Scale.** Straight from the Empire of the Ants developer talk: the point of
playing something a few millimetres long is that ordinary objects become
enormous. Grit is boulders, a leaf is a boat, roots hang through the chambers
like columns.

**Pheromones as powers**, also from that talk, is the scent trail and the
recruitment call.

## The floors

| # | Floor | What is down there |
| - | ----- | ------------------ |
| 1 | Entrance galleries | Black scouts. Room to learn the acid |
| 2 | Cistern galleries | The flood, and the leaves you ride out on |
| 3 | The blocked deep | Stone plugs. Find the gland, then call for help |
| 4 | Fungus deeps | Majors between the combs, and the roof coming down |
| 5 | The queen's vault | Water, cave-ins, majors, and a clock |

## Music

There are still no audio files. `audio.js` synthesises everything at runtime,
and the palette is deliberately not generic: the melodies sit in Japanese
pentatonics (hirajoshi, insen, iwato, yo), the drums are taiko with flams, the
lead is a plucked koto, and there is a brass section that only appears when a
champion is on its feet. It all runs through a generated convolution reverb so
it sounds like it is happening underground.

The arrangement is adaptive on two axes. Ordinary threat brings in the drums
and pushes the tempo; a waking champion brings in the brass and thickens
everything, and shifts again when it enrages. Each floor plays in a different
key and mode.

The trailer has its own score, synthesised separately in `score.py` with numpy —
taiko, brass, strings, choir, koto and shakuhachi, arranged in six sections
that build from a lone flute to a full climax.

## Files

```
index.html        page, HUD markup, importmap
styles.css        HUD and screens
config.js         every tunable number
terrain.js        the burrow generator: chambers, tunnels, hills, pathing
world.js          soil meshes, chamber dressing, lighting, level management
models.js         the ant and everything else, generated in code
entities.js       player, enemies, nestmates, repletes, brood, plugs, rafts
hazards.js        flood and cave-in
audio.js          the synthesised adaptive score
game.js           renderer, camera, input, combat, level flow, story, HUD
three.module.js   three.js r160 (MIT, licence in LICENSE-three.txt)
```

## Tuning

Nearly everything lives in `config.js`.

- **Chambers too small or too tight:** `roomMin`, `roomMax`, `height`,
  `tunnelMin`, `tunnelMax` per level.
- **More hills:** `hills`. More ways round: `loops`.
- **Combat too hard:** raise `WEAPONS.acid.damage` or `PLAYER.maxHealth`.
- **The flood:** its timing is in `hazards.js`, its depth follows the tallest
  hill on the floor so there is always somewhere to climb.
- **Hauling crews:** `RECRUIT.hauling` is how many ants a plug needs,
  `haulTime` how long it takes.
- **New enemy:** add to `ENEMY_TYPES`, list it in a level's `enemies`.
- **New champion:** add to `BOSSES` with an `abilities` list drawn from
  `charge`, `slam`, `summon` and `spray`, then name it in a level's `boss`.
  `cadence` is the gap between moves, `armour` the damage it shrugs off, and
  `grants` the power it hands over.
- **Boss too hard or too soft:** `hp` and `cadence` are the two dials. The
  duel harness in the notes measures time-to-kill for all five.
- **Acid feel:** `ACID.boltSpeed` for how snappy it is, `cloudDps` and
  `cloudLife` for the lingering burn, `burstRadius` for the charged shot.
- **Wings:** `WING.dashSpeed`, `dashTime` and `dashCooldown`.
- **New floor:** append to `LEVELS`. Burrow, shaft, lighting, dressing and
  spawns all generate from it.

The colony comes from the seed in `game.js` (`new World(this.scene, 20260927)`),
so everyone gets the same five floors. Pass `Date.now()` for a fresh burrow
every run.
