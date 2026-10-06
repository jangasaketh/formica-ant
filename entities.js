// ---------------------------------------------------------------------------
// entities.js — the fire ant you drive, the colony that wants her dead, and
// the pieces of real ant life the reference films are full of: honeypot
// repletes you drink from, brood you carry out, nestmates you call for help.
// ---------------------------------------------------------------------------

import * as THREE from 'three';
import {
  PLAYER, WEAPONS, ENEMY_TYPES, PICKUP_TYPES, RECRUIT, BOSSES, WING, ACID,
  MIN_HEADROOM, CRAWL_HEADROOM,
} from './config.js';
import {
  makeAnt, makeBoss, makeReplete, makeLarva, makeStonePlug, makePickup, makeGland,
  makeAcidBolt, makeAcidCloud,
} from './models.js';

const UP = new THREE.Vector3(0, 1, 0);

// --------------------------------------------------------------- shared ----
function animateAnt(mesh, t, gait, opts = {}) {
  const d = mesh.userData;
  if (!d?.legs) return;
  // Real ants run an alternating tripod: three legs down, three swinging.
  const swing = 0.16 + gait * 0.62;
  const rate = 7 + gait * 17;
  for (const leg of d.legs) {
    const ph = t * rate + leg.userData.phase;
    leg.rotation.x = Math.sin(ph) * swing;
    leg.rotation.z = Math.cos(ph) * swing * 0.3;
    leg.position.y = (leg.userData.baseY ?? 0.5) + Math.max(0, Math.sin(ph)) * 0.06 * gait;
  }
  if (d.antennae) {
    // antennae sweep constantly — it is how an ant reads the world
    d.antennae.forEach((a, i) => {
      a.rotation.x = Math.sin(t * 3.6 + i * 2.1) * 0.34;
      a.rotation.z = Math.cos(t * 2.9 + i * 1.3) * 0.26;
      if (a.userData.flag) a.userData.flag.rotation.x = -0.95 + Math.sin(t * 5 + i) * 0.22;
    });
  }
  if (d.mandibles) {
    const open = opts.bite ?? (0.5 + Math.sin(t * 2.2) * 0.5) * 0.12;
    d.mandibles.forEach((j, i) => { j.rotation.y = (i ? -1 : 1) * open; });
  }
  if (d.gaster) {
    d.gaster.position.y = 0.56 + Math.sin(t * rate * 0.5) * 0.025;
    d.gaster.rotation.x = (opts.gasterTuck ?? 0);
  }
}

function emissives(mesh) {
  const out = [];
  mesh.traverse((m) => { if (m.isMesh && m.material?.emissive) out.push(m.material); });
  return out;
}

/** Follow the terrain, sliding around soil walls rather than sticking. */
function moveOnTerrain(pos, vel, dt, terrain, radius, need) {
  pos.x += vel.x * dt;
  pos.z += vel.z * dt;
  terrain.resolve(pos, radius, need);
}

// --------------------------------------------------------------- Player ----
export class Player {
  constructor(scene) {
    this.mesh = makeAnt({
      body: 0xb8461c, head: 0xc95322, gaster: 0x2e1609, legs: 0x83381a,
      scale: 1.35, detail: true, hairs: true, wings: true,
    });
    scene.add(this.mesh);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.grounded = true;
    this.level = 0;

    this.health = PLAYER.maxHealth;
    this.stamina = PLAYER.maxStamina;
    this.scent = PLAYER.maxScent;
    this.food = 0;

    this.weapon = 'acid';
    this.ammo = { acid: WEAPONS.acid.ammoStart, bite: 0 };
    this.cooldown = { acid: 0, bite: 0 };

    this.invuln = 0;
    this.hurtFlash = 0;
    this.sprinting = false;
    this.crawling = false;
    this.inWater = false;
    this.swimming = false;
    this.inShaft = false;      // committed to the drop
    this.raft = null;          // leaf we are riding
    this.carrying = null;      // larva in the mandibles
    this.hasGland = false;
    this.callCd = 0;
    this.biteAnim = 0;

    // Wings and sprint are hers from the start — the champions hand over the
    // rest. Locking the dash behind the first boss made it look like she
    // could not fly at all.
    this.powers = { dash: true, glide: false, burst: false, rally: false, chitin: false };
    this.dashTime = 0;
    this.dashCd = 0;
    this.dashDir = new THREE.Vector3();
    this.wingOpen = 0;
    this.wingPhase = 0;
    this.burstCharge = 0;
    this.burstCd = 0;
    this.mats = emissives(this.mesh);
  }

  get gun() { return WEAPONS[this.weapon]; }

  /** Snap the wings out and fling her forward. */
  tryDash(camYaw, input) {
    if (!this.powers.dash || this.dashCd > 0 || this.dashTime > 0) return false;
    if (this.stamina < WING.dashCost) return false;
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const d = new THREE.Vector3();
    if (input.forward) d.add(fwd);
    if (input.back) d.sub(fwd);
    if (input.right) d.add(right);
    if (input.left) d.sub(right);
    if (d.lengthSq() < 0.001) d.copy(fwd);
    d.normalize();
    this.dashDir.copy(d);
    this.dashTime = WING.dashTime;
    this.dashCd = WING.dashCooldown;
    this.stamina = Math.max(0, this.stamina - WING.dashCost);
    this.facing = Math.atan2(d.x, d.z);
    return true;
  }

