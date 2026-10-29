# Fourth Wall

**Your chat. In your hands.**

[Play Fourth Wall](https://fourth-wall-eight.vercel.app/)

A working prototype of a Twitch audience entering a streamer's webcam as little characters. Raise a palm, catch a viewer, tilt to release them into your other hand, and carry them into the safe zone.

Built from scratch with OpenAI Codex for the Codex x TwitchCon hackathon. This prototype implements palm catching and handoffs. Natural-language inventions and physics contraptions belong to the larger concept and are not implemented in this release.

## Play

Rehearsal starts immediately, without a camera or Twitch account. Select **Watch a handoff** for a complete sequence driven by the same physics engine as camera mode. Statistics are computed by collision detection; the sequence does not fake catches or rescues.

In rehearsal, drag either palm, or focus the stage and use the arrow keys. **1 / 2** select a hand; **Q / E** tilt it; **0** levels it. **D** drops a test visitor, and **Space** pauses. Carry a caught visitor into the green safe zone.

Select **Your camera** to load MediaPipe and start local tracking of up to two hands. Use good front lighting, face an open palm toward the camera, and keep the wrist and fingers visible. The glowing line is the collision surface. Tilt it steeply to release a visitor and position the other hand underneath. This is a 2D camera-plane interaction, not a full 3D room reconstruction.

## More ways to play

- **60-second rescue run:** an active-play clock, a final score, and a device-local best. Pause or hide the page to pause the clock. The timer uses elapsed time independently of the physics frame rate. Without a connected Twitch channel, clearly labeled practice visitors arrive every three seconds; with Twitch connected, the audience supplies the arrivals.
- **Scoring:** each visitor's first catch earns 10 points and first handoff earns 25. Rescues earn 100 points times a streak multiplier. Every three consecutive rescues raises it, up to 3×. A miss resets the current streak. Recatching the same visitor cannot farm catch points.
- **Viewer reactions:** after joining, type `!wave`, `!heart`, or `!spin` to animate your own character. Reactions have a two-second per-viewer cooldown. Host buttons can trigger a reaction across the active crowd.
- **Stage customization:** Grove, Orbit and Sunset palettes, optional viewer names, character crowns and sprouts, and synthesized sound effects. Scene choices and the challenge best are stored on this device; viewer identities are not saved as a leaderboard.
- **Touch controls:** drag a simulated hand, then use Tilt left, Level or Tilt right. Keyboard controls remain available.
- **Guided setup:** the landing page includes a readiness checklist, an exact copyable OAuth URL, a registration walkthrough, OBS guidance and expandable FAQs.

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

1. Verify your Twitch email and enable two-factor authentication under Settings → Security and Privacy. Refresh the developer console.
2. At https://dev.twitch.tv/console/apps, select Applications → Register Your Application. Use a unique name such as `FourthWallYourChannel`, category **Game Integration**, and client type **Confidential**.
3. Add **`https://fourth-wall-eight.vercel.app/`**, including the trailing slash, under OAuth Redirect URLs and click **Add**, then complete the CAPTCHA and click **Create**. For local development, optionally add `http://localhost:5173/` too. Always open Fourth Wall at the domain registered with Twitch.
4. Under Developer Applications, choose **Manage**, then copy **Client ID**. Paste it into Fourth Wall's **Connect Twitch** dialog. Alternatively, configure `VITE_TWITCH_CLIENT_ID` in Vercel and redeploy. A Client ID is public; a client secret is not used by this app.
5. Click **Continue to Twitch**, sign in as the broadcaster whose chat should be connected, and authorize `user:read:chat`. Wait for **Connected**, turn on the camera, and have a viewer type `!join` in that channel's chat.

**Correction to the initial prototype's guide:** Twitch's **Public client type** is limited to its device-code flow. Fourth Wall uses the browser implicit redirect flow, so choose **Confidential**, while still supplying only the Client ID. See Twitch's [registration guide](https://dev.twitch.tv/docs/authentication/register-app/) and [OAuth documentation](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/).

A viewer can have one active character. Joining has a ten-second per-user cooldown, reactions have a two-second cooldown, and intake is bounded to 32 waiting and 48 active viewers. The app never sends a message to chat.

Uses Twitch's documented browser implicit OAuth flow and EventSub WebSocket transport. The OAuth callback checks a random state value, removes the token fragment from the URL immediately, and validates the token's client ID and scope. Tokens are stored in sessionStorage, revalidated on load and hourly, and removed when disconnecting. No Twitch client secret is needed. Disconnecting stops listening and removes the local session; it does not revoke the app in Twitch account settings.

EventSub deduplicates messages, migrates server-requested reconnects, reconnects with backoff after connection loss, and surfaces authorization failures. It subscribes to the signed-in broadcaster's own channel. It never sends chat messages, manages a channel, or starts a stream.

Without a configured Twitch app and broadcaster authorization, rehearsal remains fully playable, but real Twitch events cannot be received. The interface labels rehearsal and camera inputs distinctly; neither is presented as a verified live Twitch connection.

## Broadcast

Open **Broadcast setup**, then **Enter stage view**. Use OBS **Window Capture** on the running browser and crop to the stage. This retains the browser's camera and Twitch session. Escape returns to the studio. `/?stage=1` opens in stage view.

An OBS Browser Source has its own permissions and session storage; pasting the URL into OBS does not transfer an existing webcam or Twitch sign-in. Window Capture is the recommended prototype setup.

## Architecture

- `src/game/engine.ts`: fixed 120 Hz simulation, swept landing checks, moving support surfaces, gravity, slopes, handoffs, rescue detection, bounded crowds and particles.
- `src/tracking/vision.worker.ts`: MediaPipe Hand Landmarker in a classic Web Worker, bundled by `scripts/build-worker.mjs`; inference runs outside the rendering thread. Camera frames are reduced to a maximum width of 640 pixels before inference.
- `src/tracking/palms.ts`: mirrored/letterboxed coordinate mapping, palm construction, nearest-position identity matching, smoothing, and separate handling of missing detections and frames still being processed.
- `src/twitch/`: narrow OAuth and EventSub integration, validation, deduplication and reconnect handling.
- `src/components/Stage.tsx`: responsive canvas, pointer/keyboard controls, animation timing and stage telemetry.
- `src/game/demo.ts`: reproducible rehearsal inputs exercising actual collisions.

All camera frames and hand landmarks stay on the device. There is no application backend, camera upload, analytics tracker, or persistent viewer database. Names and game state are held in memory. The only runtime service calls are Twitch authorization, validation, subscription and event delivery when connected.

## Deployment

Vercel: import this repository, select Vite, build with `npm run check`, output `dist`. Use Node 22. Each deployment runs the unit suite before building. The included `vercel.json` configures security headers and local model caching. `VITE_TWITCH_CLIENT_ID` is a public identifier, not a secret. Never commit access tokens. An optional GitHub Actions template is included at `scripts/ci-workflow.example.yml`; it is not installed as an active workflow.

## Limitations to validate next

- Fast hand crossings and severe occlusion may confuse geometric hand identity matching.
- Tracking quality depends on lighting, hand angle and available CPU. Hands are tracked in two dimensions.
- Missing detections have a 250 ms grace period. While a new frame is still being captured or processed, the previous detection can remain valid for up to three seconds. A completed frame without the hand releases it promptly; stalled input cannot hold a visitor indefinitely. Tracking time reports the complete frame round trip.
- Live Twitch verification requires a registered Twitch application and broadcaster sign-in.
- The prototype is intended for current desktop Chromium browsers. Mobile rehearsal is supported, but mobile live-camera performance needs physical-device validation.

## Attribution

MediaPipe Tasks Vision and its hand model are provided by Google. Model source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task. Runtime package: `@mediapipe/tasks-vision` 0.10.32 (Apache-2.0). Test photograph is downloaded on demand from Google's official `mediapipe-assets/right_hands.jpg`; it is not distributed in the application.

Manrope and IBM Plex Mono are distributed through Fontsource under the SIL Open Font License. Lucide icons are ISC licensed. Character artwork, sound effects, UI, and game logic were created for this project. See `public/THIRD_PARTY_NOTICES.txt` for bundled dependency notices.

## Codex build record

The concept, implementation, tests, troubleshooting and deployment were developed in the Codex chat whose session ID is `01a183e3-900a-7113-b488-e8e2698d67e7`. Reconfirm the session ID with `/status` before a hackathon submission. A hackathon entry and demo video have not been submitted by this repository.
