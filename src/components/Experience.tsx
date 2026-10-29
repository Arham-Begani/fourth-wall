import { useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Hand,
  Heart,
  MoveHorizontal,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Twitch,
} from "lucide-react";
import type { Stats } from "./Stage";
import type { Reaction, Scene } from "../game/engine";

export function CopyButton({
  value,
  label = "Copy redirect URL",
}: {
  value: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <button
        className="copy-control"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(value)
            .then(() => setState("copied"))
            .catch(() => setState("failed"));
          if (!navigator.clipboard) setState("failed");
        }}
      >
        {state === "copied" ? <Check size={15} /> : <Copy size={15} />}{" "}
        {state === "copied" ? "Copied" : label}
      </button>
      {state === "failed" && (
        <small className="copy-error">
          Select the URL above and copy it manually.
        </small>
      )}
    </>
  );
}

export function LandingHero({
  onDemo,
  onConnect,
}: {
  onDemo: () => void;
  onConnect: () => void;
}) {
  return (
    <section className="landing-hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="hero-live-dot" /> A PLAYGROUND FOR YOU & YOUR CHAT
        </div>
        <h1>
          Your chat.
          <br />
          <span>In your hands.</span>
        </h1>
        <p>
          Turn the people watching your stream into a tiny crowd you can
          actually catch. Two hands. One webcam. A little shared chaos.
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={onDemo}>
            <Play size={17} fill="currentColor" /> Try the handoff{" "}
            <ArrowRight size={17} />
          </button>
          <button className="hero-secondary" onClick={onConnect}>
            <Twitch size={17} /> Set up my channel
          </button>
        </div>
        <div className="hero-assurances">
          <span>
            <Check size={13} /> No viewer installs
          </span>
          <span>
            <ShieldCheck size={13} /> Camera stays local
          </span>
          <span>
            <Sparkles size={13} /> Try without Twitch
          </span>
        </div>
      </div>
      <div
        className="hero-art"
        aria-label="Illustration of tiny chat characters being passed between palms"
      >
        <div className="art-caption">
          <span className="tiny-dot" /> SMALL CHARACTERS. BIG MAIN-CHARACTER
          ENERGY.
        </div>
        <div className="chat-sticker sticker-one">
          <span className="chat-avatar lilac" /> moonbean <code>!join</code>
        </div>
        <div className="chat-sticker sticker-two">
          <span className="chat-avatar peach" /> soupfriend <code>!heart</code>
          <Heart size={15} />
        </div>
        <svg
          className="hero-palms"
          viewBox="0 0 460 340"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="palm-glow"
              x1="50"
              y1="0"
              x2="350"
              y2="350"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#d3f77a" />
              <stop offset="1" stopColor="#78927e" stopOpacity=".2" />
            </linearGradient>
          </defs>
          <path
            d="M40 176c24 2 37 10 57 10h92c28 0 29 32 4 35l-51 7c29 15 47 42 61 69l-70 28c-26-39-56-51-92-55"
            fill="#d3f77a08"
            stroke="url(#palm-glow)"
            strokeWidth="2"
          />
          <path
            d="M421 257c-22 4-39 8-62 8h-89c-30 0-33 28-7 34l46 7c-26 15-35 34-45 54"
            stroke="#b3a0ff77"
            strokeWidth="2"
          />
          <path
            d="M48 177h157"
            stroke="#d3f77a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M265 260h151"
            stroke="#b3a0ff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M204 122c41-14 72 13 83 58"
            stroke="#d3f77a66"
            strokeDasharray="4 7"
          />
          <path d="m279 172 10 11 2-14" stroke="#d3f77a88" />
          <circle cx="48" cy="177" r="4" fill="#d3f77a" />
          <circle cx="205" cy="177" r="4" fill="#d3f77a" />
        </svg>
        <div className="hero-bean bean-one">
          <span className="bean-crown">♛</span>
          <i />
          <i />
          <b>noodleboy</b>
        </div>
        <div className="hero-bean bean-two">
          <i />
          <i />
          <b>tinychaos</b>
        </div>
        <div className="hero-bean bean-three">
          <i />
          <i />
        </div>
        <span className="art-spark spark-one">✧</span>
        <span className="art-spark spark-two">✳</span>
        <div className="art-footer">
          <span>01 — PALM CATCH</span>
          <span>LET THEM INTO YOUR WORLD ↗</span>
        </div>
      </div>
    </section>
  );
}