  spawnAt(x, y, z, level) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.level = level;
    this.grounded = true;
    this.raft = null;
    this.inShaft = false;
    this.mesh.position.copy(this.pos);
  }

  update(dt, input, world, camYaw, t, ctx) {
    const lv = world.levels[this.level];
    const terrain = lv.terrain;
    const baseY = world.levelY(this.level);

    // ---- what is under us: soil, a leaf on the flood, or nothing at all? --
    // Over an open shaft there is no floor, so the ground snap has to be
    // skipped entirely or you stand on thin air above the hole.
    const overShaft = world.isOverShaft(this.level, this.pos.x, this.pos.z);
    const groundSoil = baseY + terrain.floorAt(this.pos.x, this.pos.z);

    // Once you are over the mouth and below the lip you are committed: drifting
    // sideways on the way down must not put the floor back under your feet.
    if (overShaft && this.pos.y < groundSoil - 0.6) this.inShaft = true;
    const dropping = this.inShaft || overShaft;
    let ground = dropping ? -Infinity : groundSoil;
    this.raft = null;
    if (ctx?.rafts) {
      for (const r of ctx.rafts) {
        if (r.level !== this.level || !r.afloat) continue;
        const d = Math.hypot(this.pos.x - r.pos.x, this.pos.z - r.pos.z);
        if (d < r.radius + 0.8 && this.pos.y >= r.topY - 1.8) {
          if (r.topY > ground) { ground = r.topY; this.raft = r; }
        }
      }
    }

    const head = terrain.headAt(this.pos.x, this.pos.z);
    this.crawling = head < CRAWL_HEADROOM;

    // ---- intent, relative to the camera ----------------------------------
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const wish = new THREE.Vector3();
    if (input.forward) wish.add(fwd);
    if (input.back) wish.sub(fwd);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);
    const moving = wish.lengthSq() > 0.001;
    if (moving) wish.normalize();

    this.sprinting = input.sprint && moving && this.stamina > 1 && !this.swimming && !this.crawling;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
    else this.stamina = Math.min(PLAYER.maxStamina, this.stamina + PLAYER.staminaRegen * dt);

    let top = this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (this.crawling) top *= PLAYER.crawlFactor;
    if (this.swimming) top = PLAYER.swimSpeed;
    if (this.carrying) top *= 0.82;             // brood is heavy

    // a dash overrides ordinary walking for its third of a second
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.vel.x = this.dashDir.x * WING.dashSpeed;
      this.vel.z = this.dashDir.z * WING.dashSpeed;
      this.vel.y = Math.max(this.vel.y, -2);
    } else if (moving) {
      this.vel.x += wish.x * PLAYER.accel * dt;
      this.vel.z += wish.z * PLAYER.accel * dt;
      const s = Math.hypot(this.vel.x, this.vel.z);
      if (s > top) { this.vel.x *= top / s; this.vel.z *= top / s; }
      this.facing = Math.atan2(wish.x, wish.z);
    } else {
      const f = Math.max(0, 1 - PLAYER.friction * dt);
      this.vel.x *= f; this.vel.z *= f;
    }
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.burstCd > 0) this.burstCd -= dt;

    if (input.jump && this.grounded && !this.crawling) {
      this.vel.y = PLAYER.jumpSpeed;
      this.grounded = false;
      input.jump = false;
    }

    this.vel.y -= PLAYER.gravity * dt;
    if (this.swimming) this.vel.y = Math.max(this.vel.y, -3.2);
    // wings out slows the fall; the Gatekeeper's gift makes it a real glide
    if (this.wingOpen > 0.5 && !this.grounded) {
      const floor = this.powers.glide ? -WING.glideFall * 0.55 : -WING.glideFall;
      this.vel.y = Math.max(this.vel.y, floor);
    }

    // ---- integrate --------------------------------------------------------
    const need = MIN_HEADROOM * 0.72;
    moveOnTerrain(this.pos, this.vel, dt, terrain, PLAYER.radius, need);
    this.pos.y += this.vel.y * dt;

    // very little steering once you are in the shaft — it is a fall, not a flight
    if (this.inShaft) { this.vel.x *= 0.955; this.vel.z *= 0.955; }

    // a leaf we are standing on carries us with it
    if (this.raft) {
      this.pos.x += this.raft.drift.x * dt;
      this.pos.z += this.raft.drift.z * dt;
    }

    if (this.pos.y <= ground) {
      this.pos.y = ground;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // do not let the ceiling swallow us — but never while dropping down a shaft
    if (!dropping) {
      const ceil = baseY + terrain.ceilAt(this.pos.x, this.pos.z) - 0.6;
      if (this.pos.y > ceil) { this.pos.y = ceil; this.vel.y = Math.min(this.vel.y, 0); }
    }

    // ---- scent sense ------------------------------------------------------
    if (input.scent && this.scent > 0) {
      this.scent = Math.max(0, this.scent - PLAYER.scentDrain * dt);
    } else {
      this.scent = Math.min(PLAYER.maxScent, this.scent + PLAYER.scentRegen * dt);
    }

    // ---- present ----------------------------------------------------------
    this.mesh.position.copy(this.pos);
    const turn = this.facing - this.mesh.rotation.y;
    this.mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 17);
    // tilt to follow the slope of the hill underfoot
    const e = 1.4;
    const sx = terrain.floorAt(this.pos.x + e, this.pos.z) - terrain.floorAt(this.pos.x - e, this.pos.z);
    const sz = terrain.floorAt(this.pos.x, this.pos.z + e) - terrain.floorAt(this.pos.x, this.pos.z - e);
    const tgtPitch = this.grounded ? Math.atan2(-sz, 2 * e) : 0;
    const tgtRoll = this.grounded ? Math.atan2(sx, 2 * e) : 0;
    this.mesh.rotation.x += (tgtPitch - this.mesh.rotation.x) * Math.min(1, dt * 7);
    this.mesh.rotation.z += (tgtRoll - this.mesh.rotation.z) * Math.min(1, dt * 7);

    // ---- wings ------------------------------------------------------------
    const wantOpen = (this.dashTime > 0 || (!this.grounded && this.vel.y < -1)) ? 1 : 0;
    this.wingOpen += (wantOpen - this.wingOpen) * Math.min(1, dt * (wantOpen ? 18 : 7));
    this.wingPhase += dt * (34 + this.wingOpen * 46);
    const wings = this.mesh.userData.wings;
    if (wings) {
      for (const w of wings) {
        const o = this.wingOpen;
        const buzz = Math.sin(this.wingPhase) * 0.55 * o;
        // folded flat along the back, or swept out and beating
        w.fore.rotation.y = w.side * (0.06 + o * 1.16);
        w.fore.rotation.z = w.side * (-0.02 + buzz);
        w.fore.rotation.x = -o * 0.18;
        w.fore.scale.setScalar(0.72 + o * 0.28);
        w.hind.rotation.y = w.side * (0.04 + o * 0.94);
        w.hind.rotation.z = w.side * (-0.02 - buzz * 0.8);
        w.hind.scale.setScalar(0.7 + o * 0.3);
        for (const child of [w.fore.children[0], w.hind.children[0]]) {
          if (child?.material) child.material.opacity = 0.2 + o * 0.34;
        }
      }
    }

    const gait = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / PLAYER.sprintSpeed);
    if (this.biteAnim > 0) this.biteAnim -= dt;
    animateAnt(this.mesh, t, this.grounded ? gait : 0.12, {
      bite: this.biteAnim > 0 ? 0.65 : undefined,
      gasterTuck: this.weapon === 'acid' && this.cooldown.acid > 0.05 ? -0.5 : 0,
    });

    // the carried larva rides under the head
    if (this.carrying) {
      this.carrying.mesh.position.set(
        this.pos.x + Math.sin(this.facing) * 1.7,
        this.pos.y + 0.7,
        this.pos.z + Math.cos(this.facing) * 1.7
      );
      this.carrying.mesh.rotation.y = this.facing;
    }

    for (const k of Object.keys(this.cooldown)) if (this.cooldown[k] > 0) this.cooldown[k] -= dt;
    if (this.callCd > 0) this.callCd -= dt;
    const w = WEAPONS.acid;
    if (this.ammo.acid < w.ammoMax) this.ammo.acid = Math.min(w.ammoMax, this.ammo.acid + w.regen * dt);

    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) {
      this.hurtFlash -= dt;
      for (const m of this.mats) m.emissiveIntensity = Math.max(0, this.hurtFlash) * 3;
    }
  }

  damage(amount) {
    if (this.invuln > 0) return false;
    if (this.powers.chitin) amount *= 0.66;     // hardened shell
    this.health = Math.max(0, this.health - amount);
    this.invuln = PLAYER.invulnTime;
    this.hurtFlash = 0.3;
    for (const m of this.mats) m.emissive.setHex(0xff2200);
    return true;
  }

  drown(a) {
    this.health = Math.max(0, this.health - a);
    this.hurtFlash = 0.2;
    for (const m of this.mats) m.emissive.setHex(0x2a7fa0);
  }

  heal(v) { this.health = Math.min(PLAYER.maxHealth, this.health + v); }
  giveAcid(v) { this.ammo.acid = Math.min(WEAPONS.acid.ammoMax, this.ammo.acid + v); }
}

