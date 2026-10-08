# Formica — the deep burrow

**Build v3.5** — a new score, a calmer camera, and the ant stays out of the
walls. The title screen and the pause card show the build string, so you can
tell at a glance which version is live.

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

### v3.1

- **Leaves are tracked.** They show on the map at all times, never fogged out,
  with a pulsing halo once they are afloat. The flooded floors went from 7 and
  3 leaves to 12 and 10.
- **The objective bar takes over during a flood.** While the water is up and
  you are not aboard, it turns blue, says *Get on a leaf*, and points at the
  nearest one with its distance. Nothing else is shown until you are safe.
- **Afloat leaves glow.** A leaf lights from inside once it comes loose, so it
  reads across a dark flooded chamber rather than vanishing into the water.

### v3.2 — the flood is survivable

The second floor was killing people, and measuring it showed why: on the
cistern floor **only 1.0% of the walkable ground stayed dry** when the water
peaked. 95.2% of it drowned you. There was one summit above the line and
nothing else, so unless you happened to be standing on it you died.

Three changes, each measured rather than guessed at:

- **High ground you can actually reach.** The flooded floors now get more
  hills, wider and taller, and **flat tops** instead of cones — a plateau you
  can stand and fight on rather than a point you slide off. Cistern: 1.0% dry
  to **31.7% dry**, and 8 hills now hold a dry peak instead of 1.
- **The water stops lower.** Its depth used to be set off the single tallest
  hill, which one freak summit could drag up over everything else. It is now
  derived from the spread of the floor itself — the level that leaves roughly a
  fifth of the ground dry — so the flood scales with the floor it is flooding.
- **A raft in every chamber.** Leaves were scattered at random, so some floors
  left whole chambers without one, and leaves that landed on hilltops never
  floated at all. Each chamber now gets one before any chamber gets two, and
  within the chamber they settle on the low ground where the water will lift
  them. Wherever you are when it starts rising, there is a leaf in the room.

Tested: 6 out of 6 runs now survive the cistern by running for high ground,
with the worst run ending on 174 of 190 health, and the raft carries you
through the whole flood without a frame of swimming.

### v3.3 — iOS and Android

The same URL, no app, no install. Open it in Safari or Chrome on a phone and
it switches to touch controls on its own.

A phone has no pointer lock and no keyboard, so this is not the desktop
scheme with buttons bolted on:

- **Left thumb steers.** Press anywhere in the left half and a stick appears
  under your thumb, wherever it landed — there is no small target to find
  while something is chasing you. It is analog: push it gently and she creeps,
  push it to the rim and she sprints. That is one less button than a sprint
  toggle, and it is what a thumb wants to do anyway.
- **Right thumb aims.** Drag to turn, exactly as the mouse does. Two fingers
  pinch the camera in and out.
- **The buttons sit under where the thumb already rests.** Acid and Fly in the
  corner, with Bite beside them; Burst, Use, Call, Trail and Crew in a block
  just above. The ones you have not earned yet are greyed out.
- **The ammo count rides on the fire button**, because the desktop gun box
  would be under your hand.
- **The map became a button.** A 150px tile in the corner of a phone is
  unreadable and in the way; tap Map and it fills the screen, tap anywhere to
  put it away.
- **The HUD moved out of both bottom corners.** Health, sprint, scent and
  alarm are up under the floor name where no hand covers them.
- **The briefing teaches thumbs, not keys.** Page two swaps itself out, and so
  do the prompts on the power cards and the hints.

Also in this build:

- **Adaptive resolution.** Phone GPUs vary enormously, so rather than guess at
  one setting it measures the frame time every second and moves the buffer
  scale between 0.52 and 1.0 to hold the frame rate. Dropping pixels costs
  sharpness; dropping frames costs the game. Multisampling is off on a phone,
  and the pixel ratio is capped at 1.6 rather than 2.
- **The ammo counter was broken on desktop too.** It tested the weapon's
  `kind` against `'hitscan'`, which no weapon has ever been, so formic acid
  always displayed as infinite even though it runs dry at 70 and trickles
  back. It now shows the real number on every platform.
- **Android gets real fullscreen** and a landscape lock when it starts. An
  iPhone refuses the fullscreen API outright, so there the route is **Share →
  Add to Home Screen** and opening it from the icon, which the briefing says.
- **Play it sideways.** Portrait works, and a dismissible hint suggests
  turning the phone.