export function Readiness({
  camera,
  connected,
  onCamera,
  onConnect,
}: {
  camera: boolean;
  connected: boolean;
  onCamera: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="readiness">
      <div>
        <span className="section-index">THE PLAYGROUND</span>
        <h2>A little closer to your community.</h2>
      </div>
      <div className="readiness-actions">
        <span className="ready-step done">
          <CheckCircle2 size={15} /> Rehearsal ready
        </span>
        <button
          className={`ready-step ${camera ? "done" : ""}`}
          onClick={onCamera}
        >
          {camera ? <CheckCircle2 size={15} /> : <Camera size={15} />}{" "}
          {camera ? "Camera on" : "Add your camera"}
        </button>
        <button
          className={`ready-step ${connected ? "done" : ""}`}
          onClick={onConnect}
        >
          {connected ? <CheckCircle2 size={15} /> : <Twitch size={15} />}{" "}
          {connected ? "Chat connected" : "Connect your chat"}
        </button>
      </div>
    </div>
  );
}

export function PlayKit({
  stats,
  best,
  mode,
  scene,
  showNames,
  practice,
  paused,
  onStart,
  onReset,
  onScene,
  onNames,
  onReaction,
  onTilt,
}: {
  stats: Stats;
  best: number;
  mode: "demo" | "camera";
  scene: Scene;
  showNames: boolean;
  practice: boolean;
  paused: boolean;
  onStart: () => void;
  onReset: () => void;
  onScene: (s: Scene) => void;
  onNames: () => void;
  onReaction: (r: Reaction) => void;
  onTilt: (a: "left" | "right" | "level") => void;
}) {
  const active = stats.roundStatus === "active",
    finished = stats.roundStatus === "finished";
  return (
    <section className="play-kit" aria-label="Play modes and customization">
      <div className="rescue-card">
        <div className="rescue-heading">
          <span className="feature-icon">
            <Timer size={21} />
          </span>
          <div>
            <span className="section-index">60-SECOND CHALLENGE</span>
            <h3>
              {finished
                ? "That's a wrap."
                : active
                  ? "Bring your people home."
                  : "One minute. Tiny lives. Big stakes."}
            </h3>
          </div>
          {active && (
            <strong className="round-clock" data-testid="round-clock">
              {Math.ceil(stats.remaining)}
              <small>s</small>
            </strong>
          )}
        </div>
        <p>
          {active
            ? `${practice ? "Practice visitors arrive every three seconds." : "Your Twitch viewers enter with !join."} Catch, pass, and rescue. Pausing the stage pauses the clock.`
            : finished
              ? `${stats.saved} rescued · ${stats.transfers} handoffs · best streak ${stats.bestStreak}. Your next run starts with a fresh stage.`
              : "Catch for 10 points, make a first handoff for 25, and rescue for 100. Every three consecutive rescues raises the rescue multiplier, up to 3×."}
        </p>
        {active && (
          <div
            className="round-progress"
            role="progressbar"
            aria-label="Time remaining"
            aria-valuemin={0}
            aria-valuemax={60}
            aria-valuenow={Math.ceil(stats.remaining)}
          >
            <span style={{ width: `${(stats.remaining / 60) * 100}%` }} />
          </div>
        )}
        <div className="rescue-bottom">
          <div className="run-score">
            <Trophy size={15} />
            <strong data-testid="score-count">
              {stats.score.toLocaleString()}
            </strong>
            <span>PTS</span>
            <span className="best-score">
              Device best {best.toLocaleString()}
            </span>
          </div>
          <button
            className="challenge-button"
            onClick={active ? onReset : onStart}
          >
            {active ? <RotateCcw size={15} /> : <Play size={15} />}{" "}
            {active
              ? "Exit run"
              : finished
                ? "Play again"
                : "Start 60-second run"}
          </button>
        </div>
      </div>
      <div className="customize-grid">
        <div className="customize-block">
          <span className="section-index">SET THE SCENE</span>
          <div className="scene-picker">
            {(["grove", "orbit", "sunset"] as Scene[]).map((s) => (
              <button
                key={s}
                aria-pressed={scene === s}
                onClick={() => onScene(s)}
              >
                <span className={`scene-swatch ${s}`} />
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button
            className="name-toggle"
            aria-pressed={showNames}
            onClick={onNames}
          >
            <span className={`mini-toggle ${showNames ? "on" : ""}`} />
            {showNames ? "Viewer names on" : "Viewer names off"}
          </button>
        </div>
        <div className="customize-block">
          <span className="section-index">GIVE THE CROWD A MOMENT</span>
          <div className="reaction-buttons">
            <button
              onClick={() => onReaction("wave")}
              disabled={!stats.active || paused || finished}
            >
              <Hand size={17} /> Wave
            </button>
            <button
              onClick={() => onReaction("heart")}
              disabled={!stats.active || paused || finished}
            >
              <Heart size={17} /> Hearts
            </button>
            <button
              onClick={() => onReaction("spin")}
              disabled={!stats.active || paused || finished}
            >
              <Sparkles size={17} /> Spin
            </button>
          </div>
          <p>
            Viewers can use <code>!wave</code>, <code>!heart</code> or{" "}
            <code>!spin</code> after joining.
          </p>
        </div>
      </div>
      {mode === "demo" && (
        <div className="touch-controls">
          <span>
            <MoveHorizontal size={16} /> Drag either palm, then tilt to release.
          </span>
          <div>
            <button
              onClick={() => onTilt("left")}
              aria-label="Tilt selected palm left"
            >
              ↙ Tilt left
            </button>
            <button
              onClick={() => onTilt("level")}
              aria-label="Level selected palm"
            >
              — Level
            </button>
            <button
              onClick={() => onTilt("right")}
              aria-label="Tilt selected palm right"
            >
              Tilt right ↘
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function TwitchSetupGuide({
  redirect = `${location.origin}/`,
}: {
  redirect?: string;
}) {
  return (
    <div className="twitch-setup-guide">
      <div className="redirect-box">
        <span className="section-index">YOUR EXACT OAUTH REDIRECT URL</span>
        <code data-testid="redirect-url">{redirect}</code>
        <CopyButton value={redirect} />
        <small>
          Keep the trailing slash. Use this same address when opening Fourth
          Wall.
        </small>
      </div>
      <ol className="setup-steps">
        <li>
          <span>1</span>
          <div>
            <strong>Prepare your Twitch account</strong>
            <p>
              Verify your email and enable two-factor authentication in Twitch →
              Settings → Security and Privacy. Refresh the developer console
              afterward.
            </p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Register Fourth Wall</strong>
            <p>
              Open the{" "}
              <a
                href="https://dev.twitch.tv/console/apps"
                target="_blank"
                rel="noreferrer"
              >
                Twitch developer console ↗
              </a>{" "}
              → Applications → Register Your Application.
            </p>
            <dl className="registration-fields">
              <dt>Name</dt>
              <dd>
                Fourth Wall — your channel name <small>(must be unique)</small>
              </dd>
              <dt>OAuth Redirect URLs</dt>
              <dd>
                The URL above, then click <b>Add</b>
              </dd>
              <dt>Category</dt>
              <dd>Game Integration</dd>
              <dt>Client Type</dt>
              <dd>
                <b>Confidential</b>
              </dd>
            </dl>
            <p>
              Complete the CAPTCHA and click Create. “Public” is for Twitch's
              device-code flow; this app uses browser redirects.
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Copy your Client ID</strong>
            <p>
              Find the app under Developer Applications → Manage → Client ID.
              Paste that ID below. You do not need to generate or share a client
              secret.
            </p>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <strong>Authorize as the broadcaster</strong>
            <p>
              Continue to Twitch and sign in to the channel whose chat you want
              to use. Authorize read-only chat access. Back here, wait for
              Connected, turn on your camera, and ask a viewer to type{" "}
              <code>!join</code>.
            </p>
          </div>
        </li>
      </ol>
      <a
        className="documentation-link"
        href="https://dev.twitch.tv/docs/authentication/register-app/"
        target="_blank"
        rel="noreferrer"
      >
        Official Twitch registration guide <ArrowRight size={13} />
      </a>
    </div>
  );
}

export function ProductDetails({
  onConnect,
  onDemo,
  onBroadcast,
}: {
  onConnect: () => void;
  onDemo: () => void;
  onBroadcast: () => void;
}) {
  const questions = [
    [
      "Do viewers need to install anything?",
      "No. They stay in your Twitch chat and type !join. Once on stage, !wave, !heart and !spin animate their own character. Each viewer can have one active character.",
    ],
    [
      "Can I try it without a Twitch account?",
      "Yes. Rehearsal starts immediately with simulated hands. Drag a palm, use the tilt buttons, or watch the guided handoff. A practice rescue run adds a test visitor every three seconds.",
    ],
    [
      "What happens to my camera footage?",
      "Hand detection runs inside your browser. Fourth Wall does not upload camera frames or landmarks, record your stream, or keep a viewer database. Only the Twitch connection talks to Twitch services.",
    ],
    [
      "How do points and streaks work?",
      "A visitor’s first catch earns 10 points and their first handoff earns 25. A rescue earns 100 points multiplied by your rescue streak bonus. Every three consecutive rescues increases that bonus, up to 3×. A missed visitor resets the streak. Repeatedly recatching the same visitor does not generate extra catch points.",
    ],
    [
      "How do I put this on my stream?",
      "Connect chat and your camera here, then open Broadcast setup and enter stage view. In OBS, add Window Capture for this browser and crop to the stage. This keeps the same camera and Twitch session. Press Escape to return to the studio.",
    ],
    [
      "Why does Twitch say the redirect URL is wrong?",
      "The address registered with Twitch must exactly match the one in the setup guide, including https and the final slash. Open the same Fourth Wall domain you registered. Choose the Confidential client type for this app’s browser redirect flow.",
    ],
    [
      "What makes tracking work best?",
      "Use a current desktop Chrome or Edge browser, good front lighting, and a visible wrist and open palm. The glowing line is the catch surface. Keep both hands in frame and avoid crossing them rapidly. Tracking is two-dimensional; mobile camera performance depends on the device.",
    ],
  ];
  return (
    <div className="product-details">
      <section className="feature-section" id="experience">
        <div className="section-heading-large">
          <div>
            <span className="section-index">MORE THAN A CHAT OVERLAY</span>
            <h2>
              Make being there
              <br />
              <em>feel like being there.</em>
            </h2>
          </div>
          <p>
            A between-games ritual. A community challenge. Or just five minutes
            of trying very hard not to drop soupfriend.
          </p>
        </div>
        <div className="feature-cards">
          <article className="feature-card feature-rescue">
            <Timer size={23} />
            <span className="feature-number">01 / PLAY TOGETHER</span>
            <h3>
              Turn a quiet moment
              <br />
              into a rescue mission.
            </h3>
            <p>
              Start a 60-second run. Build a rescue streak, chase your device
              best, and give everyone a reason to cheer.
            </p>
            <button onClick={onDemo}>
              See the catch in action <ArrowRight size={15} />
            </button>
          </article>
          <article className="feature-card feature-reactions">
            <div className="command-cloud">
              <code>!join</code>
              <code>!heart ♥</code>
              <code>!wave</code>
            </div>
            <span className="feature-number">02 / LET THEM BE THEM</span>
            <h3>
              A tiny body.
              <br />
              Their whole personality.
            </h3>
            <p>
              Names, chat colors, little crowns and sprouts. Viewers can wave,
              send a heart, or spin while you hold them.
            </p>
            <button onClick={onConnect}>
              Invite your community <ArrowRight size={15} />
            </button>
          </article>
          <article className="feature-card feature-broadcast">
            <Radio size={23} />
            <span className="feature-number">03 / MAKE IT YOURS</span>
            <h3>
              Your stage.
              <br />
              Your kind of atmosphere.
            </h3>
            <p>
              Grove, Orbit or Sunset. Toggle name labels and sound, then switch
              to a clean stage view for your broadcast.
            </p>
            <button onClick={onBroadcast}>
              Set up for OBS <ArrowRight size={15} />
            </button>
          </article>
        </div>
      </section>
      <section className="connection-section" id="twitch-setup">
        <div className="connection-story">
          <span className="section-index">
            <Twitch size={16} /> FROM DEMO TO YOUR CHANNEL
          </span>
          <h2>
            One setup.
            <br />A whole new way
            <br />
            <em>to hang out.</em>
          </h2>
          <p>
            Register a Twitch app once. Connect your channel, bring your hands,
            and let chat take it from there.
          </p>
          <button className="primary-button" onClick={onConnect}>
            Open Twitch setup <ArrowRight size={17} />
          </button>
          <span className="setup-trust">
            <ShieldCheck size={15} /> Read-only chat. No messages sent.
          </span>
        </div>
        <div className="connection-checklist">
          <div>
            <span>01</span>
            <section>
              <h3>Register your application</h3>
              <p>
                Verified email, 2FA, a unique name, and the exact redirect URL.
                Choose <strong>Confidential</strong> for the browser login flow.
              </p>
            </section>
          </div>
          <div>
            <span>02</span>
            <section>
              <h3>Paste the Client ID</h3>
              <p>
                You’ll find it under Manage in the Twitch developer console. No
                client secret goes into Fourth Wall.
              </p>
            </section>
          </div>
          <div>
            <span>03</span>
            <section>
              <h3>Let your community in</h3>
              <p>
                Authorize as the broadcaster. When Connected appears, your
                viewers type <code>!join</code> in that channel’s chat.
              </p>
            </section>
          </div>
          <div className="connection-url">
            <code>https://fourth-wall-eight.vercel.app/</code>
            <CopyButton value="https://fourth-wall-eight.vercel.app/" />
          </div>
        </div>
      </section>
      <section className="faq-section">
        <div>
          <span className="section-index">THE LITTLE DETAILS</span>
          <h2>
            Good questions.
            <br />
            Straight answers.
          </h2>
          <p>Everything you need before your first catch.</p>
        </div>
        <div className="faq-list">
          {questions.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronRight size={17} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="last-call">
        <span className="tiny-cross">✳</span>
        <h2>
          They’re already in your chat.
          <br />
          <span>Let them into your world.</span>
        </h2>
        <button className="primary-button" onClick={onDemo}>
          <Play size={16} fill="currentColor" /> Give it a little try{" "}
          <ArrowRight size={17} />
        </button>
        <p>No camera or Twitch account needed for rehearsal.</p>
      </section>
    </div>
  );
}
