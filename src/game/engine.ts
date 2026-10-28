export const WIDTH = 1280;
export const HEIGHT = 720;
export const STEP = 1 / 120;
export type Point = { x: number; y: number };
export type Palm = { id: string; a: Point; b: Point; confidence: number; landmarks?: Point[]; source: 'camera' | 'demo' };
export type Visitor = { id: string; name: string; color: string; x: number; y: number; vx: number; vy: number; radius: number; hand: string | null; lastHand: string | null; offset: number; age: number; squash: number; caught: boolean };
export type GameEvent = { type: 'join' | 'catch' | 'transfer' | 'save' | 'lost'; name: string; x: number; y: number; color: string; time: number };
export type Spark = Point & { vx: number; vy: number; life: number; maxLife: number; color: string };
export const COLORS = ['#c9f66b', '#b3a0ff', '#ffb68d', '#81dbdf', '#ed9cbb', '#ffe38a'];
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const center = (hand: Palm) => ({ x: (hand.a.x + hand.b.x) / 2, y: (hand.a.y + hand.b.y) / 2 });
export const surfaceY = (hand: Palm, x: number) => hand.a.y + (hand.b.y - hand.a.y) * (x - hand.a.x) / Math.max(1, hand.b.x - hand.a.x);
export function palm(id: string, x: number, y: number, tilt = 0, width = 190): Palm {
  return { id, a: { x: x - width / 2, y: y - tilt * width / 2 }, b: { x: x + width / 2, y: y + tilt * width / 2 }, confidence: 1, source: 'demo' };
}

export class World {
  visitors: Visitor[] = [];
  hands: Palm[] = [];
  previousHands = new Map<string, Palm>();
  particles: Spark[] = [];
  events: GameEvent[] = [];
  time = 0;
  catches = 0;
  transfers = 0;
  saved = 0;
  missed = 0;
  total = 0;
  portal = { x: 1125, y: 238, radius: 55 };
  onEvent?: (event: GameEvent) => void;
  private sequence = 0;

  setHands(hands: Palm[]) {
    this.hands = hands.filter(h => Number.isFinite(h.a.x + h.a.y + h.b.x + h.b.y) && h.confidence > .35 && h.b.x - h.a.x > 30).slice(0, 2);
  }

  spawn(name: string, id?: string, x?: number, color?: string) {
    const key = id ?? `demo-${++this.sequence}`;
    if (this.visitors.length >= 48 || this.visitors.some(v => v.id === key)) return false;
    const safeName = name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 24) || 'visitor';
    const p = this.hands[0] ? center(this.hands[0]) : { x: 440, y: 400 };
    const visitor: Visitor = { id: key, name: safeName, color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : COLORS[this.total % COLORS.length], x: clamp(x ?? p.x, 35, WIDTH - 35), y: 54, vx: 0, vy: 0, radius: 18, hand: null, lastHand: null, offset: 0, age: 0, squash: 0, caught: false };
    this.visitors.push(visitor);
    this.total++;
    this.emit('join', visitor);
    return true;
  }

  reset() {
    this.visitors = []; this.particles = []; this.events = [];
    this.catches = this.transfers = this.saved = this.missed = this.total = 0;
    this.previousHands.clear(); this.time = 0;
  }

  private emit(type: GameEvent['type'], visitor: Visitor) {
    const event = { type, name: visitor.name, x: visitor.x, y: visitor.y, color: visitor.color, time: this.time };
    this.events.unshift(event); this.events = this.events.slice(0, 30);
    if (type !== 'join' && type !== 'lost') {
      const count = type === 'save' ? 32 : 12;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const speed = 45 + (i % 5) * 24;
        this.particles.push({ x: visitor.x, y: visitor.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80, life: .65 + (i % 3) * .2, maxLife: 1.05, color: visitor.color });
      }
    }
    this.onEvent?.(event);
  }

  step(dt = STEP) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    const alive: Visitor[] = [];
    for (const v of this.visitors) {
      v.age += dt; v.squash = Math.max(0, v.squash - dt * 3);
      const previousX = v.x, previousY = v.y;
      if (v.hand) {
        const support = this.hands.find(h => h.id === v.hand);
        const old = this.previousHands.get(v.hand);
        if (support) {
          const c = center(support);
          const slope = (support.b.y - support.a.y) / (support.b.x - support.a.x);
          v.vx += slope * 720 * dt;
          v.vx *= Math.exp(-3.8 * dt);
          v.offset += v.vx * dt;
          v.x = c.x + v.offset;
          v.y = surfaceY(support, v.x) - v.radius;
          if (v.x < support.a.x + 3 || v.x > support.b.x - 3 || Math.abs(slope) > .85) {
            v.hand = null;
            v.vy = 40;
            if (old) v.vx += clamp((c.x - center(old).x) / dt, -250, 250);
          }
        } else { v.hand = null; v.vy = 0; }
      }
      if (!v.hand) {
        v.vy = Math.min(1000, v.vy + 690 * dt);
        v.x += v.vx * dt; v.y += v.vy * dt;
        v.vx *= Math.exp(-.2 * dt);
        if (v.x < v.radius || v.x > WIDTH - v.radius) { v.x = clamp(v.x, v.radius, WIDTH - v.radius); v.vx *= -.5; }
        for (const h of this.hands) {
          const slope = (h.b.y - h.a.y) / (h.b.x - h.a.x);
          if (Math.abs(slope) > .85 || v.x < h.a.x || v.x > h.b.x) continue;
          const old = this.previousHands.get(h.id) ?? h;
          const motion = Math.hypot(center(h).x - center(old).x, center(h).y - center(old).y);
          const y = surfaceY(h, v.x);
          const oldY = motion < 120 ? surfaceY(old, previousX) : y;
          const before = previousY + v.radius - oldY;
          const after = v.y + v.radius - y;
          if (before <= 5 && after >= 0 && after > before && v.vy >= -20) {
            const transfer = v.lastHand !== null && v.lastHand !== h.id;
            v.hand = h.id; v.lastHand = h.id; v.offset = v.x - center(h).x;
            v.y = y - v.radius; v.vy = 0; v.vx *= .35; v.squash = .7;
            this.catches++; if (transfer) this.transfers++;
            v.caught = true; this.emit(transfer ? 'transfer' : 'catch', v);
            break;
          }
        }
      }
      if (v.caught && Math.hypot(v.x - this.portal.x, v.y - this.portal.y) < this.portal.radius) {
        this.saved++; this.emit('save', v); continue;
      }
      if (v.y > HEIGHT + 60 || v.age > 150) { this.missed++; this.emit('lost', v); continue; }
      alive.push(v);
    }
    // A little personal space makes a crowd legible without explosive pileups.
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (a.hand && a.hand === b.hand && Math.abs(a.offset - b.offset) < 34) {
        const direction = a.offset <= b.offset ? -1 : 1;
        a.offset += direction * 22 * dt; b.offset -= direction * 22 * dt;
      }
    }
    this.visitors = alive;
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; }
    this.particles = this.particles.filter(p => p.life > 0).slice(-500);
    this.previousHands = new Map(this.hands.map(h => [h.id, { ...h, a: { ...h.a }, b: { ...h.b } }]));
  }
}
