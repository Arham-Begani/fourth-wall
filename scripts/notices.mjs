import { readFile, writeFile } from "node:fs/promises";
const parts = [
  "FOURTH WALL — THIRD-PARTY NOTICES\n\nRuntime assets are bundled from the pinned @mediapipe/tasks-vision package.\nHand model: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task\n",
];
for (const [name, file] of [
  [
    "Manrope (SIL Open Font License)",
    "node_modules/@fontsource-variable/manrope/LICENSE",
  ],
  [
    "IBM Plex Mono (SIL Open Font License)",
    "node_modules/@fontsource/ibm-plex-mono/LICENSE",
  ],
  ["Lucide (ISC)", "node_modules/lucide-react/LICENSE"],
  ["React (MIT)", "node_modules/react/LICENSE"],
  ["React DOM (MIT)", "node_modules/react-dom/LICENSE"],
]) {
  parts.push(`\n\n${name}\n${await readFile(file, "utf8")}`);
}
const response = await fetch(
  "https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE",
);
if (!response.ok) throw new Error("Cannot load MediaPipe license");
parts.push(
  `\n\nMediaPipe (Apache-2.0)\nCopyright Google LLC.\n${await response.text()}`,
);
await writeFile("public/THIRD_PARTY_NOTICES.txt", parts.join("\n"));