Tested on four emulated handsets — iPhone 15 and SE landscape, Pixel 8
landscape, iPhone 15 portrait — driving real touch events through the browser:
checks on each one including that no HUD panel or button lands under a thumb,
that no two buttons overlap, that every button clears 44px, that nothing falls
off the edge of a notched screen, and that steering and firing work at the same
time.

### v3.5 — the score, the camera, and the walls

**The camera was whipping, and now it is governed.** Stepping sideways turns
her ninety degrees in a single frame, and the old camera chased that
proportionally — about 500 degrees a second, which is the whole world spinning.
Three things fix it: a hard ceiling of 80 degrees a second on how fast the view
may rotate whatever she does, a dead zone so the wobble of walking round a rock
is ignored entirely, and smoothing on her heading before the camera ever sees
it. Measured on a 90-degree change of direction: peak 20 degrees a second.

**You can look around again, without losing the follow.** Drag the right of the
screen and the camera swings off her back — but it is an *offset*, not a free
camera, so a second after you let go it eases home behind her. The new **↻**
button snaps it back at once. So the camera is still "always behind her", and
you can still look where you like.

Doing both at once needed care. A camera that chases your heading, with a stick
measured against that same camera, spirals. The stick therefore captures the
camera direction when your thumb settles on a heading and freezes it,
re-capturing only when your thumb really points somewhere else.

**The ant no longer walks through walls, and this one was measurable.** Her
drawn body reaches 2.28 units to her nose and 2.81 across with her wings out,
but collision was a circle of radius 1 around her middle — so she stopped with
her centre legally clear and her head nearly two units inside the soil. On
14.5% of frames some part of her was in the rock. Widening the circle enough to
cover her would have stopped her fitting down a tunnel, so the guard is
directional: it probes ahead along the way she is actually travelling and
removes only the part of her motion heading into soil, leaving the part along
the wall so she slides. With a slightly wider circle as well, **14.5% to 1.3%**,
and she still squeezes through the tight places.

**A clearer, more solid picture.**

- **Antialiasing is on for phones now.** Mobile GPUs are tile-based and resolve
  it inside the tile, so it is far cheaper there than desktop intuition
  suggests, and jagged edges on a small dense screen are the most obvious thing
  wrong with a picture.
- **A key light.** Ambient plus a lantern at the camera lights everything
  evenly, which is exactly why the burrow read flat — nothing cast a consistent
  light side and dark side, so a curved surface and a flat one looked the same.
- **The soil is no longer perfectly matte**, so it catches a faint sheen that
  moves as you do, which is what the eye reads as a solid surface.
- **The depth range is sane.** 0.1 to 500 is a ratio of 5000, which a desktop
  absorbs and a phone often does not — surfaces win and lose the depth test at
  random, which is a wall flickering and things showing through it. Now 0.45 to
  200, and the fog is total by 150 anyway.
- **The chase camera can come closer** (1.8 rather than 2.6) and samples finely
  enough not to step over a thin pinch between chambers.

**A grand opening, and two scores to choose from.**

The game now opens on a title card with **Tap to begin**. That tap is not
decoration: no browser will start audio without a gesture, and the title cue is
meant to be the first thing you hear rather than something that sneaks in once
you are already playing.

The cue runs about forty seconds and is written in five sections — a lone horn
over a drone, a staccato string ostinato starting underneath, the theme
arriving on horns, everything at once, then one impact and a long tail. It is
synthesised from oscillators at runtime like everything else here: nothing is
sampled, and no existing piece is quoted.

**Music: Cinematic / Burrow / Off** on the title screen and in the pause card.
*Cinematic* is the new orchestral score — a string ostinato under horns and
choir, thickening as a floor turns dangerous. *Burrow* is the original koto and
taiko. Your choice is remembered.

### v3.4 — the camera follows her, and the pixels are fixed

**The blocky render is gone, and it was measurable.** The adaptive scaler was
allowed to fall to 0.52, which meant the drawing buffer was *smaller than the
element it sits in* — on a phone at device-pixel-ratio 3 the browser was
stretching a 708-pixel-wide image across a 2556-pixel screen. Measured on an
emulated iPhone: 0.83 buffer pixels per CSS pixel. The floor is now 1.0, so it
never renders below native and the browser never upscales. A phone that cannot
hold native resolution gets a lower frame rate instead; it never gets a broken
picture. The buffer is also sized from the element the canvas actually
occupies rather than from `innerWidth`/`innerHeight`, which disagree on mobile
Safari while the address bar is sliding — another way the same stretch happened.

