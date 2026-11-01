/// <reference lib="webworker" />
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let detector: HandLandmarker | null = null;
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  if (message.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks(
        `${message.origin}/vision`,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${message.origin}/models/hand_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.3,
      });
      self.postMessage({ type: "ready" });
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
      self.postMessage({
        type: "result",
        landmarks: result?.landmarks ?? [],
        handedness: result?.handedness.map((categories) => categories[0]) ?? [],
        latency: performance.now() - started,
        time: message.time,
      });
    } catch {
      self.postMessage({ type: "frame-error" });
    } finally {
      message.frame.close();
    }
  }
};
