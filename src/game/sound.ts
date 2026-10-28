export class Sound {
  enabled = false;
  private context?: AudioContext;
  async enable() { this.context ??= new AudioContext(); await this.context.resume(); this.enabled=true; }
  play(kind:'catch'|'transfer'|'save') {
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const ctx=this.context;
    const notes=kind==='save'?[523,659,784]:kind==='transfer'?[440,659]:[330];
    notes.forEach((frequency,i)=>{const oscillator=ctx.createOscillator();const gain=ctx.createGain();const start=ctx.currentTime+i*.09;oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.035,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+.2);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.22);});
  }
  close(){void this.context?.close();}
}