// ---------------------------------------------------------------- Enemy ----
export class Enemy {
  constructor(typeKey, scene, world, level, spot) {
    const cfg = ENEMY_TYPES[typeKey];
    this.type = typeKey;
    this.cfg = cfg;
    this.mesh = makeAnt({
      body: cfg.body, head: cfg.head, gaster: cfg.gaster, legs: cfg.legs,
      scale: cfg.scale, detail: cfg.scale > 1.4,
    });
    scene.add(this.mesh);
    this.mats = emissives(this.mesh);

    const terrain = world.terrainOf(level);
    this.pos = new THREE.Vector3(spot.x, world.levelY(level) + terrain.floorAt(spot.x, spot.z), spot.z);
    this.vel = new THREE.Vector3();
    this.level = level;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;

    // guards hold a chamber; scouts wander the whole nest
    this.home = cfg.guard ? terrain.roomAt(spot.x, spot.z) : null;
    this.state = 'patrol';
    this.aware = false;
    this.engaged = false;
    this.goal = terrain.randomPoint();
    this.waypoint = null;
    this.repath = 0;
    this.memory = 0;
    this.attackTimer = 0;
    this.rooted = 0;
    this.flash = 0;
    this.dead = false;
    this.biteAnim = 0;
    this.mesh.position.copy(this.pos);
  }

  update(dt, ctx, t) {
    if (this.dead) return;
    const { player, world, alarm } = ctx;
    const cfg = this.cfg;
    const terrain = world.terrainOf(this.level);
    const baseY = world.levelY(this.level);

    if (this.rooted > 0) this.rooted -= dt;
    if (this.flash > 0) {
      this.flash -= dt;
      for (const m of this.mats) { m.emissive.setHex(0xff3a10); m.emissiveIntensity = this.flash * 4; }
    } else {
      for (const m of this.mats) m.emissiveIntensity = 0;
    }

    const same = player.level === this.level;
    const to = new THREE.Vector3().subVectors(player.pos, this.pos);
    const dist = to.length();
    const sight = cfg.sight + alarm * ctx.alarmSightBonus;

    // ---- perception: eyes need a clear tunnel, ears do not ---------------
    let sees = false;
    if (same && dist < sight) {
      sees = terrain.clearLine(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
    }
    const hears = same && dist < cfg.hearing && (player.sprinting || ctx.playerNoisy);
    if (sees || hears) { this.memory = 4.5; ctx.sighted = true; }
    else if (this.memory > 0) this.memory -= dt;

    // Knowing where you are is not the same as being free to charge in.
    // Only the ants holding an attack slot commit; the rest shadow you.
    this.aware = this.memory > 0;
    this.state = (this.aware && this.engaged) ? 'hunt' : 'patrol';

    // ---- where am I going -------------------------------------------------
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.4 + Math.random() * 0.25;
      if (this.state === 'hunt') {
        this.goal = { x: player.pos.x, z: player.pos.z };
      } else if (this.aware) {
        // hold a loose ring around the player rather than closing in
        const a = (this.ringPhase ?? (this.ringPhase = Math.random() * 6.28));
        this.ringPhase += 0.6;
        this.goal = {
          x: player.pos.x + Math.cos(a) * 17,
          z: player.pos.z + Math.sin(a) * 17,
        };
      } else if (Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 4) {
        this.goal = this.home ? terrain.pointInRoom(this.home) : terrain.randomPoint();
      }
      const node = terrain.routeStep(this.pos.x, this.pos.z, this.goal.x, this.goal.z, ctx.blockedNodes);
      this.waypoint = node ? { x: node.x, z: node.z } : null;
    }

    const aim = this.waypoint ?? this.goal;
    const dx = aim.x - this.pos.x, dz = aim.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;

    const speed = this.rooted > 0 ? 0
      : cfg.speed * (this.state === 'hunt' ? 1 : 0.45) * (1 + alarm * (ctx.alarmSpeedBonus - 1));

    this.vel.x += (dx / len) * speed * dt * 12;
    this.vel.z += (dz / len) * speed * dt * 12;
    const s = Math.hypot(this.vel.x, this.vel.z);
    if (s > speed) { this.vel.x *= speed / s; this.vel.z *= speed / s; }

    moveOnTerrain(this.pos, this.vel, dt, terrain, cfg.bodyRadius * 0.6, MIN_HEADROOM * 0.7);
    this.pos.y = baseY + terrain.floorAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);

