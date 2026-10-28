import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Camera, Check, ChevronRight, CircleHelp, Copy, Expand, Hand, Layers2, LoaderCircle, Maximize2, Pause, Play, Plus, Radio, RotateCcw, ShieldCheck, Sparkles, Twitch, Users, Volume2, VolumeX, X } from 'lucide-react';
import { World, COLORS } from './game/engine';
import { Stage } from './components/Stage';
import type { Stats } from './components/Stage';
import { Modal } from './components/Modal';
import { CameraTracker } from './tracking/camera';
import { Sound } from './game/sound';
import { clearAuthorization, configuredClientId, restoreAuthorization, startAuthorization, validateToken } from './twitch/auth';
import type { TwitchIdentity } from './twitch/auth';
import { TwitchChat, parseJoin } from './twitch/eventsub';
import type { ChatJoin, ConnectionStatus } from './twitch/eventsub';
const NAMES=['noodleboy','tinychaos','moonbean','pixelpilot','soupfriend','cloudcrumb','lilcomet','toastghost'];
const zero:Stats={catches:0,transfers:0,saved:0,missed:0,active:0,hands:2,fps:60,latency:0};
export default function App(){
  const [world]=useState(()=>new World());
  const [sound]=useState(()=>new Sound());
  const [mode,setMode]=useState<'demo'|'camera'>('demo');
  const [camera,setCamera]=useState<CameraTracker|null>(null);
  const cameraRef=useRef<CameraTracker|null>(null);
  const [cameraBusy,setCameraBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [paused,setPaused]=useState(false);
  const [stats,setStats]=useState(zero);
  const [sequence,setSequence]=useState(0),[sequencePlaying,setSequencePlaying]=useState(false);
  const [resetKey,setResetKey]=useState(0),[selected,setSelected]=useState(0);
  const [skeleton,setSkeleton]=useState(false),[soundOn,setSoundOn]=useState(false);
  const [modal,setModal]=useState<'twitch'|'guide'|'broadcast'|null>(null);
  const [clientId,setClientId]=useState(configuredClientId);
  const [identity,setIdentity]=useState<TwitchIdentity|null>(null);
  const [connection,setConnection]=useState<ConnectionStatus>('disconnected');
  const connectionRef=useRef<TwitchChat|null>(null);
  const [queue,setQueue]=useState<ChatJoin[]>([]);
  const queueRef=useRef<ChatJoin[]>([]);
  const [chatText,setChatText]=useState('!join');
  const [autoDrop,setAutoDrop]=useState(false);
  const [stageOnly,setStageOnly]=useState(new URLSearchParams(location.search).has('stage'));
  const [transparent,setTransparent]=useState(false);
  const [copied,setCopied]=useState(false);
  const stageRef=useRef<HTMLDivElement>(null);
  const serial=useRef(0),mounted=useRef(true);
  const updateStats=useCallback((value:Stats)=>setStats(value),[]);
  const endSequence=useCallback(()=>setSequencePlaying(false),[]);
  const drop=useCallback(()=>{
    if(paused){setNotice('Resume the stage before dropping a viewer.');return;}
    if(mode==='camera'&&!world.hands.length){setNotice('Show an open hand to the camera first.');return;}
    const n=serial.current++;
    if(!world.spawn(NAMES[n%NAMES.length],undefined,undefined,COLORS[n%COLORS.length]))setNotice('The stage is full. Save some visitors first.');
  },[world,paused,mode]);
  const disconnect=useCallback(()=>{connectionRef.current?.disconnect();connectionRef.current=null;clearAuthorization();setIdentity(null);setConnection('disconnected');queueRef.current=[];setQueue([]);},[]);
  useEffect(()=>{
    mounted.current=true;
    void restoreAuthorization().then(session=>{if(mounted.current)setIdentity(session);}).catch(err=>{if(mounted.current)setError(err.message);});
    world.onEvent=event=>{if(event.type==='catch'||event.type==='transfer'||event.type==='save')sound.play(event.type);};
    const timer=window.setTimeout(()=>{world.spawn('noodleboy');world.spawn('tinychaos',undefined,455);world.spawn('moonbean',undefined,390);},350);
    return()=>{mounted.current=false;clearTimeout(timer);cameraRef.current?.stop();connectionRef.current?.disconnect();sound.close();};
  },[world,sound]);
  useEffect(()=>{
    if(!identity)return;
    const chat=new TwitchChat(identity);connectionRef.current=chat;
    chat.onStatus=(status,detail)=>{setConnection(status);if(detail)setError(detail);};
    chat.onJoin=join=>{
      if(queueRef.current.some(v=>v.id===join.id)||world.visitors.some(v=>v.id===join.id))return;
      if(queueRef.current.length>=32)return;
      queueRef.current=[...queueRef.current,join];setQueue([...queueRef.current]);
    };
    chat.connect();
    const validation=window.setInterval(()=>{void validateToken(identity.token,identity.clientId).catch(err=>{disconnect();setError(err.message);});},3600000);
    return()=>{chat.disconnect();clearInterval(validation);};
  },[identity,world,disconnect]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(paused||document.hidden||!world.hands.length||world.visitors.length>=48||!queueRef.current.length)return;
      const next=queueRef.current.shift()!;world.spawn(next.name,next.id,undefined,next.color);setQueue([...queueRef.current]);
    },800);return()=>clearInterval(timer);
  },[world,paused]);
  useEffect(()=>{if(!autoDrop)return;const timer=window.setInterval(drop,5000);return()=>clearInterval(timer);},[autoDrop,drop]);
  useEffect(()=>{if(!notice)return;const t=window.setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);},[notice]);
  const reset=()=>{world.reset();setResetKey(v=>v+1);setPaused(false);setSequencePlaying(false);queueRef.current=[];setQueue([]);setNotice('Fresh start. Your hands are ready.');};
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select,button')||event.target.isContentEditable))return;
      if(document.querySelector('dialog[open]'))return;
      if(event.code==='Space'){event.preventDefault();setPaused(p=>!p);}
      if(event.key.toLowerCase()==='d')drop();
      if(event.key==='Escape')setStageOnly(false);
    };window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);
  },[drop]);
  const useDemo=()=>{cameraRef.current?.stop();cameraRef.current=null;setCamera(null);setMode('demo');world.reset();setResetKey(v=>v+1);setSequencePlaying(false);setError('');};
  const startCamera=async()=>{
    if(cameraBusy)return;
    setCameraBusy(true);setError('');setSequencePlaying(false);setAutoDrop(false);
    cameraRef.current?.stop();const tracker=new CameraTracker();cameraRef.current=tracker;
    tracker.onError=message=>{setError(message);setCamera(null);setMode('demo');};
    try{await tracker.start();if(!mounted.current){tracker.stop();return;}setCamera(tracker);setMode('camera');world.reset();world.setHands([]);setPaused(false);setNotice('Hold an open palm toward the camera. The glowing line is your catch surface.');}
    catch(err){tracker.stop();cameraRef.current=null;setError(err instanceof DOMException&&err.name==='NotAllowedError'?'Camera access was not granted. Allow camera access in your browser, then try again.':err instanceof DOMException&&err.name==='NotFoundError'?'No webcam was found. Connect a camera, or keep playing in rehearsal.':err instanceof DOMException&&err.name==='NotReadableError'?'Your camera is busy in another application. Close that camera source and try again.':err instanceof Error?err.message:'Could not start the camera.');setMode('demo');setCamera(null);}
    finally{if(mounted.current)setCameraBusy(false);}
  };
  const watchSequence=()=>{if(mode!=='demo')useDemo();setPaused(false);setAutoDrop(false);setSequencePlaying(true);setSequence(v=>v+1);};
  const toggleSound=async()=>{if(soundOn){sound.enabled=false;setSoundOn(false);}else{try{await sound.enable();setSoundOn(true);}catch{setNotice('Audio is unavailable in this browser.');}}};
  const submitDemo=(event:React.FormEvent)=>{event.preventDefault();const index=serial.current++;const join=parseJoin({message:{text:chatText},chatter_user_id:`rehearsal-${index}`,chatter_user_name:NAMES[index%NAMES.length],color:COLORS[index%COLORS.length]});if(!join){setNotice('Try !join — that is the command for this prototype.');return;}if(paused){setNotice('Resume before sending a rehearsal arrival.');return;}if(mode==='camera'&&!world.hands.length){setNotice('Show an open hand first.');return;}world.spawn(join.name,join.id,undefined,join.color);setChatText('');};
  const fullscreen=()=>{void stageRef.current?.requestFullscreen?.().catch(()=>setStageOnly(true));};
  const events=world.events.slice(0,5);
  return <div className={`app ${stageOnly?'stage-only':''}`}>
    {!stageOnly&&<>
      <header className="topbar"><a className="brand" href="/" aria-label="Fourth Wall home"><span className="brand-mark">f<span>4</span></span><span>fourth wall<span className="brand-period">.</span></span></a><nav><button className="nav-active" onClick={()=>stageRef.current?.scrollIntoView({behavior:'smooth',block:'center'})}>Playground</button><button onClick={()=>setModal('guide')}>How it works <ArrowRight size={14}/></button></nav><div className="topbar-right"><span className="prototype-tag">EARLY ACCESS 001</span><a href="https://github.com/Arham-Begani/fourth-wall" target="_blank" rel="noreferrer" className="source-link">Source ↗</a></div></header>
      <main className="main"><section className="intro"><div><div className="eyebrow"><span className="tiny-cross">✳</span> BREAK THE FOURTH WALL</div><h1>Your chat. <span>In your hands.</span></h1><p>A tiny crowd. A real connection. Catch your viewers, pass them<br className="desktop-break"/> between your palms, and bring them home.</p></div><div className="intro-aside"><div className="hand-symbol"><Hand size={34} strokeWidth={1.2}/><span className="little-star">✧</span><span className="mini-bean"><i/><i/></span></div><span>THE AUDIENCE<br/>HAS ENTERED THE CHAT.</span></div></section></main>
    </>}
    <div className="workspace">
      <div className="play-column">
        <section className="stage-shell" ref={stageRef} aria-label="Fourth Wall playground">
          <div className="stage-top"><div className="stage-label"><span className={`status-dot ${mode==='camera'?'green':''}`}/><span>{mode==='camera'?'YOUR CAMERA':'REHEARSAL'}</span><span className="stage-divider"/><span className="stage-title">Palm catch</span></div><div className="stage-top-right"><span className="frame-rate">{stats.fps} FPS</span><button className="icon-button" onClick={fullscreen} aria-label="Fullscreen stage"><Maximize2 size={15}/></button>{stageOnly&&<button className="icon-button" aria-label="Exit stage view" onClick={()=>setStageOnly(false)}><X size={18}/></button>}</div></div>
          <div className="canvas-wrap"><Stage world={world} mode={mode} camera={camera} paused={paused} sequence={sequence} resetKey={resetKey} skeleton={skeleton} selected={selected} onSelect={setSelected} onStats={updateStats} onSequenceEnd={endSequence} transparent={transparent}/>
            {mode==='camera'&&!stats.hands&&!paused&&<div className="tracking-hint"><Hand size={28}/><strong>Let’s see your hands</strong><span>Face an open palm toward the camera.<br/>Keep both hands in frame, with good lighting.</span></div>}
            {cameraBusy&&<div className="camera-loading"><LoaderCircle className="spin" size={30}/><strong>Opening the fourth wall…</strong><span>Starting your camera and loading hand tracking.</span></div>}
            {sequencePlaying&&<div className="sequence-label"><span className="pulse-dot"/> GUIDED REHEARSAL · SAME PHYSICS, SIMULATED HANDS</div>}
          </div>
          <div className="stage-bottom"><div className="mode-switch" aria-label="Input mode"><button className={mode==='demo'?'selected':''} onClick={useDemo} disabled={cameraBusy}><Hand size={14}/> Demo hands</button><button className={mode==='camera'?'selected':''} onClick={()=>void startCamera()} disabled={cameraBusy}>{cameraBusy?<LoaderCircle className="spin" size={14}/>:<Camera size={14}/>} Your camera</button></div><div className="stage-actions"><button className="icon-button" aria-label={soundOn?'Mute sound':'Enable sound'} onClick={()=>void toggleSound()}>{soundOn?<Volume2 size={17}/>:<VolumeX size={17}/>}</button><button className="icon-button" aria-label="Reset stage" onClick={reset}><RotateCcw size={17}/></button><button className="pause-button" onClick={()=>setPaused(p=>!p)}>{paused?<Play size={13}/>:<Pause size={13}/>}<span>{paused?'Resume':'Pause'}</span></button></div></div>
        </section>
        {!stageOnly&&<><div className="under-stage"><p><span className="keycap">{mode==='demo'?'↔':'✋'}</span>{mode==='demo'?<>Drag a palm to move it. <kbd>1</kbd><kbd>2</kbd> select · <kbd>Q</kbd><kbd>E</kbd> tilt · <kbd>0</kbd> level</>:<>Catch on the glowing palm line. Tilt to release. Catch with your other hand.</>}</p><button onClick={()=>setModal('guide')} aria-label="Open play guide"><CircleHelp size={16}/> Play guide</button></div><div className="action-row"><button className="primary-button" onClick={drop} disabled={paused}><Plus size={18}/> Drop a test viewer <kbd>D</kbd></button><button className="secondary-button" onClick={watchSequence} disabled={cameraBusy}><Play size={15} fill="currentColor"/> {sequencePlaying?'Restart handoff':'Watch a handoff'}</button><div className="local-note"><ShieldCheck size={15}/> Camera stays on your device</div></div><div className="quick-guide"><div><span className="step-number">01</span><div><strong>Make an entrance</strong><p>Viewers type <code>!join</code> to drop in.</p></div></div><div><span className="step-number">02</span><div><strong>Catch the little things</strong><p>Hold your palm under the arrival.</p></div></div><div><span className="step-number">03</span><div><strong>Bring them home</strong><p>Pass them over. Reach the safe zone.</p></div></div></div></>}
      </div>
      {!stageOnly&&<aside className="sidebar"><section className="connect-card"><div className="card-kicker"><Twitch size={17}/><span>YOUR COMMUNITY</span><span className={`connection-pill ${connection==='connected'?'online':''}`}>{connection==='connected'?'CONNECTED':connection==='connecting'||connection==='reconnecting'?'CONNECTING':'OFFLINE'}</span></div><h2>{identity?`@${identity.login}`:'Good things come in tiny.'}</h2><p>{identity?'Your viewers can type !join in your Twitch chat. We’ll take it from here.':'Connect Twitch and let real viewers step into your world.'}</p><button className="connect-button" onClick={()=>identity?disconnect():setModal('twitch')}><Twitch size={17}/>{identity?'Disconnect Twitch':'Connect Twitch'}{!identity&&<ArrowRight size={16}/>}</button><div className="connection-foot"><span className="tiny-dot"/> {identity?'Read-only chat · no messages sent':'No camera needed to try the rehearsal'}</div></section>
        <section className="session-card"><div className="section-heading"><h2>This little world</h2><span className="live-tag">{mode==='demo'?'REHEARSAL':'CAMERA'}</span></div><div className="stats-grid"><div><span className="stat-label">CAUGHT</span><strong data-testid="caught-count">{String(stats.catches).padStart(2,'0')}</strong></div><div><span className="stat-label">HANDOFFS</span><strong data-testid="handoff-count">{String(stats.transfers).padStart(2,'0')}</strong></div><div><span className="stat-label">HOME SAFE</span><strong className="lime" data-testid="saved-count">{String(stats.saved).padStart(2,'0')}</strong></div></div><div className="session-line"><span><Users size={14}/> On stage</span><b>{stats.active}</b></div><div className="session-line"><span><Hand size={14}/> {mode==='demo'?'Simulated hands':'Hands tracked'}</span><b>{stats.hands} / 2</b></div><div className="session-line"><span><ArrowDown size={14}/> Waiting to enter</span><b>{queue.length}</b></div>{mode==='camera'&&<div className="session-line"><span>Tracking time</span><b>{stats.latency} ms</b></div>}<div className="session-line subdued"><span>Missed arrivals</span><b>{stats.missed}</b></div></section>
        <section className="activity-card"><div className="section-heading"><h2>Little moments</h2><span className="tiny-dot"/></div><div className="event-list" aria-live="polite" aria-relevant="additions">{events.length?events.map((e,i)=><div className="event-row" key={`${e.time}-${e.name}-${i}`}><span className="event-avatar" style={{background:e.color}}><i/><i/></span><div><strong>{e.name}</strong><span>{e.type==='join'?'made an entrance':e.type==='catch'?'landed on your palm':e.type==='transfer'?'made the handoff':e.type==='save'?'made it home ✧':'will try again'}</span></div>{e.type==='save'?<Check size={14} className="lime"/>:<span className="event-time">{Math.floor(Math.max(0,world.time-e.time))}s</span>}</div>):<div className="empty-events"><Sparkles size={22}/><p>A little connection starts<br/>with the first catch.</p></div>}</div>{!identity&&<form className="demo-chat" onSubmit={submitDemo}><label htmlFor="rehearsal-chat">REHEARSAL CHAT</label><div><input id="rehearsal-chat" value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Type !join" maxLength={80}/><button type="submit" aria-label="Send rehearsal command"><ArrowRight size={17}/></button></div></form>}</section>
      </aside>}
    </div>
    {!stageOnly&&<footer><span><span className="footer-mark">✳</span> MADE FOR THE MOMENTS BETWEEN YOU & CHAT.</span><div><button onClick={()=>setModal('broadcast')}><Radio size={14}/> Broadcast setup</button><span className="footer-divider"/><span>Built with Codex</span></div></footer>}
    {notice&&<div className="toast" role="status"><Sparkles size={17}/>{notice}</div>}
    {error&&<div className="error-toast" role="alert"><div><strong>One thing needs attention</strong><span>{error}</span></div><button className="icon-button" aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}
    {modal==='twitch'&&<Modal title="Let your chat step inside." onClose={()=>setModal(null)}><p className="modal-lead">Fourth Wall listens for <code>!join</code> in your channel. Viewers stay on Twitch. Your camera stays on this device.</p>{!import.meta.env.VITE_TWITCH_CLIENT_ID&&<div className="setup-box"><strong>One-time Twitch application setup</strong><p>This deployment needs a Twitch Client ID before it can connect to real chat.</p><ol><li>Register an application in the <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer">Twitch developer console ↗</a>.</li><li>Set its OAuth redirect URL to <code>{location.origin}/</code>.</li><li>Choose a public client type, then paste the Client ID below. No client secret is needed.</li></ol><label htmlFor="client-id">Twitch Client ID</label><input id="client-id" autoComplete="off" value={clientId} onChange={e=>setClientId(e.target.value.trim())} placeholder="Your application’s public Client ID"/></div>}<button className="primary-button full" disabled={!clientId} onClick={()=>{try{startAuthorization(clientId);}catch(err){setError((err as Error).message);}}}><Twitch size={18}/> Continue to Twitch <ArrowRight size={16}/></button><p className="fine-print">Requests only permission to read chat. The session token stays in this browser tab and is cleared when you disconnect.</p></Modal>}
    {modal==='guide'&&<Modal title="A little guide to catching chat." onClose={()=>setModal(null)}><div className="guide-list"><div><span>01</span><section><h3>Start with the rehearsal</h3><p>Drag a glowing palm. Use <kbd>1</kbd> / <kbd>2</kbd> to select a hand, arrow keys to move, <kbd>Q</kbd> / <kbd>E</kbd> to tilt, and <kbd>0</kbd> to level. “Watch a handoff” runs a real physics demonstration.</p></section></div><div><span>02</span><section><h3>Bring your own hands</h3><p>Choose Your camera. Face an open palm toward the camera and keep your fingers visible. Good front lighting helps. The glowing line across your palm is the surface that catches visitors. Tilt the line steeply to let go.</p></section></div><div><span>03</span><section><h3>Catch, pass, rescue</h3><p>Drop a test viewer with <kbd>D</kbd>. Catch them, let them fall onto your other palm, then carry them into the green safe zone. <kbd>Space</kbd> pauses. Moving hands out of frame releases their visitors.</p></section></div></div><div className="settings-row"><label><input type="checkbox" checked={skeleton} onChange={e=>setSkeleton(e.target.checked)}/> Show hand tracking points</label><label><input type="checkbox" checked={autoDrop} onChange={e=>setAutoDrop(e.target.checked)}/> A test viewer every 5 seconds</label></div><button className="primary-button full" onClick={()=>{setModal(null);watchSequence();}}><Play size={16}/> Show me a handoff</button></Modal>}
    {modal==='broadcast'&&<Modal title="Ready for your close-up." onClose={()=>setModal(null)}><p className="modal-lead">For the prototype, capture the running browser window in OBS so your camera, Twitch connection, and game stay in one session.</p><div className="guide-list"><div><span>01</span><section><h3>Connect and frame up</h3><p>Connect Twitch, choose Your camera, and make sure both palms are tracked. Viewers enter with <code>!join</code>.</p></section></div><div><span>02</span><section><h3>Enter stage view</h3><p>This hides the studio controls. Add an OBS Window Capture for this browser and crop to the stage. Press Escape to return.</p></section></div></div><button className="primary-button full" onClick={()=>{setModal(null);setStageOnly(true);}}><Expand size={17}/> Enter stage view</button><button className="secondary-button full mt" onClick={()=>{void navigator.clipboard.writeText(location.origin+'/?stage=1').then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>setNotice('Clipboard is unavailable. The stage address is '+location.origin+'/?stage=1'));}}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Stage link copied':'Copy stage link'}</button><label className="transparent-option"><input type="checkbox" checked={transparent} onChange={e=>setTransparent(e.target.checked)}/><Layers2 size={14}/> Transparent canvas for separate compositing</label><p className="fine-print">A fresh OBS Browser Source has its own camera and sign-in session. Window Capture is the recommended path for this prototype. Camera frames are processed locally and are never sent to Fourth Wall servers.</p></Modal>}
    {stageOnly&&<button className="stage-exit" onClick={()=>setStageOnly(false)}><ChevronRight size={14}/> Back to studio</button>}
  </div>;
}
