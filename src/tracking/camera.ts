import { mapLandmarks, PalmTracker } from "./palms";
import type { Landmark } from "./palms";
import type { Palm } from "../game/engine";
export class CameraTracker {
  video = document.createElement("video");
  private stream?: MediaStream;
  private worker?: Worker;
  private palms = new PalmTracker();
  private frame = 0;
  private busy = false;
  private disposed = false;
  private lastFrame = -1;
  private lastSent = 0;
  latency = 0;
  onError?: (message: string) => void;
  async start() {
    this.video.muted = true;
    this.video.playsInline = true;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: "user",
      },
      audio: false,
    });
    if (this.disposed) {
      this.stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    if (this.disposed) return;
    // MediaPipe's WASM loader uses importScripts and requires a classic worker.
    this.worker = new Worker("/tracking.worker.js");
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () =>
          reject(
            new Error(
              "Hand tracking took too long to load. Check your connection and try again.",
            ),
          ),
        45000,
      );
      this.worker!.onmessage = (event) => {
        if (event.data.type === "ready") {
          clearTimeout(timer);
          resolve();
        } else if (event.data.type === "error") {
          clearTimeout(timer);
          reject(new Error(event.data.message));
        }
      };
      this.worker!.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            "This browser could not start hand tracking. Try the latest Chrome or Edge.",
          ),
        );
      };
      this.worker!.postMessage({
        type: "init",
        origin: window.location.origin,
      });
    });
    if (this.disposed) return;
    this.worker.onmessage = (event) => {
      this.busy = false;
      if (event.data.type === "result") {
        this.latency = event.data.latency;
        this.palms.update(
          (event.data.landmarks as Landmark[][]).map((p) =>
            mapLandmarks(p, this.video.videoWidth, this.video.videoHeight),
          ),
          performance.now(),
          this.maxTrackAge,
        );
      } else if (event.data.type === "error") {
        this.stop();
        this.onError?.(
          "Hand tracking stopped. Restart the camera to reconnect.",
        );
      }
    };
    this.worker.onerror = () => {
      this.stop();
      this.onError?.("Hand tracking stopped. Restart the camera to reconnect.");
    };
    this.stream.getVideoTracks()[0].onended = () => {
      this.stop();
      this.onError?.(
        "Your camera was disconnected. Reconnect it and try again.",
      );
    };
    this.tick();
  }
  private tick = async () => {
    if (this.disposed) return;
    const now = performance.now();
    if (
      !this.busy &&
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastFrame &&
      now - this.lastSent > 40
    ) {
      this.busy = true;
      this.lastFrame = this.video.currentTime;
      this.lastSent = now;
      try {
        const width = Math.min(640, this.video.videoWidth);
        const frame = await createImageBitmap(this.video, {
          resizeWidth: width,
          resizeHeight: Math.round(
            (width * this.video.videoHeight) / this.video.videoWidth,
          ),
        });
        if (this.disposed) frame.close();
        else
          this.worker?.postMessage({ type: "frame", frame, time: now }, [
            frame,
          ]);
      } catch {
        this.busy = false;
      }
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  // Keep support continuous between slow inference results, with a bounded stale window.
  private get maxTrackAge() {
    return Math.min(1200, Math.max(250, this.latency * 2 + 100));
  }
  getHands(): Palm[] {
    return this.palms.current(performance.now(), this.maxTrackAge);
  }
  stop() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.worker?.terminate();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.palms.clear();
  }
}
