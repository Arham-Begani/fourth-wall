import { test, expect } from "@playwright/test";

// Synthetic landmarks exercise the actual CameraTracker -> PalmTracker ->
// Stage -> physics path. The separate real-model test covers neural inference.
test("camera input catches, hands off, carries and rescues without switching to rehearsal", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const fixture = window as unknown as {
      phase: string;
      carryStarted: number;
    };
    fixture.phase = "catch";
    fixture.carryStarted = 0;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      ctx.fillStyle = "#263a32";
      ctx.fillRect(0, 0, 640, 360);
      requestAnimationFrame(draw);
    };
    draw();
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(30);
    class FixtureWorker {
      onmessage?: (event: { data: unknown }) => void;
      count = 0;
      postMessage(message: {
        type: string;
        frame?: ImageBitmap;
        time: number;
      }) {
        if (message.type === "init") {
          queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } }));
          return;
        }
        message.frame?.close();
        const points = (x: number, y: number) =>
          Array.from({ length: 21 }, (_, i) => ({
            x: 1 - (x + (i === 5 ? -45 : i === 17 ? 45 : 0)) / 1280,
            y: (y + (i === 0 ? 60 : -20)) / 720,
          }));
        const progress =
          fixture.phase === "carry"
            ? Math.min(1, (performance.now() - fixture.carryStarted) / 1800)
            : 0;
        const landmarks = [points(400, 300)];
        const handedness = [{ categoryName: "Left", score: 0.99 }];
        if (fixture.phase !== "catch") {
          landmarks.push(points(420 + progress * 705, 345 - progress * 89));
          handedness.push({ categoryName: "Right", score: 0.99 });
        }
        // Model order is not stable. Reversing it must not change ownership.
        if (++this.count % 2 === 0) {
          landmarks.reverse();
          handedness.reverse();
        }
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                type: "result",
                landmarks,
                handedness,
                latency: 10,
                time: message.time,
              },
            }),
          10,
        );
      }
      terminate() {
        this.onmessage = undefined;
      }
    }
    window.Worker = FixtureWorker as unknown as typeof Worker;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Your camera", exact: true }).click();
  await expect(page.getByTestId("camera-coach")).toContainText(
    "One palm found",
  );
  await page.getByRole("button", { name: "Drop a test viewer" }).click();
  await expect(page.getByTestId("caught-count")).toHaveText("01");
  await page.evaluate(() => {
    (window as unknown as { phase: string }).phase = "receive";
  });
  await expect(page.getByTestId("camera-coach")).toContainText(
    "Both palms found",
  );
  await expect(page.getByTestId("handoff-count")).toHaveText("01");
  await page.waitForTimeout(900);
  await expect(page.getByTestId("handoff-count")).toHaveText("01");
  await page.evaluate(() => {
    const fixture = window as unknown as {
      phase: string;
      carryStarted: number;
    };
    fixture.phase = "carry";
    fixture.carryStarted = performance.now();
  });
  await expect(page.getByTestId("saved-count")).toHaveText("01");
  await expect(page.locator(".stage-label")).toContainText("YOUR CAMERA");
  await expect(
    page.locator(".session-line").filter({ hasText: "Missed arrivals" }),
  ).toContainText("0");
  await page.getByRole("button", { name: "Demo hands", exact: true }).click();
});
