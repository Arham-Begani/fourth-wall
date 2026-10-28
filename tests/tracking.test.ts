import { describe, it, expect } from "vitest";
import {
  mapLandmarks,
  landmarksToPalm,
  PalmTracker,
} from "../src/tracking/palms";
const points = (x: number) =>
  Array.from({ length: 21 }, (_, i) => ({
    x: x + (i === 5 ? -45 : i === 17 ? 45 : 0),
    y: i === 0 ? 400 : 320,
  }));
describe("Camera coordinates and tracking continuity", () => {
  it("mirrors camera coordinates exactly once", () => {
    expect(mapLandmarks([{ x: 0.25, y: 0.5 }])[0]).toEqual({ x: 960, y: 360 });
  });
  it("matches letterboxed 4:3 video to the 16:9 stage", () => {
    expect(mapLandmarks([{ x: 0, y: 0 }], 640, 480)[0]).toEqual({
      x: 1120,
      y: 0,
    });
  });
  it("creates a stable support from visible knuckles", () => {
    const h = landmarksToPalm(points(400), "a")!;
    expect(h.a.x).toBeLessThan(h.b.x);
    expect(h.a.y).toBe(h.b.y);
  });
  it("rejects missing and non-finite landmark data", () => {
    expect(landmarksToPalm([], "a")).toBeNull();
    const p = points(300);
    p[0].x = NaN;
    expect(landmarksToPalm(p, "a")).toBeNull();
  });
  it("keeps hand IDs when detection order changes", () => {
    const t = new PalmTracker();
    const first = t.update([points(300), points(900)], 0);
    const left = first.find((h) => h.a.x < 500)!.id;
    const next = t.update([points(900), points(300)], 40);
    expect(next.find((h) => h.a.x < 500)!.id).toBe(left);
  });
  it("bridges a brief detection gap but releases after 250 ms", () => {
    const t = new PalmTracker();
    t.update([points(300)], 0);
    expect(t.current(200)).toHaveLength(1);
    expect(t.current(251)).toHaveLength(0);
  });
  it("smooths small landmark jitter", () => {
    const t = new PalmTracker();
    const first = t.update([points(300)], 0)[0];
    const next = t.update([points(310)], 33)[0];
    expect(next.a.x - first.a.x).toBeGreaterThan(0);
    expect(next.a.x - first.a.x).toBeLessThan(10);
  });
  it("bridges slow inference without retaining a lost hand indefinitely", () => {
    const t = new PalmTracker();
    const id = t.update([points(300)], 0, 1200)[0].id;
    expect(t.current(600, 1200)).toHaveLength(1);
    expect(t.update([points(310)], 650, 1200)[0].id).toBe(id);
    expect(t.current(1851, 1200)).toHaveLength(0);
  });
});
