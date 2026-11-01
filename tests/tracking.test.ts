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
  it("bridges one missed detection but releases after repeated negative evidence", () => {
    const t = new PalmTracker();
    t.update([points(300), points(900)], 0, 3000);
    const result = t.update([points(900)], 800, 3000);
    expect(result).toHaveLength(2);
    const remaining = t.update([points(900)], 1600, 3000);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].a.x).toBeGreaterThan(700);
    t.update([], 2400, 3000);
    expect(t.update([], 3200, 3000)).toHaveLength(0);
  });
  it("matches both moving hands without letting the first detection steal the other ID", () => {
    const t = new PalmTracker();
    const first = t.update([points(300), points(600)], 0, 2000);
    const ids = first.map((h) => h.id);
    const next = t.update([points(500), points(650)], 400, 2000);
    expect(next).toHaveLength(2);
    expect(next.find((h) => h.id === ids[0])!.a.x).toBeCloseTo(500 - 76.5, 0);
    expect(next.find((h) => h.id === ids[1])!.a.x).toBeCloseTo(650 - 76.5, 0);
  });
  it("uses confident handedness to preserve IDs when hands cross", () => {
    const t = new PalmTracker();
    const labels = [
      { categoryName: "Left", score: 0.99 },
      { categoryName: "Right", score: 0.99 },
    ];
    const first = t.update([points(400), points(600)], 0, 2000, labels);
    const next = t.update([points(550), points(450)], 500, 2000, labels);
    expect(next.find((h) => h.id === first[0].id)!.a.x).toBeGreaterThan(
      next.find((h) => h.id === first[1].id)!.a.x,
    );
  });
  it("admits a new second hand immediately even while a missing track occupies a slot", () => {
    const t = new PalmTracker();
    const first = t.update([points(300), points(1000)], 0, 2000);
    const next = t.update([points(300), points(600)], 80, 2000);
    expect(next).toHaveLength(2);
    expect(next.some((h) => h.id === first[0].id)).toBe(true);
    expect(next.some((h) => h.id === first[1].id)).toBe(false);
    expect(next.some((h) => h.a.x > 500 && h.a.x < 600)).toBe(true);
  });
  it("does not reuse an expired hand ID for a different palm", () => {
    const t = new PalmTracker();
    const first = t.update([points(300)], 0)[0].id;
    expect(t.update([points(900)], 2000)[0].id).not.toBe(first);
  });
  it("hides a stalled platform but preserves the same hand identity on recovery", () => {
    const t = new PalmTracker();
    const id = t.update([points(300)], 0, 500)[0].id;
    expect(t.current(900, 500)).toHaveLength(0);
    expect(t.update([points(310)], 1000, 500)[0].id).toBe(id);
    expect(t.update([points(310)], 8000, 500)[0].id).not.toBe(id);
  });
});
