import { mapLandmarks, PalmTracker } from "./palms";
import type { Landmark, HandLabel } from "./palms";
import { clamp } from "../game/engine";
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
  private cancelLoading?: () => void;
  private fallingBack = false;
  private slowGpuFrames = 0;
  latency = 0;
  inference = 0;
  backend: "GPU" | "CPU" = "CPU";
  private frameWidth = 640;
  private get retention() {
    return clamp(this.latency * 2.5 + 150, 500, 2500);
  }
  onError?: (message: string) => void;
  async start() {
    this.video.muted = true;
    this.video.playsInline = true;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 30, max: 30 },
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
    try {
      await this.loadWorker("GPU");
    } catch (error) {
      if (this.disposed) throw error;
      // Release the failed GPU context and WASM heap before trying CPU.
      await this.loadWorker("CPU");
    }
    if (this.disposed) return;
    this.stream.getVideoTracks()[0].onended = () => {
      this.stop();
      this.onError?.(
        "Your camera was disconnected. Reconnect it and try again.",
      );
    };
    this.tick();
  }
  private async loadWorker(delegate: "GPU" | "CPU") {
    this.worker?.terminate();
    // MediaPipe's WASM loader requires a classic worker. A versioned URL also
    // prevents an old cached worker from speaking a different protocol.
    const worker = new Worker("/tracking.worker.js?v=0.2.2");
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelLoading = undefined;
        if (error) reject(error);
        else resolve();
      };
      const timer = window.setTimeout(
        () =>
          finish(
            new Error(
              "Hand tracking took too long to load. Check your connection and try again.",
            ),
          ),
        delegate === "GPU" ? 15000 : 45000,
      );
      this.cancelLoading = () => finish(new Error("Camera stopped."));
      worker.onmessage = (event) => {
        if (event.data.type === "ready") {
          this.backend = delegate;
          finish();
        } else if (event.data.type === "error") {
          finish(
            new Error(event.data.message ?? "Hand tracking could not start."),
          );
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        finish(new Error("This browser could not start hand tracking."));
      };
      worker.postMessage({
        type: "init",
        origin: window.location.origin,
        delegate,
      });
    });
    if (this.disposed) return;
    worker.onmessage = (event) => {
      if (this.disposed || this.worker !== worker) return;
      this.busy = false;
      if (event.data.type === "result") {
        this.latency = performance.now() - this.lastSent;
        this.inference = event.data.latency;
        this.slowGpuFrames = this.inference > 250 ? this.slowGpuFrames + 1 : 0;
        // Reduce capture/transfer work under load; never queue obsolete frames.
        if (this.backend === "CPU" && this.latency > 180) this.frameWidth = 480;
        else if (this.latency < 100) this.frameWidth = 640;
        this.palms.update(
          (event.data.landmarks as Landmark[][]).map((p) =>
            mapLandmarks(p, this.video.videoWidth, this.video.videoHeight),
          ),
          performance.now(),
          this.retention,
          event.data.handedness as (HandLabel | undefined)[],
        );
        if (this.backend === "GPU" && this.slowGpuFrames >= 3)
          void this.recoverWorker();
      } else if (event.data.type === "error") {
        void this.recoverWorker();
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (this.disposed || this.worker !== worker) return;
      void this.recoverWorker();
    };
  }
  private async recoverWorker() {
    if (this.disposed || this.fallingBack) return;
    if (this.backend === "GPU") {
      this.fallingBack = true;
      this.busy = true;
      try {
        await this.loadWorker("CPU");
        this.busy = false;
        this.fallingBack = false;
        return;
      } catch {
        /* Present a recoverable error if both backends fail. */
      }
    }
    if (this.disposed) return;
    this.stop();
    this.onError?.("Hand tracking stopped. Restart the camera to reconnect.");
  }
  private tick = async () => {
    if (this.disposed) return;
    const now = performance.now();
    if (
      !this.busy &&
      !document.hidden &&
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastFrame &&
      (typeof this.video.requestVideoFrameCallback === "function" ||
        now - this.lastSent >= 32)
    ) {
      this.busy = true;
      this.lastFrame = this.video.currentTime;
      this.lastSent = now;
      try {
        const width = Math.min(this.frameWidth, this.video.videoWidth);
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
    this.frame = this.video.requestVideoFrameCallback
      ? this.video.requestVideoFrameCallback(this.tick)
      : requestAnimationFrame(this.tick);
  };
  getHands(): Palm[] {
    // An in-flight frame is not evidence of a missing hand. Give the complete
    // capture/inference round trip time to finish, but never retain stalled input.
    return this.palms.current(
      performance.now(),
      this.busy ? 3000 : this.retention,
    );
  }
  stop() {
    this.disposed = true;
    this.cancelLoading?.();
    if (this.video.cancelVideoFrameCallback)
      this.video.cancelVideoFrameCallback(this.frame);
    else cancelAnimationFrame(this.frame);
    this.worker?.terminate();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.palms.clear();
  }
}