    if (s > 0.1) {
      const want = Math.atan2(dx / len, dz / len);
      const turn = want - this.mesh.rotation.y;
      this.mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 9);
    }
    if (this.biteAnim > 0) this.biteAnim -= dt;
    animateAnt(this.mesh, t, this.rooted > 0 ? 0.05 : (this.state === 'hunt' ? 1 : 0.35),
      { bite: this.biteAnim > 0 ? 0.7 : undefined });

    // ---- bite --------------------------------------------------------------
    this.attackTimer -= dt;
    if (same && this.rooted <= 0 && dist < cfg.contact &&
        Math.abs(player.pos.y - this.pos.y) < 3 && this.attackTimer <= 0) {
      if (player.damage(cfg.damage)) {
        this.attackTimer = cfg.attackCd;
        this.biteAnim = 0.3;
        const push = to.clone().setY(0).normalize().multiplyScalar(7);
        player.vel.x += push.x; player.vel.z += push.z;
        ctx.onHit?.(this);
      }
    }

    // recruits fight back
    if (ctx.recruits && this.rooted <= 0 && this.attackTimer <= 0) {
      for (const r of ctx.recruits) {
        if (r.dead || r.level !== this.level) continue;
        if (this.pos.distanceTo(r.pos) < cfg.contact) {
          r.hp -= cfg.damage;
          this.attackTimer = cfg.attackCd;
          this.biteAnim = 0.3;
          if (r.hp <= 0) r.dead = true;
          break;
        }
      }
    }
  }

  hurt(amount, root = 0) {
    this.hp -= amount;
    this.flash = 0.25;
    if (root) this.rooted = Math.max(this.rooted, root);
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }

  dispose(scene) { scene.remove(this.mesh); }
}

// -------------------------------------------------------------- Recruit ----
/**
 * A nestmate answering the call. Follows you, bites what you are fighting,
 * and joins a hauling crew at a stone plug. Greets you with an antennal
 * tap when it arrives, the way ants identify each other.
 */
export class Recruit {
  constructor(scene, world, level, spot, player) {
    this.mesh = makeAnt({
      body: 0xa8481e, head: 0xbb5524, gaster: 0x33190a, legs: 0x7d3a1a,
      scale: 1.15, detail: false,
    });
    scene.add(this.mesh);
    const terrain = world.terrainOf(level);
    this.pos = new THREE.Vector3(spot.x, world.levelY(level) + terrain.floorAt(spot.x, spot.z), spot.z);
    this.vel = new THREE.Vector3();
    this.level = level;
    this.player = player;
    this.hp = RECRUIT.hp;
    this.life = RECRUIT.life;
    this.dead = false;
    this.job = null;          // a StonePlug it is hauling
    this.greeted = false;
    this.greetTimer = 0;
    this.attackCd = 0;
    this.mesh.position.copy(this.pos);
  }

  update(dt, ctx, t) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    const { world, enemies } = ctx;
    const terrain = world.terrainOf(this.level);
    const baseY = world.levelY(this.level);
    const player = this.player;

    // pick the nearest job: a plug being worked, else an enemy, else the player
    let target = null, mode = 'follow';
    if (this.job && !this.job.cleared) {
      target = { x: this.job.pos.x, z: this.job.pos.z };
      mode = 'haul';
    } else {
      let bd = 26 * 26;
      for (const e of enemies) {
        if (e.dead || e.level !== this.level) continue;
        const d = (e.pos.x - this.pos.x) ** 2 + (e.pos.z - this.pos.z) ** 2;
        if (d < bd) { bd = d; target = e; mode = 'fight'; }
      }
      if (!target && ctx.rallyPoint) {
        // ordered to hold a spot in the tactical view
        target = { x: ctx.rallyPoint.x, z: ctx.rallyPoint.z };
        mode = 'rally';
      }
      if (!target) { target = { x: player.pos.x, z: player.pos.z }; mode = 'follow'; }
    }

    const tx = target.pos ? target.pos.x : target.x;
    const tz = target.pos ? target.pos.z : target.z;
    const dist = Math.hypot(tx - this.pos.x, tz - this.pos.z);

    const stop = mode === 'fight' ? 2.2 : (mode === 'haul' ? 3.4 : (mode === 'rally' ? 3.0 : 5.0));
    let aimX = tx, aimZ = tz;
    if (!terrain.clearLine(this.pos.x, this.pos.z, tx, tz)) {
      const n = terrain.routeStep(this.pos.x, this.pos.z, tx, tz, ctx.blockedNodes);
      if (n) { aimX = n.x; aimZ = n.z; }
    }

