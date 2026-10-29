import { describe, it, expect } from "vitest";
import { World, palm, STEP } from "../src/game/engine";
import { demoSequence, asPalms } from "../src/game/demo";
import { JoinGate, parseReaction } from "../src/twitch/eventsub";
const advance = (w: World, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) w.step(STEP);
};
const rescue = (w: World, name: string) => {
  w.setHands([palm("a", 400, 330)]);
  w.spawn(name);
  advance(w, 1);
  w.setHands([palm("a", w.portal.x, w.portal.y + 18)]);
  advance(w, 0.05);
};
describe("Scores and rescue streaks", () => {
  it("awards the first catch, first handoff and rescue through actual physics", () => {
    const w = new World();
    w.setHands(asPalms(demoSequence(w, 0)));
    w.spawn("noodleboy");
    for (let i = 0; i < 900; i++) {
      w.setHands(asPalms(demoSequence(w, i * STEP)));
      w.step();
    }
    expect(w.saved).toBe(1);
    expect(w.transfers).toBe(1);
    expect(w.score).toBe(135);
  });
  it("does not farm points by dropping and recatching the same visitor", () => {
    const w = new World();
    w.setHands([palm("a", 400, 330)]);
    w.spawn("alice");
    advance(w, 1);
    expect(w.score).toBe(10);
    w.setHands([]);
    advance(w, 0.1);
    w.setHands([palm("a", 400, 500)]);
    advance(w, 0.8);
    expect(w.catches).toBe(2);
    expect(w.score).toBe(10);
  });
  it("increases the rescue multiplier and resets it on a miss", () => {
    const w = new World();
    for (let i = 0; i < 6; i++) rescue(w, `v${i}`);
    expect(w.saved).toBe(6);
    expect(w.streak).toBe(6);
    expect(w.multiplier).toBe(3);
    expect(w.score).toBe(1160);
    w.setHands([]);
    w.spawn("missed");
    advance(w, 3);
    expect(w.streak).toBe(0);
    expect(w.multiplier).toBe(1);
    expect(w.bestStreak).toBe(6);
  });
});
describe("Timed rescue runs", () => {
  it("uses active elapsed time, freezes results at sixty seconds and rejects later arrivals", () => {
    const w = new World();
    w.setHands([palm("a", 400, 330)]);
    w.startChallenge();
    w.advanceChallenge(0.1);
    advance(w, 1);
    expect(w.score).toBe(10);
    w.advanceChallenge(59.9);
    expect(w.challenge.status).toBe("finished");
    const state = JSON.stringify(w.visitors);
    w.step();
    expect(JSON.stringify(w.visitors)).toBe(state);
    expect(w.spawn("late")).toBe(false);
    w.startChallenge(false);
    expect(w.score).toBe(0);
    expect(w.challenge.remaining).toBe(60);
    expect(w.challenge.status).toBe("active");
  });
  it("only creates practice arrivals when selected and a palm is present", () => {
    const w = new World();
    w.startChallenge();
    w.advanceChallenge(1);
    expect(w.total).toBe(0);
    w.setHands([palm("a", 400, 330)]);
    w.advanceChallenge(0.1);
    expect(w.total).toBe(1);
    w.advanceChallenge(2);
    expect(w.total).toBe(1);
    w.advanceChallenge(1.1);
    expect(w.total).toBe(2);
    w.startChallenge(false);
    w.advanceChallenge(5);
    expect(w.total).toBe(0);
    expect(w.spawn("real-viewer", "123")).toBe(true);
  });
  it("does not advance without a clock tick or on invalid elapsed time", () => {
    const w = new World();
    w.startChallenge();
    advance(w, 2);
    expect(w.challenge.remaining).toBe(60);
    w.advanceChallenge(NaN);
    w.advanceChallenge(-10);
    expect(w.challenge.remaining).toBe(60);
  });
});
describe("Viewer reactions", () => {
  it("only accepts the three exact commands associated with a Twitch user", () => {
    expect(
      parseReaction({ chatter_user_id: "42", message: { text: "!HEART " } }),
    ).toEqual({ id: "42", reaction: "heart" });
    expect(
      parseReaction({ chatter_user_id: "42", message: { text: "hey !wave" } }),
    ).toBeNull();
    expect(
      parseReaction({
        chatter_user_id: "42",
        message: { text: "!spin extra" },
      }),
    ).toBeNull();
    expect(parseReaction({ message: { text: "!wave" } })).toBeNull();
  });
  it("animates only an active viewer and enforces a two-second reaction cooldown", () => {
    const w = new World();
    w.setHands([palm("a", 400, 330)]);
    w.spawn("alice", "a");
    expect(w.react("unknown", "wave")).toBe(false);
    expect(w.react("a", "heart")).toBe(true);
    expect(w.react("a", "spin")).toBe(false);
    advance(w, 2.1);
    expect(w.react("a", "wave")).toBe(true);
    expect(w.score).toBe(10);
    const gate = new JoinGate(2000);
    expect(gate.accept("1", "a", 0)).toBe(true);
    expect(gate.accept("2", "a", 1900)).toBe(false);
    expect(gate.accept("1", "a", 3000)).toBe(false);
    expect(gate.accept("3", "a", 2100)).toBe(true);
  });
});
