import { afterEach, expect, it, vi } from "vitest";
import { CameraTracker } from "../src/tracking/camera";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps a palm when fast inference is followed by a slow frame, but expires a stalled worker", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const callbacks: (() => Promise<void>)[] = [];
  const video = {
    muted: false,
    playsInline: false,
    srcObject: null,
    readyState: 2,
    currentTime: 0,
    videoWidth: 640,
    videoHeight: 360,
    play: async () => {},
  };
  const track = { stop: vi.fn(), onended: null };
  vi.stubGlobal("document", { hidden: false, createElement: () => video });
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [track],
        getVideoTracks: () => [track],
      }),
    },
  });
  vi.stubGlobal("window", {
    setTimeout,
    location: { origin: "http://localhost" },
  });
  vi.stubGlobal("requestAnimationFrame", (fn: () => Promise<void>) => {
    callbacks.push(fn);
    return callbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("createImageBitmap", async () => ({ close: vi.fn() }));
  let worker: FakeWorker;
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    terminate = vi.fn();
    postMessage(message: { type: string }) {
      if (message.type === "init")
        queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } }));
    }
    constructor() {
      worker = this;
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  const tracker = new CameraTracker();
  await tracker.start();
  now = 100;
  video.currentTime = 1;
  await callbacks.shift()!();
  const landmarks = Array.from({ length: 21 }, (_, i) => ({
    x: i === 5 ? 0.4 : i === 17 ? 0.6 : 0.5,
    y: i === 0 ? 0.7 : 0.5,
  }));
  now = 180;
  worker!.onmessage!({
    data: {
      type: "result",
      landmarks: [landmarks],
      handedness: [],
      latency: 80,
    },
  });
  const id = tracker.getHands()[0].id;
  now = 240;
  video.currentTime = 2;
  await callbacks.shift()!();
  now = 1200;
  expect(tracker.getHands()[0]?.id).toBe(id);
  now = 1400;
  worker!.onmessage!({
    data: {
      type: "result",
      landmarks: [landmarks],
      handedness: [],
      latency: 1160,
    },
  });
  expect(tracker.getHands()[0]?.id).toBe(id);
  now = 1500;
  video.currentTime = 3;
  await callbacks.shift()!();
  now = 4501;
  expect(tracker.getHands()).toHaveLength(0);
  tracker.stop();
  expect(track.stop).toHaveBeenCalled();
});
