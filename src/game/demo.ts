import { palm } from "./engine";
import type { World } from "./engine";
export type DemoHand = { x: number; y: number; tilt: number };
export const initialHands = (): DemoHand[] => [
  { x: 420, y: 355, tilt: -0.04 },
  { x: 785, y: 500, tilt: -0.06 },
];
const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * Math.min(1, Math.max(0, t));
export function demoSequence(world: World, time: number): DemoHand[] {
  // The rehearsal drives only input surfaces. Catches, handoffs and rescues are real physics outcomes.
  const a = { x: 440, y: 330, tilt: 0 },
    b = { x: 440, y: 510, tilt: 0 };
  if (time > 1.8 && time < 2.8) a.tilt = 1.1;
  if (time >= 2.8) {
    a.x = lerp(440, 260, (time - 2.8) / 0.8);
    a.y = 350;
  }
  if (world.transfers > 0 && time > 3.2) {
    const t = (time - 3.2) / 3.2;
    b.x = lerp(440, world.portal.x, t);
    b.y = lerp(510, world.portal.y + 18, t);
  }
  return [a, b];
}
export const asPalms = (hands: DemoHand[]) =>
  hands.map((h, i) => palm(`hand-${i}`, h.x, h.y, h.tilt));
