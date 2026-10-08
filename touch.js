/* --------------------------------------------------------------------------
   Formica — touch controls.

   A phone has no pointer lock, no keyboard and no spare fingers, so the
   mapping is not the desktop one with buttons bolted on. Two thumbs do
   everything: the left one steers on a floating stick, the right one aims by
   dragging the view, and the buttons sit under where the right thumb already
   rests. Nothing important is more than a thumb's reach from a corner.

   The stick is analog, so pushing it gently creeps and pushing it to the rim
   sprints — that is one fewer button than a sprint toggle would need, and it
   is how a thumb wants to behave anyway.
   -------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

/**
 * Capture is an optimisation, not a requirement: it keeps a drag alive when
 * the thumb slides off the element it started on. Some browsers throw if the
 * pointer has already been released, and losing the whole drag over a failed
 * nicety would be worse than not having it.
 */
const grab = (el, id) => { try { el.setPointerCapture(id); } catch { /* fine */ } };

/**
 * Is this a touch device?
 *
 * Deliberately not user-agent sniffing. A laptop with a touchscreen reports
 * touch points but has a mouse, and an iPad reports itself as a Mac. What we
 * actually care about is whether the primary pointer is coarse, which is the
 * question `pointer: coarse` asks, with the touch-point count as a fallback
 * for older WebKit.
 */
