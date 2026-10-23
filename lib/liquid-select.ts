/* Afterflow v4.1g: LiquidSelect (TypeScript). Drop in as lib/liquid-select.ts. Same behaviour as mock-v41g/liquid-select.js.
   Writes transform + opacity only; measures on init and on ResizeObserver; will-change only while moving. */
export type LiquidOptions = { onPick?: (index: number, el: HTMLElement) => void };

const SPRING = { stiffness: 520, damping: 34, mass: 1 }; // ζ ≈ 0.745, ~3% overshoot, settles ≈ 340ms
const REDUCED_MS = 120;
const DRAG_SLOP = 6;
const PROJECT_S = 0.15;
const RUBBER = 0.55;
const H = 1 / 240;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const isSelected = (el: Element) => el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-current") === "page";
const isDisabled = (el: Element) => el.getAttribute("aria-disabled") === "true" || (el as HTMLButtonElement).disabled === true;
const reducedMotion = (el: Element) => matchMedia("(prefers-reduced-motion: reduce)").matches || !!el.closest("[data-sim-rm]");
function haptic() {
  // Android Chrome only; iOS Safari has no web vibration API.
  try { if ("vibrate" in navigator && /Android/i.test(navigator.userAgent)) navigator.vibrate(8); } catch { /* ignore */ }
}

type Drag = { id: number; sx: number; sy: number; px: number; active: boolean; armed: boolean; samples: { t: number; x: number }[] };

export class LiquidSelect {
  static freezeAt: number | null = null; // tests / frame capture only
  readonly root: HTMLElement;
  private pill: HTMLElement;
  private lens: HTMLElement;
  private items: HTMLElement[];
  private on: (HTMLElement | null)[];
  private base: (HTMLElement | null)[];
  private onPick: NonNullable<LiquidOptions["onPick"]>;
  private xs: number[] = [];
  private w = 1;
  index: number;
  private x = 0; private v = 0; private raf = 0;
  private from = 0; private to = 0; private t0 = 0; private sim = 0; private peak = 1;
  private reduced = false; private flick = false;
  private drag: Drag | null = null; private pressed: HTMLElement | null = null; private suppressClick = false;
  private ro: ResizeObserver;

  constructor(root: HTMLElement, options: LiquidOptions = {}) {
    this.root = root;
    this.onPick = options.onPick ?? (() => {});
    this.pill = root.querySelector<HTMLElement>(".lq-pill")!;
    this.lens = root.querySelector<HTMLElement>(".lq-lens")!;
    this.items = Array.from(root.querySelectorAll<HTMLElement>(".lq-opt"));
    this.on = this.items.map((o) => o.querySelector<HTMLElement>(".lq-on"));
    this.base = this.items.map((o) => o.querySelector<HTMLElement>(".lq-lbl:not(.lq-on)"));
    this.index = Math.max(0, this.items.findIndex(isSelected));
    this.measure();
    this.x = this.xs[this.index];
    this.render(1, 1);
    this.ro = new ResizeObserver(() => { this.measure(); if (!this.raf && !this.drag) { this.x = this.xs[this.index]; this.render(1, 1); } });
    this.ro.observe(root);
    root.addEventListener("pointerdown", this.onDown);
    root.addEventListener("click", this.onClick, true);
    if (root.getAttribute("role") === "radiogroup") root.addEventListener("keydown", this.onKey);
    root.classList.add("lq-ready");
  }

  measure() {
    this.xs = this.items.map((o) => o.offsetLeft);
    // Afterflow: a control measured while hidden (closed sheet, display:none) has no width yet;
    // keep w ≥ 1 so the maths stays finite until the ResizeObserver measures it for real.
    this.w = Math.max(1, this.items[0]?.offsetWidth ?? 1);
    this.pill.style.width = `${this.w}px`;
  }

