/// <reference lib="webworker" />
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let detector: HandLandmarker | null = null;
let backend: "GPU" | "CPU" = "CPU";
let failures = 0;
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  if (message.type === "init") {
    try {
      backend = message.delegate ?? "GPU";
      let canvas: OffscreenCanvas | undefined;
      if (backend === "GPU") {
        canvas = new OffscreenCanvas(640, 480);
        const gl = canvas.getContext("webgl2");
        if (!gl) throw new Error("WebGL2 is unavailable.");
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = debug
          ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
          : "";
        // A software GL implementation runs neural-network shaders on the CPU
        // and can be much slower than MediaPipe's native WASM CPU delegate.
        if (/swiftshader|llvmpipe|software|basic render/i.test(renderer))
          throw new Error("Using the CPU delegate for software rendering.");
      }
      const files = await FilesetResolver.forVisionTasks(
        `${message.origin}/vision`,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${message.origin}/models/hand_landmarker.task`,
          delegate: backend,
        },
        ...(canvas ? { canvas } : {}),
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.35,
      });
      self.postMessage({ type: "ready", backend });
    } catch (error) {
      self.postMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not load hand tracking.",
      });
    }
  } else if (message.type === "frame") {
    try {
      const started = performance.now();
      const result = detector?.detectForVideo(message.frame, message.time);
      failures = 0;
      self.postMessage({
        type: "result",
        landmarks: result?.landmarks ?? [],
        handedness: result?.handedness.map((categories) => categories[0]) ?? [],
        latency: performance.now() - started,
        time: message.time,
        backend,
      });
    } catch {
      self.postMessage({ type: ++failures >= 3 ? "error" : "frame-error" });
    } finally {
      message.frame.close();
    }
  }
};
