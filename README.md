# Fourth Wall

**Your chat. In your hands.**

A working prototype of a Twitch audience entering a streamer's webcam as little characters. Raise a palm, catch a viewer, tilt to release them into your other hand, and carry them into the safe zone.

Built from scratch with OpenAI Codex for the Codex x TwitchCon hackathon. This prototype implements palm catching and handoffs. Natural-language inventions and physics contraptions belong to the larger concept and are not implemented in this release.

## Play

Rehearsal starts immediately, without a camera or Twitch account. Select **Watch a handoff** for a complete sequence driven by the same physics engine as camera mode. Statistics are computed by collision detection; the sequence does not fake catches or rescues.

In rehearsal, drag either palm, or focus the stage and use the arrow keys. **1 / 2** select a hand; **Q / E** tilt it; **0** levels it. **D** drops a test visitor, and **Space** pauses. Carry a caught visitor into the green safe zone.

Select **Your camera** to load MediaPipe and start local tracking of up to two hands. Use good front lighting, face an open palm toward the camera, and keep the wrist and fingers visible. The glowing line is the collision surface. Tilt it steeply to release a visitor and position the other hand underneath. This is a 2D camera-plane interaction, not a full 3D room reconstruction.

## Run locally

Node.js 20.19+ or 22+ is recommended. Dependencies are locked in package-lock.json.

```sh
npm ci
npm run assets
npm run dev
```

The camera requires HTTPS or localhost. The camera model and matching WASM files are served from this app's origin. `npm run assets` reproduces those vendored runtime assets from the pinned MediaPipe package and Google's official model distribution.

```sh
npm test
npm run build
npm run test:fixtures
npx playwright install chromium
npm run test:browser
```

The browser test suite creates an isolated Chromium profile. It never accesses the developer's signed-in browser. Camera integration tests substitute an official MediaPipe two-hand photograph as a synthetic video stream, then run the real model and game code. This verifies model loading, inference, coordinate mapping and catches, but is not a substitute for a live human movement validation across different lighting and cameras.

## Twitch setup

1. Register a **Public** client application at https://dev.twitch.tv/console/apps.
2. Add the exact production root URL, with its trailing `/`, to OAuth redirect URLs. Add `http://localhost:5173/` for local development if needed.
3. Set `VITE_TWITCH_CLIENT_ID` in the deployment's environment and redeploy, or enter the public Client ID in the Connect Twitch dialog for this browser.
4. Select **Connect Twitch** and sign in as the broadcaster. The app requests only `user:read:chat`.
5. Viewers type exactly `!join` in that broadcaster's Twitch chat. A viewer can have one active character, with a ten-second per-user command cooldown. Intake is bounded to 32 waiting and 48 active viewers.

Uses Twitch's documented browser implicit OAuth flow and EventSub WebSocket transport. The OAuth callback checks a random state value, removes the token fragment from the URL immediately, and validates the token's client ID and scope. Tokens are stored in sessionStorage, revalidated on load and hourly, and removed when disconnecting. No Twitch client secret is needed. Disconnecting stops listening and removes the local session; it does not revoke the app in Twitch account settings.

EventSub deduplicates messages, migrates server-requested reconnects, reconnects with backoff after connection loss, and surfaces authorization failures. It subscribes to the signed-in broadcaster's own channel. It never sends chat messages, manages a channel, or starts a stream.

Without a configured Twitch app and broadcaster authorization, rehearsal remains fully playable, but real Twitch events cannot be received. The interface labels rehearsal and camera inputs distinctly; neither is presented as a verified live Twitch connection.

## Broadcast

Open **Broadcast setup**, then **Enter stage view**. Use OBS **Window Capture** on the running browser and crop to the stage. This retains the browser's camera and Twitch session. Escape returns to the studio. `/?stage=1` opens in stage view.

An OBS Browser Source has its own permissions and session storage; pasting the URL into OBS does not transfer an existing webcam or Twitch sign-in. Window Capture is the recommended prototype setup.

## Architecture

- `src/game/engine.ts`: fixed 120 Hz simulation, swept landing checks, moving support surfaces, gravity, slopes, handoffs, rescue detection, bounded crowds and particles.
- `src/tracking/vision.worker.ts`: MediaPipe Hand Landmarker in a Web Worker; inference runs outside the rendering thread.
- `src/tracking/palms.ts`: mirrored/letterboxed coordinate mapping, palm construction, nearest-position identity matching, smoothing, and a 250 ms dropout grace period.
- `src/twitch/`: narrow OAuth and EventSub integration, validation, deduplication and reconnect handling.
- `src/components/Stage.tsx`: responsive canvas, pointer/keyboard controls, animation timing and stage telemetry.
- `src/game/demo.ts`: reproducible rehearsal inputs exercising actual collisions.

All camera frames and hand landmarks stay on the device. There is no application backend, camera upload, analytics tracker, or persistent viewer database. Names and game state are held in memory. The only runtime service calls are Twitch authorization, validation, subscription and event delivery when connected.

## Deployment

Vercel: import this repository, select Vite, build with `npm run build`, output `dist`. Use Node 22. The included `vercel.json` configures security headers and local model caching. `VITE_TWITCH_CLIENT_ID` is a public identifier, not a secret. Never commit access tokens.

## Limitations to validate next

- Fast hand crossings and severe occlusion may confuse geometric hand identity matching.
- Tracking quality depends on lighting, hand angle and available CPU. Hands are tracked in two dimensions.
- A 250 ms tracking dropout is bridged; longer loss releases the visitor.
- Live Twitch verification requires a registered Twitch application and broadcaster sign-in.
- The prototype is intended for current desktop Chromium browsers. Mobile rehearsal is supported, but mobile live-camera performance needs physical-device validation.

## Attribution

MediaPipe Tasks Vision and its hand model are provided by Google. Model source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task. Runtime package: `@mediapipe/tasks-vision` 0.10.32 (Apache-2.0). Test photograph is downloaded on demand from Google's official `mediapipe-assets/right_hands.jpg`; it is not distributed in the application.

Manrope and IBM Plex Mono are distributed through Fontsource under the SIL Open Font License. Lucide icons are ISC licensed. Character artwork, sound effects, UI, and game logic were created for this project. See `public/THIRD_PARTY_NOTICES.txt` for bundled dependency notices.

## Codex build record

The concept, implementation, tests, troubleshooting and deployment were developed in the Codex chat whose session ID is `01a183e3-900a-7113-b488-e8e2698d67e7`. Reconfirm the session ID with `/status` before a hackathon submission. A hackathon entry and demo video have not been submitted by this repository.