  private render(sx: number, sy: number) {
    this.pill.style.transform = `translate3d(${this.x.toFixed(2)}px,0,0)`;
    this.lens.style.transform = sx === 1 && sy === 1 ? "" : `scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    for (let i = 0; i < this.items.length; i++) {
      const o = clamp(1 - Math.abs(this.x - this.xs[i]) / this.w, 0, 1);
      if (this.on[i]) this.on[i]!.style.opacity = o.toFixed(3);
      if (this.base[i]) this.base[i]!.style.opacity = (1 - o).toFixed(3);
    }
  }

  select(i: number, opts: { velocity?: number; commit?: boolean } = {}) {
    if (i < 0 || i >= this.items.length || isDisabled(this.items[i])) return;
    const changed = i !== this.index;
    this.index = i;
    this.animateTo(this.xs[i], opts.velocity ?? 0);
    if (changed && opts.commit !== false) { haptic(); this.onPick(i, this.items[i]); }
  }

  /** Call from useLayoutEffect after the owner changes the selection (route change, React state). */
  sync() {
    const i = this.items.findIndex(isSelected);
    if (i >= 0 && i !== this.index) { this.index = i; this.animateTo(this.xs[i], 0); }
  }

  private animateTo(to: number, v0: number) {
    cancelAnimationFrame(this.raf);
    this.from = this.x; this.to = to; this.v = v0; this.t0 = performance.now(); this.sim = 0;
    const d = Math.abs(to - this.from) / this.w;
    this.peak = d < 0.05 ? 1 : 1.12 + 0.06 * clamp((d - 1) / 2, 0, 1);
    this.reduced = reducedMotion(this.root);
    this.flick = Math.abs(v0) > 50;
    this.pill.style.willChange = "transform"; this.lens.style.willChange = "transform";
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const freeze = LiquidSelect.freezeAt;
    const elapsed = freeze ?? now - this.t0;
    let sx = 1, sy = 1, done: boolean;
    if (this.reduced) {
      const p = clamp(elapsed / REDUCED_MS, 0, 1), e = 1 - Math.pow(1 - p, 3);
      this.x = this.from + (this.to - this.from) * e; this.v = 0; done = p >= 1;
    } else {
      const { stiffness: k, damping: c, mass: m } = SPRING;
      while (this.sim < elapsed) {
        const a = (-k * (this.x - this.to) - c * this.v) / m;
        this.v += a * H; this.x += this.v * H; this.sim += H * 1000;
      }
      const span = Math.abs(this.to - this.from);
      const prog = span > 0.5 ? clamp(Math.abs(this.x - this.from) / span, 0, 1) : 1;
      const byDistance = 1 + (this.peak - 1) * Math.sin(Math.PI * prog);
      const byVelocity = this.flick ? 1 + Math.min(0.12, Math.abs(this.v) / 6000) : 1;
      sx = Math.max(byDistance, byVelocity);
      sy = 1 - (sx - 1) * 0.45;
      done = Math.abs(this.x - this.to) < 0.25 && Math.abs(this.v) < 8;
    }
    if (freeze != null) { this.render(sx, sy); this.raf = 0; return; }
    if (done) {
      this.x = this.to; this.v = 0; this.render(1, 1); this.raf = 0;
      this.pill.style.willChange = ""; this.lens.style.willChange = "";
      return;
    }
    this.render(sx, sy);
    this.raf = requestAnimationFrame(this.tick);
  };

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
    this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: this.x, active: false, armed: onPill, samples: [] };
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
      cancelAnimationFrame(this.raf); this.raf = 0; this.v = 0;
      this.root.classList.add("is-dragging");
      this.pill.style.willChange = "transform"; this.lens.style.willChange = "transform";
    }
    const raw = d.px + dx, lo = this.xs[0], hi = this.xs[this.xs.length - 1], w = this.w;
    const reduced = reducedMotion(this.root);
    const rubber = (o: number) => (reduced ? 0 : (1 - 1 / ((o * RUBBER) / w + 1)) * w * 0.35);
    this.x = raw < lo ? lo - rubber(lo - raw) : raw > hi ? hi + rubber(raw - hi) : raw;
    const t = e.timeStamp; d.samples.push({ t, x: raw });
    while (d.samples.length > 2 && t - d.samples[0].t > 100) d.samples.shift();
    const s0 = d.samples[0], dt = (t - s0.t) / 1000, v = dt > 0 ? (raw - s0.x) / dt : 0;
    const sx = reduced ? 1 : 1 + Math.min(0.12, Math.abs(v) / 6000);
    this.render(sx, 1 - (sx - 1) * 0.45);
    e.preventDefault();
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    this.pressed?.classList.remove("is-pressed");
    this.root.classList.remove("is-pressing-current", "is-dragging");
    this.root.removeEventListener("pointermove", this.onMove);
    this.root.removeEventListener("pointerup", this.onUp);
    this.root.removeEventListener("pointercancel", this.onUp);
    this.drag = null;
    if (!d.active) return;
    if (this.root.hasPointerCapture(d.id)) this.root.releasePointerCapture(d.id);
    const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1];
    const dt = s1 && s0 ? (s1.t - s0.t) / 1000 : 0, v = dt > 0.008 ? (s1.x - s0.x) / dt : 0;
    const projected = this.x + v * PROJECT_S;
    let best = this.index, bestD = Infinity;
    this.xs.forEach((x, i) => { if (isDisabled(this.items[i])) return; const dd = Math.abs(x - projected); if (dd < bestD) { bestD = dd; best = i; } });
    this.suppressClick = true;
    this.select(best, { velocity: clamp(v, -2500, 2500) });
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
    this.select(i);
  };

  destroy() {
    cancelAnimationFrame(this.raf); this.ro.disconnect();
    this.root.removeEventListener("pointerdown", this.onDown);
    this.root.removeEventListener("click", this.onClick, true);
    this.root.removeEventListener("keydown", this.onKey);
    this.root.classList.remove("lq-ready");
  }
}
