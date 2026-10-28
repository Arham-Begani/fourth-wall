import { clamp, WIDTH, HEIGHT } from "../game/engine";
import type { Palm, Point } from "../game/engine";
export type Landmark = { x: number; y: number; z?: number };
export function mapLandmarks(
  points: Landmark[],
  videoWidth = WIDTH,
  videoHeight = HEIGHT,
): Point[] {
  const scale = Math.min(WIDTH / videoWidth, HEIGHT / videoHeight);
  const width = videoWidth * scale,
    height = videoHeight * scale;
  return points.map((p) => ({
    x: (1 - p.x) * width + (WIDTH - width) / 2,
    y: p.y * height + (HEIGHT - height) / 2,
  }));
}
export function landmarksToPalm(
  points: Point[],
  id: string,
  confidence = 1,
): Palm | null {
  if (points.length !== 21 || points.some((p) => !Number.isFinite(p.x + p.y)))
    return null;
  const left = points[5],
    right = points[17],
    wrist = points[0];
  const knuckles = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const c = {
    x: knuckles.x * 0.75 + wrist.x * 0.25,
    y: knuckles.y * 0.75 + wrist.y * 0.25,
  };
  const span = Math.hypot(left.x - right.x, left.y - right.y);
  if (span < 22) return null;
  // Extend the support slightly beyond the knuckles to make the camera interaction forgiving.
  const width = clamp(span * 1.7, 85, 270);
  const ordered = left.x < right.x ? [left, right] : [right, left];
  const slope = clamp(
    (ordered[1].y - ordered[0].y) / Math.max(20, ordered[1].x - ordered[0].x),
    -1.4,
    1.4,
  );
  return {
    id,
    a: { x: c.x - width / 2, y: c.y - (slope * width) / 2 },
    b: { x: c.x + width / 2, y: c.y + (slope * width) / 2 },
    confidence,
    landmarks: points,
    source: "camera",
  };
}

type Track = { palm: Palm; seen: number };
export class PalmTracker {
  tracks = new Map<string, Track>();
  update(detections: Point[][], now: number, maxAge = 250): Palm[] {
    const candidates = detections
      .map((p) => landmarksToPalm(p, ""))
      .filter((p): p is Palm => !!p)
      .slice(0, 2);
    const unused = new Set(this.tracks.keys());
    for (const candidate of candidates) {
      const cx = (candidate.a.x + candidate.b.x) / 2,
        cy = (candidate.a.y + candidate.b.y) / 2;
      let nearest: string | undefined,
        distance = 230;
      for (const id of unused) {
        const track = this.tracks.get(id)!;
        if (now - track.seen > maxAge) continue;
        const p = track.palm;
        const d = Math.hypot(
          cx - (p.a.x + p.b.x) / 2,
          cy - (p.a.y + p.b.y) / 2,
        );
        if (d < distance) {
          nearest = id;
          distance = d;
        }
      }
      let id = nearest;
      if (!id)
        id = ["hand-0", "hand-1"].find(
          (key) =>
            !this.tracks.has(key) ||
            (unused.has(key) && now - this.tracks.get(key)!.seen > maxAge),
        );
      if (!id) continue;
      const previous = this.tracks.get(id);
      candidate.id = id;
      if (previous && now - previous.seen < maxAge) {
        const alpha = 1 - Math.exp(-Math.max(8, now - previous.seen) / 42);
        for (const key of ["a", "b"] as const) {
          candidate[key].x =
            previous.palm[key].x +
            (candidate[key].x - previous.palm[key].x) * alpha;
          candidate[key].y =
            previous.palm[key].y +
            (candidate[key].y - previous.palm[key].y) * alpha;
        }
      }
      this.tracks.set(id, { palm: candidate, seen: now });
      unused.delete(id);
    }
    // A completed frame that no longer contains a hand is fresh negative evidence.
    // Release it promptly instead of applying the in-flight processing allowance.
    for (const id of unused) {
      const track = this.tracks.get(id);
      if (track && now - track.seen > 250) this.tracks.delete(id);
    }
    return this.current(now, maxAge);
  }
  current(now: number, maxAge = 250) {
    for (const [id, track] of this.tracks)
      if (now - track.seen > maxAge) this.tracks.delete(id);
    return [...this.tracks.values()].map((t) => t.palm);
  }
  clear() {
    this.tracks.clear();
  }
}