export function isTouch() {
  if (typeof matchMedia === 'function') {
    if (matchMedia('(pointer: coarse)').matches) return true;
    if (matchMedia('(pointer: fine)').matches) return false;
  }
  return (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
}

const STICK_R = 54;      // px the knob may travel before it is at full push
const SPRINT_AT = 0.88;  // fraction of that travel which means "run"
const REAIM = 0.34;      // radians of thumb movement that counts as a new heading

export class TouchControls {
  /**
   * @param {object} game  the Game, for input, yaw/pitch and the actions
   */
  constructor(game) {
    this.game = game;
    this.layer = $('touch');
    this.stick = $('tstick');
    this.knob = $('tknob');

    this.moveId = null;      // pointerId steering
    this.lookId = null;      // pointerId on the right-hand zone
    this.origin = { x: 0, y: 0 };
    this.pinch = null;
    this.aimAngle = null;    // thumb heading the movement frame was captured at

    document.body.classList.add('touch');
    this.layer.classList.remove('gone');

    game.input.analog = true;
    game.input.moveX = 0;
    game.input.moveY = 0;

    this.#bindSticks();
    this.#bindButtons();
    this.#bindFullscreen();
    this.#bindOrientation();
  }

  // ------------------------------------------------------------ the sticks --
  #bindSticks() {
    const look = $('tlook');

    // Steering. The stick floats: it appears wherever the thumb lands in the
    // left-hand zone, so there is no small target to hit while being chased.
    const zone = $('tmove');
    zone.addEventListener('pointerdown', (e) => {
      if (this.moveId !== null) return;
      this.moveId = e.pointerId;
      this.origin.x = e.clientX;
      this.origin.y = e.clientY;
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.stick.classList.add('live');
      this.aimAngle = null;            // first push of this gesture sets the frame
      grab(zone, e.pointerId);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.moveId) return;
      this.#steer(e.clientX - this.origin.x, e.clientY - this.origin.y);
      e.preventDefault();
    });
    const drop = (e) => {
      if (e.pointerId !== this.moveId) return;
      this.moveId = null;
      this.stick.classList.remove('live');
      this.knob.style.transform = 'translate(-50%,-50%)';
      this.#steer(0, 0);
    };
    zone.addEventListener('pointerup', drop);
    zone.addEventListener('pointercancel', drop);

    // The right-hand zone no longer turns the camera — the camera follows her
    // by itself now, so there is nothing to aim. What is left is pinch to
    // change the camera distance, and the tap that plants a rally point while
    // the command view is up.
    look.addEventListener('pointerdown', (e) => {
      if (this.lookId === null) {
        this.lookId = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.moved = 0;
        this.game.setLooking(true);
        grab(look, e.pointerId);
      } else if (this.pinch === null) {
        this.pinch = { id: e.pointerId, x: e.clientX, y: e.clientY, base: this.game.camDist };
      }
      e.preventDefault();
    });
    look.addEventListener('pointermove', (e) => {
      const g = this.game;
      if (e.pointerId === this.lookId) {
        const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.lastX = e.clientX; this.lastY = e.clientY;
        // Swing the camera off her back to look around. It is an offset, not a
        // free camera, so it finds its own way home when you let go.
        if (!g.tactical) g.lookBy(dx, dy);
      } else if (this.pinch && e.pointerId === this.pinch.id) {
        const spread = Math.hypot(e.clientX - this.lastX, e.clientY - this.lastY);
        if (!this.pinch.start) this.pinch.start = spread;
        g.camDist = Math.max(4.5, Math.min(16, this.pinch.base - (spread - this.pinch.start) * 0.05));
      }
      e.preventDefault();
    });
    const lookUp = (e) => {
      if (this.pinch && e.pointerId === this.pinch.id) { this.pinch = null; return; }
      if (e.pointerId !== this.lookId) return;
      this.lookId = null;
      this.game.setLooking(false);
      // A tap rather than a drag, while the tactical view is up, is an order:
      // the finger is the cursor there, so send the crew where it landed.
      if (this.moved < 12 && this.game.tactical) {
        this.game.orderAt(
          (e.clientX / innerWidth) * 2 - 1,
          -(e.clientY / innerHeight) * 2 + 1,
        );
      }
    };
    look.addEventListener('pointerup', lookUp);
    look.addEventListener('pointercancel', lookUp);
  }

  /**
   * Knob position in, movement intent out.
   *
   * The subtle part is `frameYaw`: the camera direction the thumb's push is
   * measured against. The camera now swings to follow wherever she walks, so
   * if the push were measured against the *live* camera, "right" would keep
   * rotating as the camera turned and she would spiral.
   *
   * So the frame is captured and frozen while the thumb holds a heading, which
   * walks a straight line, and re-captured the moment the thumb genuinely
   * points somewhere else — which is exactly when the player wants "up" to
   * mean up the screen again.
   */
  #steer(dx, dy) {
    const len = Math.hypot(dx, dy);
    const k = len > STICK_R ? STICK_R / len : 1;
    const x = dx * k, y = dy * k;
    this.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    const inp = this.game.input;
    if (len / STICK_R > 0.3) {
      const a = Math.atan2(y, x);
      const turned = this.aimAngle === null
        || Math.abs(Math.atan2(Math.sin(a - this.aimAngle), Math.cos(a - this.aimAngle))) > REAIM;
      if (turned) {
        this.aimAngle = a;
        inp.frameYaw = this.game.yaw;
      }
    } else {
      this.aimAngle = null;            // back near centre: re-aim from scratch
      inp.frameYaw = this.game.yaw;
    }

    inp.moveX = x / STICK_R;
    inp.moveY = y / STICK_R;
    inp.sprint = len / STICK_R > SPRINT_AT;
    this.stick.classList.toggle('run', inp.sprint);

    // Keep the digital flags in step, because the HUD and the dash read them.
    inp.forward = inp.moveY < -0.3 ? 1 : 0;
    inp.back = inp.moveY > 0.3 ? 1 : 0;
    inp.left = inp.moveX < -0.3 ? 1 : 0;
    inp.right = inp.moveX > 0.3 ? 1 : 0;
  }

  // ------------------------------------------------------------- the buttons --
  /**
   * Two kinds of button. A `hold` one is down while the thumb is down, which
   * is what firing and charging want. A `tap` one fires once on contact, which
   * is what a weapon switch or a pause wants.
   */
  #bindButtons() {
    const g = this.game;

    const hold = (id, on, off) => {
      const el = $(id);
      if (!el) return;
      const down = (e) => {
        el.classList.add('down');
        grab(el, e.pointerId);
        on();
        e.preventDefault(); e.stopPropagation();
      };
      const up = (e) => {
        el.classList.remove('down');
        off();
        e.preventDefault(); e.stopPropagation();
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };

    const tap = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        el.classList.add('down');
        fn();
        e.preventDefault(); e.stopPropagation();
      });
      const up = (e) => { el.classList.remove('down'); e.preventDefault(); e.stopPropagation(); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };

    hold('tb-fire', () => { g.input.fire = true; }, () => { g.input.fire = false; });
    hold('tb-burst', () => { g.input.burst = true; }, () => { g.input.burst = false; });
    hold('tb-trail', () => { g.input.scent = true; }, () => { g.input.scent = false; });
    hold('tb-tac', () => g.setTactical(true), () => g.setTactical(false));

    tap('tb-dash', () => g.jumpOrDash());
    tap('tb-bite', () => g.toggleWeapon());
    tap('tb-use', () => g.interact());
    tap('tb-call', () => g.callNestmates());
    tap('tb-pause', () => (g.state === 'playing' ? g.pause() : g.resume()));
    tap('tb-full', () => this.toggleFullscreen());
    tap('tb-centre', () => g.recentreCamera());
    tap('tb-map', () => {
      document.body.classList.toggle('bigmap');
      g.drawMap?.();
    });

    // and tapping off the map closes it again
    $('mapscrim')?.addEventListener('pointerdown', (e) => {
      document.body.classList.remove('bigmap');
      e.preventDefault(); e.stopPropagation();
    });
  }

  // ------------------------------------------------------------ fullscreen --
  /**
   * Is the page already filling the screen? Either because it is in a
   * fullscreen element, or because it was launched from a home-screen icon,
   * which is how iOS does it.
   */
  static get standalone() {
    return !!document.fullscreenElement
      || !!document.webkitFullscreenElement
      || navigator.standalone === true
      || (matchMedia?.('(display-mode: standalone)').matches ?? false);
  }

  /** Does this browser have the Fullscreen API at all? iPhone Safari does not. */
  static get canFullscreen() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }

  /**
   * Fullscreen on demand, and an honest answer when it is not possible.
   *
   * Android Chrome and iPadOS have the API. Safari on iPhone does not expose
   * it on anything but a video element, so no amount of trying will work
   * there — rather than fail silently, say what does work, which is Add to
   * Home Screen.
   */
  async toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
        this.#markFull();
        return;
      }
      if (!TouchControls.canFullscreen) { this.#iosHint(); return; }
      await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
      try { await screen.orientation?.lock?.('landscape'); } catch { /* optional */ }
    } catch {
      this.#iosHint();
    }
    this.#markFull();
    this.game.fit?.();
  }

  #markFull() {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    // `on`, not `down` — `down` is the press animation and carries a scale,
    // which would shrink the button for as long as fullscreen lasted.
    $('tb-full')?.classList.toggle('on', on);
    const b = $('btn-full');
    if (b) b.textContent = on ? 'Leave full screen' : 'Full screen';
  }

  #iosHint() {
    const el = $('fullhint');
    if (!el) return;
    el.classList.remove('gone');
  }

  #bindFullscreen() {
    $('btn-full')?.addEventListener('click', () => this.toggleFullscreen());
    $('fullhint-ok')?.addEventListener('click', () => $('fullhint').classList.add('gone'));
    document.addEventListener('fullscreenchange', () => { this.#markFull(); this.game.fit?.(); });
    document.addEventListener('webkitfullscreenchange', () => { this.#markFull(); this.game.fit?.(); });

    // Already filling the screen from a home-screen icon? Then there is
    // nothing to offer, and a dead button is worse than no button.
    if (TouchControls.standalone) {
      $('tb-full')?.classList.add('gone');
      $('btn-full')?.classList.add('gone');
    }
  }

  // -------------------------------------------------------------- rotation --
  /**
   * Landscape is the right way up for this: two thumbs at the edges, and the
   * burrow is wider than it is tall. Portrait still plays, so the hint is a
   * nudge that goes away by itself rather than a wall.
   */
  #bindOrientation() {
    const hint = $('rotate-hint');
    if (!hint) return;
    const check = () => {
      const portrait = innerHeight > innerWidth;
      hint.classList.toggle('gone', !portrait || this.dismissed);
    };
    hint.addEventListener('pointerdown', () => { this.dismissed = true; check(); });
    addEventListener('resize', check);
    addEventListener('orientationchange', () => setTimeout(check, 260));
    check();
  }

  /**
   * Grey out the buttons the player has not earned yet, so the pad shows what
   * she can do rather than everything she might one day do.
   */
  refresh(p) {
    const set = (id, on) => $(id)?.classList.toggle('locked', !on);
    set('tb-burst', p.powers.burst);
    set('tb-call', p.hasGland);
    set('tb-dash', p.powers.dash);
  }
}
