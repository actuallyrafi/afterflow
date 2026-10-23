/* Afterflow v4.1h: LiquidSelect on the Web Animations API. Drop in as lib/liquid-select.ts (replaces v4.1g).
   Taps and keys: the spring is precomputed into keyframes and played with element.animate() on transform
   and opacity only, so Chrome's compositor and Safari's Core Animation run it off the main thread.
   Drag: the only rAF loop, writing transform directly. No layout reads except measure() (init + ResizeObserver).
   Same values as v4.1g: spring 520/34/1, stretch 1.12-1.18 by distance, press .96, reduced motion 120ms. */

export type CommitMode = "settle" | "frame";
export type LiquidOptions = {
  /** Called once the choice is final. The owner updates aria-checked / navigates here. */
  onPick?: (index: number, el: HTMLElement) => void;
  /** "settle" (default): after the pill lands, so no React work runs during the motion.
   *  "frame": after the animation is on the compositor (two frames), for navigation. Keyboard always uses "frame". */
  commit?: CommitMode;
};

const SPRING = { stiffness: 520, damping: 34, mass: 1 }; // ζ ≈ 0.745, ~3% overshoot
const H = 1 / 240;            // physics step (s)
const SAMPLE_MS = 1000 / 120; // one keyframe per 120Hz frame, so ProMotion gets real in-between frames
const MAX_MS = 900;
const REDUCED_MS = 120;
const DRAG_SLOP = 6;
const PROJECT_S = 0.15;
const RUBBER = 0.55;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const isSelected = (el: Element) => el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-current") === "page";
const isDisabled = (el: Element) => el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled === true;
const reducedMotion = (el: Element) => matchMedia("(prefers-reduced-motion: reduce)").matches || !!el.closest("[data-sim-rm]");
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
function haptic() {
  try { if ("vibrate" in navigator && /Android/i.test(navigator.userAgent)) navigator.vibrate(8); } catch { /* ignore */ }
}
const afterTwoFrames = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

type Curve = { xs: number[]; vs: number[]; sx: number[]; sy: number[]; ms: number };
type Drag = { id: number; sx: number; sy: number; px: number; active: boolean; armed: boolean; samples: { t: number; x: number }[] };

/** The spring as samples. Pure: the same inputs give the same frames (tests + capture). */
export function springCurve(from: number, to: number, v0: number, w: number, reduced: boolean): Curve {
  const xs: number[] = [], vs: number[] = [], sx: number[] = [], sy: number[] = [];
  const span = Math.abs(to - from);
  if (reduced) {
    const n = Math.max(2, Math.round(REDUCED_MS / SAMPLE_MS) + 1);
    for (let i = 0; i < n; i++) { const p = i / (n - 1); xs.push(from + (to - from) * easeOutCubic(p)); vs.push(0); sx.push(1); sy.push(1); }
    return { xs, vs, sx, sy, ms: REDUCED_MS };
  }
  const d = span / w;
  const peak = d < 0.05 ? 1 : 1.12 + 0.06 * clamp((d - 1) / 2, 0, 1);
  const flick = Math.abs(v0) > 50;
  const { stiffness: k, damping: c, mass: m } = SPRING;
  let x = from, v = v0, t = 0, next = 0;
  for (;;) {
    if (t >= next) {
      const prog = span > 0.5 ? clamp(Math.abs(x - from) / span, 0, 1) : 1;
      const byDistance = 1 + (peak - 1) * Math.sin(Math.PI * prog);
      const byVelocity = flick ? 1 + Math.min(0.12, Math.abs(v) / 6000) : 1;
      const s = Math.max(byDistance, byVelocity);
      xs.push(x); vs.push(v); sx.push(s); sy.push(1 - (s - 1) * 0.45);
      next += SAMPLE_MS;
      if ((Math.abs(x - to) < 0.25 && Math.abs(v) < 8) || t > MAX_MS) break;
    }
    const a = (-k * (x - to) - c * v) / m;
    v += a * H; x += v * H; t += H * 1000;
  }
  xs[xs.length - 1] = to; vs[vs.length - 1] = 0; sx[sx.length - 1] = 1; sy[sy.length - 1] = 1;
  return { xs, vs, sx, sy, ms: (xs.length - 1) * SAMPLE_MS };
}