    if (dist > stop) {
      const dx = aimX - this.pos.x, dz = aimZ - this.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const sp = RECRUIT.speed * (dist > 16 ? 1.25 : 1);
      this.vel.x += (dx / len) * sp * dt * 14;
      this.vel.z += (dz / len) * sp * dt * 14;
      const s = Math.hypot(this.vel.x, this.vel.z);
      if (s > sp) { this.vel.x *= sp / s; this.vel.z *= sp / s; }
    } else {
      this.vel.x *= 0.82; this.vel.z *= 0.82;
    }

    moveOnTerrain(this.pos, this.vel, dt, terrain, 0.8, MIN_HEADROOM * 0.7);
    this.pos.y = baseY + terrain.floorAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);

    const s = Math.hypot(this.vel.x, this.vel.z);
    if (s > 0.1) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      const turn = want - this.mesh.rotation.y;
      this.mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 11);
    }

    // antennation: a quick face-to-face tap when it first reaches you
    if (!this.greeted && mode === 'follow' && dist < 6) {
      this.greeted = true;
      this.greetTimer = 0.9;
    }
    if (this.greetTimer > 0) this.greetTimer -= dt;

    animateAnt(this.mesh, t, Math.min(1, s / RECRUIT.speed),
      { bite: this.greetTimer > 0 ? 0.5 : undefined });

    // bite whatever it caught up with
    this.attackCd -= dt;
    if (mode === 'fight' && dist < 2.8 && this.attackCd <= 0) {
      this.attackCd = 0.75;
      if (target.hurt(RECRUIT.damage)) ctx.onRecruitKill?.(target);
    }
  }

  dispose(scene) { scene.remove(this.mesh); }
}

// -------------------------------------------------------------- Replete ----
/**
 * A honeypot ant hanging in a larder chamber. Walk up and drink: trophallaxis,
 * exactly as the workers in the film do. The bead visibly empties.
 */
export class Replete {
  constructor(scene, world, level, spot) {
    this.mesh = makeReplete(1.5);
    const terrain = world.terrainOf(level);
    const baseY = world.levelY(level);
    const ceil = terrain.ceilAt(spot.x, spot.z);
    const floor = terrain.floorAt(spot.x, spot.z);
    // hangs from the roof, low enough that a worker on the floor can reach it
    const hang = Math.min(ceil - 1.6, floor + 4.2);
    this.pos = new THREE.Vector3(spot.x, baseY + Math.max(floor + 2.4, hang), spot.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.z = Math.PI;         // hanging upside down
    this.mesh.rotation.y = Math.random() * 6.28;
    scene.add(this.mesh);

    this.level = level;
    this.charges = 2;
    this.drinking = 0;
    this.sway = Math.random() * 6.28;
  }

  get empty() { return this.charges <= 0; }

  update(dt, t) {
    this.sway += dt;
    this.mesh.position.y = this.pos.y + Math.sin(this.sway * 0.8) * 0.12;
    this.mesh.rotation.y += dt * 0.12;
    const f = this.charges / 2;
    const bead = this.mesh.userData.bead;
    const want = 0.35 + f * 0.65;
    bead.scale.setScalar(bead.scale.x + (want - bead.scale.x) * Math.min(1, dt * 3));
    this.mesh.userData.honeyMat.emissiveIntensity = 2.4 * (0.3 + f * 0.7);
  }

  dispose(scene) { scene.remove(this.mesh); }
}

// ---------------------------------------------------------------- Larva ----
export class Larva {
  constructor(scene, world, level, spot) {
    this.mesh = makeLarva();
    const terrain = world.terrainOf(level);
    this.pos = new THREE.Vector3(
      spot.x, world.levelY(level) + terrain.floorAt(spot.x, spot.z) + 0.1, spot.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = Math.random() * 6.28;
    this.mesh.scale.setScalar(1.5);
    scene.add(this.mesh);
    this.level = level;
    this.carried = false;
    this.delivered = false;
    this.wriggle = Math.random() * 6.28;
  }

  update(dt, t) {
    this.wriggle += dt;
    if (!this.carried) {
      this.mesh.rotation.z = Math.sin(this.wriggle * 1.4) * 0.09;
      this.mesh.position.y = this.pos.y + Math.abs(Math.sin(this.wriggle * 0.9)) * 0.06;
    } else {
      this.mesh.rotation.z = Math.sin(this.wriggle * 5) * 0.2;
    }
  }

  dispose(scene) { scene.remove(this.mesh); }
}

// ----------------------------------------------------------- Stone plug ----
/**
 * A cave-in sealing a tunnel. One ant cannot shift it; a hauling crew can.
 * Cooperative transport, which is how ants move anything heavy.
 */
export class StonePlug {
  constructor(scene, world, level, tunnel) {
    this.tunnel = tunnel;
    this.level = level;
    const terrain = world.terrainOf(level);
    const mx = (tunnel.x1 + tunnel.x2) / 2;
    const mz = (tunnel.z1 + tunnel.z2) / 2;
    this.pos = new THREE.Vector3(mx, world.levelY(level) + terrain.floorAt(mx, mz), mz);

    this.mesh = makeStonePlug(world.levels[level].rng);
    this.mesh.position.copy(this.pos);
    const ang = Math.atan2(tunnel.z2 - tunnel.z1, tunnel.x2 - tunnel.x1);
    this.mesh.rotation.y = -ang;
    this.mesh.scale.set(1, 1, Math.max(1, tunnel.w / 3.2));
    scene.add(this.mesh);

    this.radius = tunnel.w * 0.9;
    this.progress = 0;
    this.cleared = false;
    this.crew = 0;
    this.node = tunnel.node;
  }

