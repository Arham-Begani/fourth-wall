import { clamp, WIDTH, HEIGHT } from "../game/engine";
import type { Palm, Point } from "../game/engine";
export type Landmark = { x: number; y: number; z?: number };
export type HandLabel = { categoryName: string; score: number };
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

type Track = { palm: Palm; seen: number; misses: number; label?: HandLabel };
export class PalmTracker {
  tracks = new Map<string, Track>();
  private sequence = 0;
  update(
    detections: Point[][],
    now: number,
    maxAge = 500,
    labels: (HandLabel | undefined)[] = [],
  ): Palm[] {
    this.current(now, maxAge);
    const candidates = detections
      .map((p, i) => ({ palm: landmarksToPalm(p, ""), label: labels[i] }))
      .filter(
        (p): p is { palm: Palm; label: HandLabel | undefined } => !!p.palm,
      )
      .slice(0, 2);
    const tracks = [...this.tracks.entries()];
    // Match both detections together. Greedy matching can let the first hand
    // steal the second hand's ID when the two palms move close to each other.
    let best: (string | undefined)[] = [];
    let bestMatches = -1,
      bestCost = Infinity;
    const match = (
      index: number,
      ids: (string | undefined)[],
      cost: number,
    ) => {
      if (index === candidates.length) {
        const count = ids.filter(Boolean).length;
        if (count > bestMatches || (count === bestMatches && cost < bestCost)) {
          best = [...ids];
          bestMatches = count;
          bestCost = cost;
        }
        return;
      }
      match(index + 1, [...ids, undefined], cost);
      const { palm: candidate, label } = candidates[index];
      for (const [id, track] of tracks) {
        if (ids.includes(id)) continue;
        const distance = Math.hypot(
          (candidate.a.x + candidate.b.x - track.palm.a.x - track.palm.b.x) / 2,
          (candidate.a.y + candidate.b.y - track.palm.a.y - track.palm.b.y) / 2,
        );
        const labeled =
          label && track.label && label.score > 0.8 && track.label.score > 0.8;
        const sameLabel =
          labeled && label.categoryName === track.label!.categoryName;
        const reach = clamp(120 + (now - track.seen) * 0.8, 180, 500);
        if (distance > reach + (sameLabel ? 120 : 0)) continue;
        match(
          index + 1,
          [...ids, id],
          cost + distance + (labeled && !sameLabel ? 200 : 0),
        );
      }
    };
    match(0, [], 0);
    const used = new Set(best.filter((id): id is string => !!id));
    for (const [id, track] of tracks) {
      if (used.has(id)) continue;
      track.misses++;
      // One bad frame is common under occlusion. Require repeated negative
      // evidence, while current() still bounds a stalled worker by wall time.
      if (track.misses >= 2 && now - track.seen >= 200) this.tracks.delete(id);
    }
    for (let i = 0; i < candidates.length; i++) {
      const { palm: candidate, label } = candidates[i];
      let id = best[i];
      if (!id) {
        // Fresh detections take priority over a retained, missing platform.
        if (this.tracks.size >= 2) {
          const missing = [...this.tracks].find(([key]) => !used.has(key));
          if (missing) this.tracks.delete(missing[0]);
        }
        id = `hand-${this.sequence++}`;
      }
      used.add(id);
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
      this.tracks.set(id, {
        palm: candidate,
        seen: now,
        misses: 0,
        label: label ?? previous?.label,
      });
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
