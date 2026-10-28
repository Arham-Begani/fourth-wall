import { HEIGHT, WIDTH, center } from './engine';
import type { World, Palm, Visitor } from './engine';
type RenderOptions = { video?: HTMLVideoElement; mode: 'demo' | 'camera'; selected: number; skeleton: boolean; paused: boolean; transparent: boolean; reducedMotion: boolean };
const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
let backdrop: HTMLCanvasElement | null = null;
function background() {
  if (backdrop) return backdrop;
  backdrop = document.createElement('canvas'); backdrop.width=WIDTH; backdrop.height=HEIGHT;
  const ctx=backdrop.getContext('2d')!;
  const bg=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);bg.addColorStop(0,'#182623');bg.addColorStop(.6,'#14201e');bg.addColorStop(1,'#1b2223');ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
  const glow=ctx.createRadialGradient(530,320,10,530,320,550);glow.addColorStop(0,'#39523a27');glow.addColorStop(1,'#14201e00');ctx.fillStyle=glow;ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle='#8cab9b19';for(let x=25;x<WIDTH;x+=30)for(let y=25;y<HEIGHT;y+=30)ctx.fillRect(x,y,1.3,1.3);
  return backdrop;
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 13, color = '#97a9aa', align: CanvasTextAlign = 'left') { ctx.font = `500 ${size}px "IBM Plex Mono", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); }
function drawVisitor(ctx: CanvasRenderingContext2D, v: Visitor, time: number) {
  ctx.save(); ctx.translate(v.x, v.y);
  const angle = v.hand ? 0 : Math.max(-.3, Math.min(.3, v.vx / 300)); ctx.rotate(angle);
  ctx.scale(1 + v.squash * .3, 1 - v.squash * .25);
  ctx.shadowColor = `${v.color}55`; ctx.shadowBlur = 22;
  ctx.fillStyle = v.color; rounded(ctx, -18, -23, 36, 39, 15); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#17221e'; rounded(ctx, -12, 12, 8, 6, 3); ctx.fill(); rounded(ctx, 4, 12, 8, 6, 3); ctx.fill();
  ctx.fillStyle = '#fbfff3'; rounded(ctx, -12, -13, 24, 17, 8); ctx.fill();
  const blink = Math.sin(time * 1.8 + v.name.length) > .995;
  ctx.fillStyle = '#17221e'; ctx.beginPath(); ctx.ellipse(-5, -5, 2.2, blink ? .7 : 3.5, 0, 0, Math.PI * 2); ctx.ellipse(5, -5, 2.2, blink ? .7 : 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = v.color; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-23, v.hand ? 5 : -7); ctx.moveTo(17, 0); ctx.lineTo(23, v.hand ? 5 : -7); ctx.stroke();
  ctx.restore();
  ctx.font = '500 12px "IBM Plex Mono", monospace'; const labelWidth = ctx.measureText(v.name).width + 18;
  ctx.fillStyle = '#101916d9'; rounded(ctx, v.x - labelWidth / 2, v.y - 47, labelWidth, 21, 6); ctx.fill();
  text(ctx, v.name, v.x, v.y - 32, 12, '#e8f0e8', 'center');
}
function drawHand(ctx: CanvasRenderingContext2D, h: Palm, i: number, selected: boolean, skeleton: boolean, time: number) {
  const c = center(h), width = h.b.x - h.a.x;
  const color = i === 0 ? '#c9f66b' : '#9baaff';
  if (h.source === 'demo') {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.atan2(h.b.y - h.a.y, width));
    ctx.fillStyle = i === 0 ? '#c9f66b09' : '#9baaff09'; ctx.strokeStyle = i === 0 ? '#c9f66b36' : '#9baaff36'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-width / 2, 5); ctx.bezierCurveTo(-width / 2 - 30, 20, -width / 2 - 24, 34, -width / 2 + 6, 35);
    ctx.lineTo(-30, 35); ctx.bezierCurveTo(-15, 60, -10, 105, 6, 128); ctx.lineTo(70, 128); ctx.lineTo(51, 55);
    ctx.bezierCurveTo(84, 42, width / 2 + 30, 9, width / 2 - 2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-58, 18); ctx.lineTo(42, 18); ctx.moveTo(-43, 27); ctx.lineTo(32, 27); ctx.stroke();
    ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(6, 128); ctx.lineTo(43, 270); ctx.moveTo(70, 128); ctx.lineTo(112, 270); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    text(ctx, `PALM 0${i + 1}`, c.x, c.y + 170, 12, color, 'center');
    text(ctx, selected ? 'DRAG TO MOVE  ·  Q / E TO TILT' : 'CLICK TO SELECT', c.x, c.y + 191, 10, '#6b807c', 'center');
  }
  if (skeleton && h.landmarks) {
    const links = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
    ctx.strokeStyle = `${color}70`; ctx.lineWidth = 1.5;
    for (const chain of links) { ctx.beginPath(); chain.forEach((index,j) => { const p = h.landmarks![index]; if(j) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); }); ctx.stroke(); }
    ctx.fillStyle = color; for (const p of h.landmarks) { ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill(); }
  }
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = selected ? 20 : 10; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(h.a.x,h.a.y); ctx.lineTo(h.b.x,h.b.y); ctx.stroke(); ctx.shadowBlur = 0;
  for (const p of [h.a,h.b]) { ctx.fillStyle = '#15221e'; ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth=2; ctx.stroke(); }
  if (h.source === 'camera') text(ctx, `0${i + 1}`, c.x,c.y + 27,12,color,'center');
  ctx.globalAlpha = .3 + Math.sin(time * 3) * .1; ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(c.x,c.y+4,width/2,11,Math.atan2(h.b.y-h.a.y,width),0,Math.PI*2); ctx.stroke(); ctx.restore();
}
export function render(ctx: CanvasRenderingContext2D, world: World, options: RenderOptions) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const time = options.reducedMotion ? 0 : world.time;
  if (!options.transparent) {
    ctx.drawImage(background(),0,0);
    if (options.video && options.video.readyState >= 2) {
      const video = options.video; const scale = Math.min(WIDTH / video.videoWidth, HEIGHT / video.videoHeight); const w = video.videoWidth * scale,h = video.videoHeight * scale;
      ctx.save(); ctx.translate(WIDTH,0); ctx.scale(-1,1); ctx.drawImage(video,(WIDTH-w)/2,(HEIGHT-h)/2,w,h); ctx.restore();
      ctx.fillStyle='#0b15121a';ctx.fillRect(0,0,WIDTH,HEIGHT);
    } else {
      text(ctx,'A LITTLE CLOSER TO YOUR COMMUNITY',38,51,11,'#768f82');
      text(ctx,'REHEARSAL / SIMULATED HANDS',38,73,10,'#4c645b');
    }
    const bottom = ctx.createLinearGradient(0,635,0,720); bottom.addColorStop(0,'#e68d5c00'); bottom.addColorStop(1,'#bd624f1a');ctx.fillStyle=bottom;ctx.fillRect(0,635,WIDTH,85);
    ctx.strokeStyle='#b7826c38';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=WIDTH;x+=8){const y=701+Math.sin(x/75+time)*3;if(x)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();
    text(ctx,'CATCH THEM BEFORE THEY FALL',WIDTH/2,688,10,'#8b8b77','center');
  }
  const portal = world.portal;
  ctx.save();ctx.translate(portal.x,portal.y);
  const halo = ctx.createRadialGradient(0,0,15,0,0,100);halo.addColorStop(0,'#c9f66b18');halo.addColorStop(1,'#c9f66b00');ctx.fillStyle=halo;ctx.fillRect(-100,-100,200,200);
  ctx.strokeStyle='#c9f66b35';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,57,0,Math.PI*2);ctx.stroke();
  ctx.rotate(time*.2);ctx.setLineDash([8,12]);ctx.strokeStyle='#c9f66b85';ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.rotate(-time*.2);
  ctx.strokeStyle='#c9f66b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-12,5);ctx.lineTo(0,-7);ctx.lineTo(12,5);ctx.moveTo(0,-7);ctx.lineTo(0,15);ctx.stroke();
  text(ctx,'SAFE ZONE',0,-76,11,'#c9f66b','center');text(ctx,'BRING THEM HOME',0,84,9,'#809477','center');ctx.restore();
  world.hands.forEach((hand,i)=>drawHand(ctx,hand,i,options.selected===i,options.skeleton,time));
  for(const visitor of world.visitors) drawVisitor(ctx,visitor,time);
  if(!options.reducedMotion) for(const p of world.particles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;ctx.fillRect(p.x-2,p.y-2,4,4);}ctx.globalAlpha=1;
  const recent=world.events.find(e=>(e.type==='transfer'||e.type==='save') && world.time-e.time<1.8);
  if(recent){const age=world.time-recent.time;ctx.globalAlpha=Math.min(1,(1.8-age)*2);text(ctx,recent.type==='transfer'?'NICE HANDOFF!':`${recent.name.toUpperCase()} IS HOME`,WIDTH/2,135,22,recent.color,'center');ctx.globalAlpha=1;}
  if(options.paused){ctx.fillStyle='#101713a8';ctx.fillRect(0,0,WIDTH,HEIGHT);text(ctx,'TAKE A BREATH.',WIDTH/2,HEIGHT/2,25,'#e4e9dd','center');text(ctx,'Press Space or Resume to continue',WIDTH/2,HEIGHT/2+35,12,'#a5b59e','center');}
}
