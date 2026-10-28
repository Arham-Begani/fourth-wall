import { cp, mkdir, writeFile, stat } from "node:fs/promises";
await mkdir("public/vision", { recursive: true });
await mkdir("public/models", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/vision", {
  recursive: true,
});
const target = "public/models/hand_landmarker.task";
if (!(await stat(target).catch(() => null))) {
  const response = await fetch(
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  );
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}
console.log("Hand model and matching WASM runtime are available locally.");