**No more looking around on a phone.** The camera simply stays at her back and
swings to whichever way she walks, so forward is always forward and you can
see where you are going. She fires wherever she is facing, and the camera sits
dead centre rather than over her shoulder, so what is under the crosshair is
what is in front of her.

The part worth knowing about: a camera that chases your heading, combined with
a stick measured against that same camera, makes you **spiral** — push right,
the camera swings right, so "right" now means somewhere else, and you circle.
The fix is that the stick captures the camera direction when your thumb settles
on a heading and freezes it, re-capturing only when your thumb genuinely points
somewhere else. Measured: holding one direction for three seconds drifts the
heading by **0 degrees**, and changing direction swings the camera 89 degrees
and settles 1 degree off her back.

**A full-screen button**, top-right, and on the title screen. Android gets real
fullscreen plus a landscape lock. Safari on iPhone has no Fullscreen API at all
— it is not exposed on anything but a video element — so there the button
explains the one thing that does work: **Share → Add to Home Screen**, then
open Formica from the icon. It then runs with no address bar and no toolbar.
The button hides itself when you are already running that way.

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

### On a phone

| Thumb | Action |
| ----- | ------ |
| Left half | Press anywhere for a stick. Gently to creep, to the rim to sprint |
| Right half | Drag to look around — it eases back behind her when you let go |
| The camera | Otherwise rides at her back by itself. She fires where she faces |
| ↻ | Snap the camera straight back behind her |
| Acid / Bite | Hold to spray. Bite switches jaws |
| Fly | Wing dash |
| Burst · Use · Call · Trail | Hold Burst and Trail; tap Use and Call |
| Crew | Hold for the command view, then tap the ground to send them |
| ⛶ · Map · ❚❚ | Full screen · full-screen map · pause |

Hold the phone sideways. On Android the ⛶ button gives you real fullscreen. On
an iPhone it cannot — Safari has no Fullscreen API for a web page — so use
**Share → Add to Home Screen** and open it from the icon instead, which runs
with no address bar at all. The button tells you this when you tap it.

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
touch.js          the phone controls: thumbsticks, buttons, rotation
game.js           renderer, camera, input, combat, level flow, story, HUD
three.module.js   three.js r160 (MIT, licence in LICENSE-three.txt)
```

## Tuning

Nearly everything lives in `config.js`.

- **Chambers too small or too tight:** `roomMin`, `roomMax`, `height`,
  `tunnelMin`, `tunnelMax` per level.
- **More hills:** `hills`. More ways round: `loops`.
- **Combat too hard:** raise `WEAPONS.acid.damage` or `PLAYER.maxHealth`.
- **The flood:** its timing is in `hazards.js`. Its depth comes from
  `#waterLineLeaving()` in the same file, which samples the floor and picks the
  level that leaves `DRY_SHARE` of it above water — raise that constant to be
  kinder. The islands themselves are `hills`, `hillRadius`, `hillHeight` and
  `flatTops` per level in `config.js`, and `leaves` is how many rafts.
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
- **Touch feel:** `STICK_R` in `touch.js` is how far the thumb travels for
  full push, `SPRINT_AT` the fraction of that which counts as running, and
  `REAIM` how far the thumb must swing before the movement frame re-captures.
- **Phone camera:** everything is in `CAM` in `config.js`. `maxTurn` is the
  ceiling on how fast the view may rotate and is the one to lower if it still
  feels quick; `deadZone` is how much heading change it ignores; `recentre` and
  `lookHold` are how soon a hand-made look eases home.
- **Her body in the walls:** `PLAYER.noseReach` is how far ahead of her centre
  the guard looks, `PLAYER.radius` the collision circle. Raising the radius
  past about 1.6 starts to stop her fitting down a tunnel.
- **Music:** `playIntro()` in `audio.js` is the title cue, written out in bars;
  `#epicStep()` is the cinematic in-game score and `#playStep()` the original.
- **Phone performance:** `pixMin`, `pixMax` and `pixRatio` in the `Game`
  constructor; `#adapt()` moves `pixRatio` between the two. **Never let
  `pixMin` go below 1** — that is rendering smaller than the screen and it
  looks broken, not soft.

The colony comes from the seed in `game.js` (`new World(this.scene, 20260927)`),
so everyone gets the same five floors. Pass `Date.now()` for a fresh burrow
every run.
