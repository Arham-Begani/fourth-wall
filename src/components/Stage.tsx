import { useEffect, useRef } from 'react';
import { HEIGHT, WIDTH, STEP, center, clamp } from '../game/engine';
import type { World } from '../game/engine';
import { render } from '../game/render';
import { asPalms, demoSequence, initialHands } from '../game/demo';
import type { CameraTracker } from '../tracking/camera';
export type Stats = { catches: number; transfers: number; saved: number; missed: number; active: number; hands: number; fps: number; latency: number };
type Props = { world: World; mode: 'demo' | 'camera'; camera: CameraTracker | null; paused: boolean; sequence: number; resetKey: number; skeleton: boolean; selected: number; onSelect: (value: number) => void; onStats: (stats: Stats) => void; onSequenceEnd: () => void; transparent: boolean };
export function Stage(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(props); live.current = props;
  const demo = useRef(initialHands());
  const scripted = useRef(false), scriptTime = useRef(0);
  const dragging = useRef(false);
  const pressed = useRef(new Set<string>());
  useEffect(() => { demo.current = initialHands(); scripted.current = false; }, [props.resetKey]);
  useEffect(() => {
    if (!props.sequence) return;
    scripted.current = true; scriptTime.current = 0;
    props.world.reset(); demo.current = demoSequence(props.world,0); props.world.setHands(asPalms(demo.current)); props.world.spawn('noodleboy');
  }, [props.sequence, props.world]);
  useEffect(() => {
    const node = canvas.current!; const ctx = node.getContext('2d', { alpha: true })!;
    let frame = 0, last = performance.now(), accumulator = 0, tick = 0, frames = 0, statsTime = last;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (now: number) => {
      const state = live.current;
      const elapsed = Math.min((now-last)/1000,.05); last=now; frames++;
      if (!state.paused && !document.hidden) {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          if(state.mode === 'demo') {
            if(scripted.current) {
              scriptTime.current += STEP; demo.current = demoSequence(state.world,scriptTime.current);
              if(scriptTime.current>7.5){scripted.current=false;state.onSequenceEnd();}
            } else {
              const h=demo.current[state.selected];const speed=260*STEP;
              if(pressed.current.has('ArrowLeft'))h.x-=speed;
              if(pressed.current.has('ArrowRight'))h.x+=speed;
              if(pressed.current.has('ArrowUp'))h.y-=speed;
              if(pressed.current.has('ArrowDown'))h.y+=speed;
              if(pressed.current.has('q'))h.tilt-=STEP;
              if(pressed.current.has('e'))h.tilt+=STEP;
              h.x=clamp(h.x,110,WIDTH-110);h.y=clamp(h.y,160,HEIGHT-100);h.tilt=clamp(h.tilt,-1.3,1.3);
            }
            state.world.setHands(asPalms(demo.current));
          } else state.world.setHands(state.camera?.getHands() ?? []);
          state.world.step(STEP);accumulator-=STEP;
        }
      } else accumulator=0;
      render(ctx,state.world,{mode:state.mode,video:state.camera?.video,selected:state.selected,skeleton:state.skeleton,paused:state.paused,transparent:state.transparent,reducedMotion});
      if(now-tick>250) {
        const w=state.world;
        state.onStats({catches:w.catches,transfers:w.transfers,saved:w.saved,missed:w.missed,active:w.visitors.length,hands:w.hands.length,fps:Math.round(frames*1000/Math.max(1,now-statsTime)),latency:Math.round(state.camera?.latency??0)});
        frames=0;statsTime=now;tick=now;
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    const release=()=>{pressed.current.clear();dragging.current=false;};
    window.addEventListener('blur',release);
    document.addEventListener('visibilitychange',release);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',release);};
  }, []);
  const locate=(event:React.PointerEvent)=>{const rect=canvas.current!.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width*WIDTH,y:(event.clientY-rect.top)/rect.height*HEIGHT};};
  return <canvas ref={canvas} width={WIDTH} height={HEIGHT} tabIndex={0} aria-label="Interactive palm-catching stage. In rehearsal, drag a palm or use arrow keys. Press 1 or 2 to select a hand, Q or E to tilt." data-testid="game-stage"
    onPointerDown={event=>{
      if(props.mode!=='demo')return;
      canvas.current!.focus();const point=locate(event);const hands=asPalms(demo.current);
      const distances=hands.map(h=>Math.hypot(center(h).x-point.x,center(h).y-point.y));
      const index=distances[0]<=distances[1]?0:1;props.onSelect(index);live.current.selected=index;
      dragging.current=true;scripted.current=false;props.onSequenceEnd();canvas.current!.setPointerCapture(event.pointerId);
      demo.current[index].x=clamp(point.x,110,WIDTH-110);demo.current[index].y=clamp(point.y,160,HEIGHT-100);
    }}
    onPointerMove={event=>{if(!dragging.current||props.mode!=='demo')return;const point=locate(event);const hand=demo.current[live.current.selected];hand.x=clamp(point.x,110,WIDTH-110);hand.y=clamp(point.y,160,HEIGHT-100);}}
    onPointerUp={()=>{dragging.current=false;}} onPointerCancel={()=>{dragging.current=false;}}
    onKeyDown={event=>{
      if(props.mode!=='demo')return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','q','e'].includes(event.key)){event.preventDefault();scripted.current=false;props.onSequenceEnd();pressed.current.add(event.key);}
      if(event.key==='1'||event.key==='2')props.onSelect(Number(event.key)-1);
      if(event.key==='0')demo.current[props.selected].tilt=0;
    }} onKeyUp={event=>pressed.current.delete(event.key)} onBlur={()=>pressed.current.clear()}
  >Your browser needs canvas support to play Fourth Wall.</canvas>;
}