  /** Advance the dig if enough ants are on it. Returns true the moment it opens. */
  work(dt, crewCount) {
    this.crew = crewCount;
    if (this.cleared) return false;
    if (crewCount < RECRUIT.hauling) return false;
    this.progress += dt * (1 + (crewCount - RECRUIT.hauling) * 0.35);
    // stones visibly shuffle aside as the crew works
    const f = Math.min(1, this.progress / RECRUIT.haulTime);
    for (const s of this.mesh.userData.stones) {
      const h = s.userData.home;
      s.position.x = h.x * (1 + f * 2.2);
      s.position.y = h.y * (1 - f * 0.85);
      s.position.z = h.z * (1 + f * 1.4);
      s.rotation.x = f * 4;
    }
    if (this.progress >= RECRUIT.haulTime) {
      this.cleared = true;
      return true;
    }
    return false;
  }

  blocks(x, z) {
    if (this.cleared) return false;
    return Math.hypot(x - this.pos.x, z - this.pos.z) < this.radius;
  }

  dispose(scene) { scene.remove(this.mesh); }
}

// ------------------------------------------------------------ Leaf raft ----
/** A fallen leaf. Dry it is scenery; flooded it is a boat. */
export class LeafRaft {
  constructor(mesh, level, world) {
    this.mesh = mesh;
    this.level = level;
    // The leaf hangs off the level group, so its own position is local. Water
    // levels and the player are in world space, so keep the raft in world
    // space and convert back when writing the mesh.
    this.baseY = world.levelY(level);
    this.pos = new THREE.Vector3(mesh.position.x, this.baseY + mesh.position.y, mesh.position.z);
    this.groundY = this.pos.y;
    this.radius = 2.5 * (mesh.scale.x || 1);
    this.afloat = false;
    this.topY = this.groundY;
    this.drift = new THREE.Vector3();
    this.bob = Math.random() * 6.28;
    this.spin = (Math.random() - 0.5) * 0.25;
  }

  update(dt, waterY, terrain, baseY, t) {
    this.bob += dt;
    const float = waterY !== null && waterY > this.groundY + 0.25;
    this.afloat = float;

    if (float) {
      const target = waterY + 0.18;
      this.pos.y += (target - this.pos.y) * Math.min(1, dt * 3.5);
      // drifts on the current — enough that riding one actually takes you places
      const cur = 4.2;
      this.drift.set(Math.sin(t * 0.21 + this.bob) * cur, 0, Math.cos(t * 0.17 + this.bob) * cur);
      this.pos.x += this.drift.x * dt;
      this.pos.z += this.drift.z * dt;
      terrain.resolve(this.pos, this.radius * 0.5, MIN_HEADROOM * 0.6);
      this.mesh.rotation.y += this.spin * dt;
      this.mesh.rotation.z = Math.sin(this.bob * 1.3) * 0.045;
      this.mesh.rotation.x = Math.cos(this.bob * 1.1) * 0.045;
      // light it from inside so it reads across a dark flooded chamber
      const m = this.mesh.userData.mat;
      if (m) m.emissiveIntensity = 0.5 + Math.sin(this.bob * 2.2) * 0.18;
    } else {
      this.drift.set(0, 0, 0);
      this.pos.y += (this.groundY - this.pos.y) * Math.min(1, dt * 4);
      this.mesh.rotation.z *= 0.9;
      this.mesh.rotation.x *= 0.9;
      const m = this.mesh.userData.mat;
      if (m) m.emissiveIntensity *= 0.9;
    }
    this.topY = this.pos.y + 0.2;
    this.mesh.position.set(this.pos.x, this.pos.y - this.baseY, this.pos.z);
  }
}

// --------------------------------------------------------------- Pickups ----
export class Pickup {
  constructor(key, scene, world, level, spot) {
    this.def = PICKUP_TYPES[key];
    this.key = key;
    this.mesh = makePickup(this.def.color);
    const terrain = world.terrainOf(level);
    this.pos = new THREE.Vector3(
      spot.x, world.levelY(level) + terrain.floorAt(spot.x, spot.z) + 1.0, spot.z);
    this.mesh.position.copy(this.pos);
    this.level = level;
    this.spin = Math.random() * 6.28;
    scene.add(this.mesh);
  }

  update(dt, t) {
    this.spin += dt * 2;
    this.mesh.rotation.y = this.spin;
    this.mesh.position.y = this.pos.y + Math.sin(t * 2.3 + this.spin) * 0.22;
    this.mesh.userData.halo.scale.setScalar(1 + Math.sin(t * 3 + this.spin) * 0.09);
  }

  dispose(scene) { scene.remove(this.mesh); }
}

/** The recruitment gland: the power that makes hauling crews possible. */
export class Gland {
  constructor(scene, world, level, spot) {
    this.mesh = makeGland();
    const terrain = world.terrainOf(level);
    this.pos = new THREE.Vector3(
      spot.x, world.levelY(level) + terrain.floorAt(spot.x, spot.z) + 1.6, spot.z);
    this.mesh.position.copy(this.pos);
    this.level = level;
    this.t = 0;
    scene.add(this.mesh);
  }

  update(dt, t) {
    this.t += dt;
    this.mesh.position.y = this.pos.y + Math.sin(this.t * 1.5) * 0.3;
    this.mesh.userData.core.rotation.y += dt * 0.8;
    this.mesh.userData.rings.forEach((r, i) => {
      r.rotation.x += dt * (0.4 + i * 0.25);
      r.rotation.y += dt * (0.3 - i * 0.1);
    });
  }

  dispose(scene) { scene.remove(this.mesh); }
}

// ------------------------------------------------------------- Acid gas ----
/** A travelling lungful of formic vapour. */
export class AcidBolt {
  constructor(scene, origin, dir, level, big = false) {
    this.mesh = makeAcidBolt();
    this.mesh.position.copy(origin);
    if (big) this.mesh.scale.setScalar(2.1);
    scene.add(this.mesh);
    this.vel = dir.clone().multiplyScalar(ACID.boltSpeed * (big ? 0.72 : 1));
    this.level = level;
    this.big = big;
    this.life = 1.3;
    this.dead = false;
    this.spin = 0;
  }