export class LiquidSelect {
  readonly root: HTMLElement;
  private pill: HTMLElement;
  private lens: HTMLElement;
  private items: HTMLElement[];
  private on: (HTMLElement | null)[];
  private base: (HTMLElement | null)[];
  private onPick: NonNullable<LiquidOptions["onPick"]>;
  private commitMode: CommitMode;
  private xs: number[] = [];
  private w = 1;
  index: number;
  private x = 0;                       // the resting / last-written position
  private anims: Animation[] = [];
  private curve: Curve | null = null;
  private gen = 0;
  private pending: number | null = null;
  private pendingMode: CommitMode = "settle";
  private drag: Drag | null = null;
  private dragRaf = 0; private dragX = 0; private dragSx = 1;
  private pressed: HTMLElement | null = null;
  private suppressClick = false;
  private ro: ResizeObserver;

  constructor(root: HTMLElement, options: LiquidOptions = {}) {
    this.root = root;
    this.onPick = options.onPick ?? (() => {});
    this.commitMode = options.commit ?? "settle";
    this.pill = root.querySelector<HTMLElement>(".lq-pill")!;
    this.lens = root.querySelector<HTMLElement>(".lq-lens")!;
    this.items = Array.from(root.querySelectorAll<HTMLElement>(".lq-opt"));
    this.on = this.items.map((o) => o.querySelector<HTMLElement>(".lq-on"));
    this.base = this.items.map((o) => o.querySelector<HTMLElement>(".lq-lbl:not(.lq-on)"));
    this.index = Math.max(0, this.items.findIndex(isSelected));
    this.measure();
    this.x = this.xs[this.index];
    this.write(this.x, 1, 1);
    this.ro = new ResizeObserver(() => {
      this.measure();
      if (!this.anims.length && !this.drag) { this.x = this.xs[this.index]; this.write(this.x, 1, 1); }
    });
    this.ro.observe(root);
    root.addEventListener("pointerdown", this.onDown);
    root.addEventListener("click", this.onClick, true);
    if (root.getAttribute("role") === "radiogroup") root.addEventListener("keydown", this.onKey);
    root.classList.add("lq-ready");
  }

  measure() {
    this.xs = this.items.map((o) => o.offsetLeft);
    this.w = Math.max(1, this.items[0]?.offsetWidth ?? 1); // a control measured while hidden has no width yet
    this.pill.style.width = `${this.w}px`;
  }

  private inkOpacity(x: number, i: number) { return clamp(1 - Math.abs(x - this.xs[i]) / this.w, 0, 1); }

