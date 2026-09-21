'use strict';
// Original procedural score: pentatonic plucked tones, distant bells and soft wind.
(function(){
 const STORE='palace:audio:v1';
 const NOTES=[146.83,174.61,196,220,261.63,293.66,349.23,392,440,523.25];
 const MELODY=[0,null,4,3,null,2,1,null,0,null,5,4,null,2,null,1];
 let ctx=null,master=null,bus=null,drone=null,analyser=null;
 let muted=false,started=false,tense=false,paused=false,failed=false;
 let timer=0,beat=0,nextNote=0,nextBell=8,nextPulse=0,voices=0;
 try{const p=JSON.parse(localStorage.getItem(STORE));if(typeof p?.muted==='boolean')muted=p.muted;}catch(e){/* Preference storage is optional. */}
 function updateButton(){
  document.querySelectorAll('[data-music-toggle]').forEach(b=>{
   b.textContent=failed?'音乐不可用':muted?'♪ 静音':'♪ 音乐';
   b.setAttribute('aria-pressed',String(!muted));
   b.setAttribute('aria-label',failed?'背景音乐暂不可用':muted?'开启背景音乐':'关闭背景音乐');
   b.title=failed?'音频未能启动，可点击重试':muted?'点击开启配乐':'点击静音；音量请使用设备音量键';
  });
 }
 function ramp(param,value,time=.5){const t=ctx.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value,t);param.linearRampToValueAtTime(value,t+time);}
 function outputGain(){return muted||paused?0:.32;}
 function noiseBuffer(seconds){const b=ctx.createBuffer(1,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b;}
 function build(){
  master=ctx.createGain();master.gain.value=0;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=20;comp.ratio.value=5;
  analyser=ctx.createAnalyser();analyser.fftSize=2048;
  master.connect(comp);comp.connect(analyser);analyser.connect(ctx.destination);
  bus=ctx.createGain();const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2600;bus.connect(lp);lp.connect(master);
  // Soft echo, with stable feedback below unity.
  const delay=ctx.createDelay(2),feedback=ctx.createGain(),wet=ctx.createGain();delay.delayTime.value=.47;feedback.gain.value=.23;wet.gain.value=.20;
  bus.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(master);
  drone=ctx.createGain();drone.gain.value=tense?.065:.04;drone.connect(master);
  for(const [freq,level] of [[73.415,.4],[110,.22],[147.0,.1]]){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=freq;g.gain.value=level;o.connect(g);g.connect(drone);o.start();}
  const noise=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),wind=ctx.createGain();noise.buffer=noiseBuffer(4);noise.loop=true;bp.type='bandpass';bp.frequency.value=420;bp.Q.value=1.4;wind.gain.value=.045;noise.connect(bp);bp.connect(wind);wind.connect(master);noise.start();
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.08;lg.gain.value=160;lfo.connect(lg);lg.connect(bp.frequency);lfo.start();
 }
 function tone(freq,amp,duration,type='sine',offset=0){
  const t=ctx.currentTime+offset,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.012);g.gain.exponentialRampToValueAtTime(.00005,t+duration);o.connect(g);g.connect(bus);voices++;o.onended=()=>{o.disconnect();g.disconnect();voices--;};o.start(t);o.stop(t+duration+.04);
 }
 function pluck(index){const f=NOTES[index];tone(f,tense?.15:.12,2.7,'triangle');tone(f*2.005,.025,1.4);}
 function bell(){for(const [mul,amp] of [[1,.05],[2.01,.018],[3.01,.009],[4.8,.004]])tone(196*mul,amp,7);}
 function pulse(){tone(58,.12,.20);tone(49,.075,.20,'sine',.22);}
 function schedule(){
  clearTimeout(timer);timer=0;
  if(!ctx||ctx.state!=='running'||muted||paused||document.hidden)return;
  const t=ctx.currentTime;
  if(t>=nextNote){const n=MELODY[beat++%MELODY.length];if(n!==null)pluck(n);nextNote=t+(tense?.70:1.75);}
  if(t>=nextBell){if(!tense)bell();nextBell=t+18;}
  if(tense&&t>=nextPulse){pulse();nextPulse=t+.84;}
  timer=setTimeout(schedule,120);
 }
 function reportFailure(){failed=true;clearTimeout(timer);timer=0;updateButton();}
 async function start(){
  if(muted){updateButton();return;}
  try{
   if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){reportFailure();return;}ctx=new AC();build();}
   started=true;
   if(document.hidden||paused)return;
   // Called inside a user click; browsers must not autoplay on initial load.
   if(ctx.state!=='running')await ctx.resume();
   failed=false;ramp(master.gain,outputGain(),1.2);schedule();updateButton();
  }catch(e){reportFailure();}
 }
 function setMuted(value){muted=!!value;try{localStorage.setItem(STORE,JSON.stringify({muted}));}catch(e){/* Non-persistent audio preferences do not affect gameplay. */}if(ctx)ramp(master.gain,outputGain(),.25);if(muted){clearTimeout(timer);timer=0;}else start();updateButton();}
 function setTense(value){value=!!value;if(value===tense)return;tense=value;if(ctx){ramp(drone.gain,tense?.065:.04,1);nextNote=Math.min(nextNote,ctx.currentTime+.25);nextPulse=ctx.currentTime+.1;schedule();}}
 function setPaused(value){value=!!value;if(value===paused)return;paused=value;if(!ctx)return;ramp(master.gain,outputGain(),.3);if(paused){clearTimeout(timer);timer=0;}else if(started)start();}
 function getStatus(){let peak=0;if(analyser){const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);for(const v of data)peak=Math.max(peak,Math.abs(v));}return {started,muted,tense,paused,failed,state:ctx?.state??'not-started',voices,timerActive:!!timer,peak};}
 window.PalaceAudio={start,setMuted,setTense,setPaused,isMuted:()=>muted,getStatus};
 document.querySelectorAll('[data-music-toggle]').forEach(b=>b.addEventListener('click',()=>{if(!started&&!muted||failed){start();}else setMuted(!muted);}));
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden){clearTimeout(timer);timer=0;ctx.suspend().catch(reportFailure);}else if(started&&!muted&&!paused)start();});
 updateButton();
})();