  /** Steps in small slices so a fast bolt cannot tunnel through a body. */
  update(dt, targets, terrain, baseY) {
    this.life -= dt;
    this.spin += dt * 7;
    const steps = 3;
    const sub = dt / steps;
    const r = ACID.boltRadius * (this.big ? 2 : 1);

    for (let i = 0; i < steps; i++) {
      this.mesh.position.addScaledVector(this.vel, sub);
      this.vel.y -= 5 * sub;
      const p = this.mesh.position;

      for (const t of targets) {
        if (t.dead || t.level !== this.level) continue;
        const rad = (t.cfg?.bodyRadius ?? 1) + r;
        if (p.distanceTo(t.pos) < rad) { this.dead = true; return t; }
      }

      const floor = baseY + terrain.floorAt(p.x, p.z);
      if (p.y <= floor + 0.2 || terrain.headAt(p.x, p.z) < MIN_HEADROOM * 0.5) {
        this.dead = true;
        this.mesh.position.y = Math.max(p.y, floor + 0.3);
        return 'ground';
      }
    }

    // the vapour trail boils as it flies
    const d = this.mesh.userData;
    d.puffs.forEach((q, i) => {
      q.scale.setScalar(1 + Math.sin(this.spin * 2 + i) * 0.22);
      q.position.set(Math.sin(this.spin + i) * 0.1, Math.cos(this.spin * 1.3 + i) * 0.1, -i * 0.16);
    });
    if (this.life <= 0) { this.dead = true; return 'ground'; }
    return null;
  }

  dispose(scene) { scene.remove(this.mesh); }
}

/** What the bolt leaves behind: a cloud that eats whatever stands in it. */
export class AcidCloud {
  constructor(scene, world, level, pos, big = false) {
    this.radius = big ? ACID.burstRadius : ACID.cloudRadius;
    this.dps = big ? ACID.burstDps : ACID.cloudDps;
    this.life = big ? ACID.burstLife : ACID.cloudLife;
    this.maxLife = this.life;
    this.mesh = makeAcidCloud(this.radius, big);
    this.pos = pos.clone();
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    this.level = level;
    this.dead = false;
    this.t = 0;
  }

  update(dt, targets, player) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    const f = 1 - this.life / this.maxLife;
    const grow = 0.5 + f * 0.55;
    for (const b of this.mesh.userData.blobs) {
      b.position.addScaledVector(b.userData.drift, dt);
      b.rotation.y += b.userData.spin * dt;
      b.scale.setScalar(grow);
      b.material.opacity = 0.17 * (1 - f) + 0.02;
    }
    this.reach = this.radius * grow;
  }

  touches(t) {
    if (t.dead || t.level !== this.level) return false;
    return t.pos.distanceTo(this.pos) < this.reach + (t.cfg?.bodyRadius ?? 1);
  }

  dispose(scene) { scene.remove(this.mesh); }
}

/**
 * Resolve every cloud at once, taking only the strongest one touching each
 * body. Without this, a spray of overlapping puffs stacks into thousands of
 * damage per second and nothing survives long enough to fight back.
 */
export function applyClouds(clouds, targets, dt) {
  const killed = [];
  for (const t of targets) {
    if (t.dead) continue;
    let worst = 0;
    for (const c of clouds) {
      if (c.dead || c.hostile) continue;
      if (c.touches(t) && c.dps > worst) worst = c.dps;
    }
    if (worst > 0 && t.hurt(worst * dt, 0, true)) killed.push(t);
  }
  return killed;
}

// ----------------------------------------------------------------- Boss ----
/**
 * A floor's champion. Ordinary ants walk at you; a champion telegraphs, then
 * commits — charges, slams the floor, spits spores, or calls its guard. Every
 * move is announced before it lands, so every death is readable.
 */
export class Boss {
  constructor(key, scene, world, level, spot) {
    const cfg = BOSSES[key];
    this.key = key;
    this.raw = cfg;
    // shaped like an Enemy cfg so the aiming and damage code needs no changes
    this.cfg = {
      label: cfg.name, bodyRadius: cfg.scale * 0.62, headY: cfg.scale * 0.62,
      contact: cfg.contact, damage: cfg.damage, drop: 0,
    };
    this.mesh = makeBoss(cfg);
    scene.add(this.mesh);

    const terrain = world.terrainOf(level);
    this.pos = new THREE.Vector3(spot.x, world.levelY(level) + terrain.floorAt(spot.x, spot.z), spot.z);
    this.vel = new THREE.Vector3();
    this.level = level;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.dead = false;
    this.awake = false;

    this.state = 'idle';
    this.timer = 0;
    this.cadence = cfg.cadence;
    this.nextMove = 1.9;          // open with a move rather than a long walk
    this.attackTimer = 0;
    this.chargeDir = new THREE.Vector3();
    this.enraged = false;
    this.flash = 0;
    this.rooted = 0;
    this.waypoint = null;
    this.repath = 0;
    this.telegraph = null;      // { kind, at } for the HUD and the ring
    this.mesh.position.copy(this.pos);
  }

  get hpFrac() { return Math.max(0, this.hp / this.maxHp); }

  hurt(amount, root = 0, overTime = false) {
    // armour blunts every hit; acid clouds ignore a slice of it, which is why
    // the gas matters against the heavily plated ones
    const armour = overTime ? this.raw.armour * 0.45 : this.raw.armour;
    this.hp -= amount * (1 - armour);
    if (!overTime) this.flash = 0.22;
    if (root) this.rooted = Math.max(this.rooted, root * 0.35);
    if (!this.enraged && this.hpFrac <= this.raw.enrageAt) {
      this.enraged = true;
      this.cadence = this.raw.cadence * 0.62;
      this.onEnrage?.();
    }
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }

  update(dt, ctx, t) {
    if (this.dead) return;
    const { player, world } = ctx;
    const terrain = world.terrainOf(this.level);
    const baseY = world.levelY(this.level);
    const cfg = this.raw;

    if (this.rooted > 0) this.rooted -= dt;
    if (this.flash > 0) this.flash -= dt;

    // the aura pulses, and burns hotter once it is enraged
    const d = this.mesh.userData;
    const pulse = 0.14 + Math.abs(Math.sin(t * (this.enraged ? 5 : 2))) * 0.14;
    d.glowMat.opacity = this.flash > 0 ? 0.55 : pulse;
    d.light.intensity = (this.enraged ? 54 : 34) * (0.7 + pulse * 2);
    d.halo.scale.setScalar(1 + pulse * 0.5);

    const same = player.level === this.level;
    const to = new THREE.Vector3().subVectors(player.pos, this.pos);
    const dist = to.length();

    if (!this.awake) {
      if (same && dist < cfg.sight) { this.awake = true; this.state = 'chase'; ctx.onWake?.(this); }
      else { this.#idle(dt, t); return; }
    }

    this.timer -= dt;
    this.nextMove -= dt;

    switch (this.state) {
      case 'chase': {
        this.#walk(dt, player.pos.x, player.pos.z, terrain, cfg.speed * (this.enraged ? 1.22 : 1), ctx);
        if (this.nextMove <= 0 && same && dist < cfg.sight) {
          const pool = cfg.abilities;
          const pick = pool[Math.floor(Math.random() * pool.length)];
          this.state = 'telegraph';
          this.telegraph = { kind: pick };
          this.timer = pick === 'charge' ? 1.05 : 1.25;
          ctx.onTelegraph?.(this, pick);
        }
        break;
      }
      case 'telegraph': {
        this.vel.x *= 0.82; this.vel.z *= 0.82;
        this.#face(to, dt, 6);
        if (this.timer <= 0) {
          const k = this.telegraph.kind;
          if (k === 'charge') {
            this.chargeDir.copy(to).setY(0).normalize();
            this.state = 'charge';
            this.timer = 1.15;
          } else if (k === 'slam') {
            this.state = 'slam';
            this.timer = 0.24;
          } else if (k === 'summon') {
            ctx.onSummon?.(this);
            this.state = 'recover';
            this.timer = 0.9;
          } else {
            ctx.onSpray?.(this, to.clone().setY(0).normalize());
            this.state = 'recover';
            this.timer = 0.8;
          }
        }
        break;
      }
      case 'charge': {
        const sp = cfg.speed * (this.enraged ? 3.4 : 2.9);
        this.vel.x = this.chargeDir.x * sp;
        this.vel.z = this.chargeDir.z * sp;
        moveOnTerrain(this.pos, this.vel, dt, terrain, this.cfg.bodyRadius * 0.55, MIN_HEADROOM * 0.7);
        if (same && dist < this.cfg.contact + 1.4 && player.damage(cfg.damage * 1.35)) {
          ctx.onHit?.(this);
          this.timer = Math.min(this.timer, 0.12);
        }
        if (this.timer <= 0) { this.state = 'recover'; this.timer = 0.75; }
        break;
      }
      case 'slam': {
        this.vel.set(0, 0, 0);
        if (this.timer <= 0) {
          ctx.onSlam?.(this);
          this.state = 'recover';
          this.timer = 1.0;
        }
        break;
      }
      case 'recover': {
        this.vel.x *= 0.86; this.vel.z *= 0.86;
        if (this.timer <= 0) {
          this.state = 'chase';
          this.nextMove = this.cadence * (0.75 + Math.random() * 0.5);
          this.telegraph = null;
        }
        break;
      }
    }

    this.pos.y = baseY + terrain.floorAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);

    // a plain bite when you stand in reach
    this.attackTimer -= dt;
    if (same && this.state !== 'charge' && dist < this.cfg.contact &&
        Math.abs(player.pos.y - this.pos.y) < 4 && this.attackTimer <= 0) {
      if (player.damage(cfg.damage)) {
        this.attackTimer = cfg.attackCd;
        ctx.onHit?.(this);
      }
    }

    animateAnt(d.ant, t, this.state === 'charge' ? 1 : 0.5,
      { bite: this.state === 'telegraph' ? 0.7 : undefined });
  }

  #idle(dt, t) {
    this.mesh.position.y = this.pos.y + Math.sin(t * 0.8) * 0.06;
    animateAnt(this.mesh.userData.ant, t, 0.08);
  }

  #face(to, dt, rate) {
    const want = Math.atan2(to.x, to.z);
    const turn = want - this.mesh.rotation.y;
    this.mesh.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * rate);
  }

  #walk(dt, tx, tz, terrain, speed, ctx) {
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.4;
      const n = terrain.routeStep(this.pos.x, this.pos.z, tx, tz, ctx.blockedNodes);
      this.waypoint = n ? { x: n.x, z: n.z } : null;
    }
    const aim = this.waypoint ?? { x: tx, z: tz };
    const dx = aim.x - this.pos.x, dz = aim.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const sp = this.rooted > 0 ? 0 : speed;
    this.vel.x += (dx / len) * sp * dt * 10;
    this.vel.z += (dz / len) * sp * dt * 10;
    const s = Math.hypot(this.vel.x, this.vel.z);
    if (s > sp) { this.vel.x *= sp / s; this.vel.z *= sp / s; }
    moveOnTerrain(this.pos, this.vel, dt, terrain, this.cfg.bodyRadius * 0.55, MIN_HEADROOM * 0.7);
    if (s > 0.2) this.#face(new THREE.Vector3(dx, 0, dz), dt, 5);
  }

  dispose(scene) { scene.remove(this.mesh); }
}
