import { afterEach, expect, it, vi } from "vitest";
import { CameraTracker } from "../src/tracking/camera";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(failGpu = false) {
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
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    terminate = vi.fn();
    delegate?: string;
    messages: { type: string; delegate?: string }[] = [];
    postMessage(message: { type: string; delegate?: string }) {
      this.messages.push(message);
      if (message.type === "init")
        queueMicrotask(() => {
          this.delegate = message.delegate;
          this.onmessage?.({
            data: {
              type: failGpu && message.delegate === "GPU" ? "error" : "ready",
            },
          });
        });
    }
    constructor() {
      workers.push(this);
    }
  }
  vi.stubGlobal("Worker", FakeWorker);
  const tracker = new CameraTracker();
  return {
    tracker,
    video,
    track,
    callbacks,
    workers,
    setTime: (time: number) => {
      now = time;
    },
  };
}

it("keeps a palm when fast inference is followed by a slow frame, but expires a stalled worker", async () => {
  const { tracker, video, track, callbacks, workers, setTime } = setup();
  await tracker.start();
  const worker = workers[0];
  setTime(100);
  video.currentTime = 1;
  await callbacks.shift()!();
  const landmarks = Array.from({ length: 21 }, (_, i) => ({
    x: i === 5 ? 0.4 : i === 17 ? 0.6 : 0.5,
    y: i === 0 ? 0.7 : 0.5,
  }));
  setTime(180);
  worker!.onmessage!({
    data: {
      type: "result",
      landmarks: [landmarks],
      handedness: [],
      latency: 80,
    },
  });
  const id = tracker.getHands()[0].id;
  setTime(240);
  video.currentTime = 2;
  await callbacks.shift()!();
  setTime(1200);
  expect(tracker.getHands()[0]?.id).toBe(id);
  setTime(1400);
  worker!.onmessage!({
    data: {
      type: "result",
      landmarks: [landmarks],
      handedness: [],
      latency: 1160,
    },
  });
  expect(tracker.getHands()[0]?.id).toBe(id);
  setTime(1500);
  video.currentTime = 3;
  await callbacks.shift()!();
  setTime(4501);
  expect(tracker.getHands()).toHaveLength(0);
  tracker.stop();
  expect(track.stop).toHaveBeenCalled();
});

it("disposes an unavailable GPU worker before starting the CPU fallback", async () => {
  const { tracker, workers } = setup(true);
  await tracker.start();
  expect(workers.map((w) => w.delegate)).toEqual(["GPU", "CPU"]);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(tracker.backend).toBe("CPU");
  tracker.stop();
  expect(workers[1].terminate).toHaveBeenCalledOnce();
});

it("falls back once when the GPU runs slowly, without restarting the camera stream", async () => {
  const { tracker, workers, track } = setup();
  await tracker.start();
  for (let i = 0; i < 3; i++)
    workers[0].onmessage!({
      data: {
        type: "result",
        landmarks: [],
        handedness: [],
        latency: 600,
      },
    });
  await vi.waitFor(() => expect(tracker.backend).toBe("CPU"));
  expect(workers).toHaveLength(2);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  workers[0].onmessage!({ data: { type: "error" } });
  expect(track.stop).not.toHaveBeenCalled();
  tracker.stop();
});

it("never queues additional inference while a frame is still processing", async () => {
  const { tracker, video, workers, callbacks, setTime } = setup();
  await tracker.start();
  for (let i = 1; i <= 10; i++) {
    setTime(i * 50);
    video.currentTime = i;
    await callbacks.shift()!();
  }
  expect(workers[0].messages.filter((m) => m.type === "frame")).toHaveLength(1);
  tracker.stop();
});