  /** Direct style writes: the resting state, and drag frames. */
  private write(x: number, sx: number, sy: number) {
    this.pill.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    this.lens.style.transform = sx === 1 && sy === 1 ? "" : `scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    for (let i = 0; i < this.items.length; i++) {
      const o = this.inkOpacity(x, i);
      const on = this.on[i], base = this.base[i];
      if (on) on.style.opacity = o.toFixed(3);
      if (base) base.style.opacity = (1 - o).toFixed(3);
    }
  }

  /** Where the pill is now (and how fast), from the playing curve: no style read, no layout. */
  private now(): { x: number; v: number } {
    const a = this.anims[0], c = this.curve;
    if (!a || !c) return { x: this.x, v: 0 };
    const t = clamp(Number(a.currentTime ?? 0), 0, c.ms);
    const f = t / SAMPLE_MS, i = Math.min(c.xs.length - 2, Math.floor(f)), r = f - i;
    if (i < 0) return { x: c.xs[0], v: c.vs[0] };
    return { x: c.xs[i] + (c.xs[i + 1] - c.xs[i]) * r, v: c.vs[i] + (c.vs[i + 1] - c.vs[i]) * r };
  }

  private stop() {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    this.curve = null;
  }

  select(i: number, opts: { velocity?: number; commit?: CommitMode | false } = {}) {
    if (i < 0 || i >= this.items.length || isDisabled(this.items[i])) return;
    const changed = i !== this.index;
    this.index = i;
    if (changed && opts.commit !== false) {
      haptic();
      this.pending = i;
      this.pendingMode = opts.commit ?? this.commitMode;
      if (this.pendingMode === "frame") afterTwoFrames(this.flush);
    }
    this.play(this.xs[i], opts.velocity);
  }

  /** Hand the choice to the owner (React state / navigation). Runs once per choice. */
  private flush = () => {
    const i = this.pending;
    if (i == null) return;
    this.pending = null;
    this.onPick(i, this.items[i]);
  };

  /** Owner changed the selection (route change, state set elsewhere). */
  sync() {
    const i = this.items.findIndex(isSelected);
    if (i >= 0 && i !== this.index && this.pending == null) { this.index = i; this.play(this.xs[i]); }
  }

  /** Start (or retarget) the spring on the compositor. */
  private play(to: number, v0?: number) {
    const cur = this.now();
    const from = this.drag ? this.dragX : cur.x;
    const v = v0 ?? cur.v;              // a mid-flight tap keeps the pill's momentum
    this.stop();
    this.gen++;
    const g = this.gen;
    const c = springCurve(from, to, v, this.w, reducedMotion(this.root));
    this.x = to;
    // Final values go inline first: when the animations end (or are cancelled) nothing jumps.
    this.write(to, 1, 1);
    if (c.xs.length < 2 || (Math.abs(to - from) < 0.25 && Math.abs(v) < 8)) { this.settled(); return; }
    const timing: KeyframeAnimationOptions = { duration: c.ms, easing: "linear", fill: "none" };
    this.curve = c;
    this.anims.push(this.pill.animate(c.xs.map((x) => ({ transform: `translate3d(${x.toFixed(2)}px,0,0)` })), timing));
    if (c.sx.some((s) => s !== 1)) {
      this.anims.push(this.lens.animate(c.sx.map((s, k) => ({ transform: `scale(${s.toFixed(4)},${c.sy[k].toFixed(4)})` })), timing));
    }
    for (let i = 0; i < this.items.length; i++) {
      const ops = c.xs.map((x) => this.inkOpacity(x, i));
      if (ops.every((o) => Math.abs(o - ops[0]) < 0.001)) continue; // this label doesn't change: no animation
      const on = this.on[i], base = this.base[i];
      if (on) this.anims.push(on.animate(ops.map((o) => ({ opacity: o.toFixed(3) })), timing));
      if (base) this.anims.push(base.animate(ops.map((o) => ({ opacity: (1 - o).toFixed(3) })), timing));
    }
    this.root.classList.add("is-moving");
    this.anims[0].finished.then(() => {
      if (this.gen !== g) return;
      this.anims = []; this.curve = null;
      this.root.classList.remove("is-moving");
      this.settled();
    }, () => { /* cancelled by a retarget: the new animation settles instead */ });
  }

  private settled() { if (this.pendingMode === "settle") this.flush(); }

  private indexAt(target: EventTarget | null) {
    return this.items.findIndex((o) => target instanceof Node && o.contains(target));
  }

  private onDown = (e: PointerEvent) => {
    if (e.button > 0) return;
    const i = this.indexAt(e.target);
    if (i < 0) return;
    this.pressed = this.items[i]; this.pressed.classList.add("is-pressed");
    const onPill = i === this.index;
    if (onPill) this.root.classList.add("is-pressing-current");
    this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: 0, active: false, armed: onPill, samples: [] };
    this.root.addEventListener("pointermove", this.onMove);
    this.root.addEventListener("pointerup", this.onUp);
    this.root.addEventListener("pointercancel", this.onUp);
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.active) {
      if (!d.armed) return;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { d.armed = false; return; }
      if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      d.active = true;
      this.root.setPointerCapture(d.id);
      const cur = this.now();           // pick the pill up where it is, even mid-flight
      this.stop(); this.gen++;
      d.px = cur.x - dx;                // so the first frame doesn't jump
      this.dragX = cur.x;
      this.root.classList.add("is-dragging");
    }
    const raw = d.px + dx, lo = this.xs[0], hi = this.xs[this.xs.length - 1], w = this.w;
    const reduced = reducedMotion(this.root);
    const rubber = (o: number) => (reduced ? 0 : (1 - 1 / ((o * RUBBER) / w + 1)) * w * 0.35);
    this.dragX = raw < lo ? lo - rubber(lo - raw) : raw > hi ? hi + rubber(raw - hi) : raw;
    const t = e.timeStamp; d.samples.push({ t, x: raw });
    while (d.samples.length > 2 && t - d.samples[0].t > 100) d.samples.shift();
    const s0 = d.samples[0], dt = (t - s0.t) / 1000, v = dt > 0 ? (raw - s0.x) / dt : 0;
    this.dragSx = reduced ? 1 : 1 + Math.min(0.12, Math.abs(v) / 6000);
    if (!this.dragRaf) this.dragRaf = requestAnimationFrame(this.dragFrame); // coalesce to one write per frame
    e.preventDefault();
  };

  private dragFrame = () => {
    this.dragRaf = 0;
    if (!this.drag?.active) return;
    this.write(this.dragX, this.dragSx, 1 - (this.dragSx - 1) * 0.45);
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    this.pressed?.classList.remove("is-pressed");
    this.root.classList.remove("is-pressing-current", "is-dragging");
    this.root.removeEventListener("pointermove", this.onMove);
    this.root.removeEventListener("pointerup", this.onUp);
    this.root.removeEventListener("pointercancel", this.onUp);
    cancelAnimationFrame(this.dragRaf); this.dragRaf = 0;
    if (!d.active) { this.drag = null; return; }
    if (this.root.hasPointerCapture(d.id)) this.root.releasePointerCapture(d.id);
    const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1];
    const dt = s1 && s0 ? (s1.t - s0.t) / 1000 : 0, v = dt > 0.008 ? (s1.x - s0.x) / dt : 0;
    const projected = this.dragX + v * PROJECT_S;
    let best = this.index, bestD = Infinity;
    this.xs.forEach((x, i) => { if (isDisabled(this.items[i])) return; const dd = Math.abs(x - projected); if (dd < bestD) { bestD = dd; best = i; } });
    this.suppressClick = true;
    const vel = clamp(v, -2500, 2500);
    this.select(best, { velocity: vel }); // play() starts from dragX while this.drag is still set
    this.drag = null;
  };

  private onClick = (e: MouseEvent) => {
    if (this.suppressClick) { this.suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    const i = this.indexAt(e.target);
    if (i >= 0 && !isDisabled(this.items[i])) this.select(i);
  };

  private onKey = (e: KeyboardEvent) => {
    const n = this.items.length;
    const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let step = steps[e.key], i = this.index;
    const edge = e.key === "Home" || e.key === "End";
    if (e.key === "Home") { i = -1; step = 1; } else if (e.key === "End") { i = n; step = -1; } else if (!step) return;
    e.preventDefault();
    for (let tries = 0; tries < n; tries++) {
      i = edge ? i + step : (i + step + n) % n;
      if (i >= 0 && i < n && !isDisabled(this.items[i])) break;
    }
    if (i < 0 || i >= n || isDisabled(this.items[i])) return;
    this.items[i].focus({ preventScroll: true });
    this.select(i, { commit: "frame" }); // the focused radio must read as checked straight away
  };

  /** Test / capture hook: pause every running animation at t ms. */
  freezeAt(ms: number) { for (const a of this.anims) { a.pause(); a.currentTime = ms; } }

  destroy() {
    this.stop(); cancelAnimationFrame(this.dragRaf); this.ro.disconnect();
    this.root.removeEventListener("pointerdown", this.onDown);
    this.root.removeEventListener("click", this.onClick, true);
    this.root.removeEventListener("keydown", this.onKey);
    this.root.classList.remove("lq-ready", "is-moving");
  }
}
