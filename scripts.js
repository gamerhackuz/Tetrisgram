// ===================== AUDIO =====================
let audioCtx=null,musicGain=null,sfxGain=null;
let musicPlaying=false,melodyIdx=0,melodyTimer=null;
const MEL=[[659,200],[494,100],[523,100],[587,200],[523,100],[494,100],[440,200],[440,100],[523,100],[659,200],[587,100],[523,100],[494,200],[494,100],[523,100],[587,200],[659,200],[523,200],[440,200],[440,200],[587,200],[698,100],[880,200],[784,100],[698,100],[659,200],[659,100],[523,100],[659,200],[587,100],[523,100],[494,200],[494,100],[523,100],[587,200],[659,200],[523,200],[440,200],[440,200]];

function gCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function iAudio(){const c=gCtx();if(!musicGain){musicGain=c.createGain();musicGain.gain.value=.08;musicGain.connect(c.destination);}if(!sfxGain){sfxGain=c.createGain();sfxGain.gain.value=.3;sfxGain.connect(c.destination);}}
function pNote(f,d,g,t='square',v=.12){if(!audioCtx)return;const o=audioCtx.createOscillator(),gn=audioCtx.createGain();o.type=t;o.frequency.value=f;gn.gain.setValueAtTime(v,audioCtx.currentTime);gn.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d/1000);o.connect(gn);gn.connect(g);o.start();o.stop(audioCtx.currentTime+d/1000);}
function pMel(){if(!sett.music||!musicGain)return;const[f,d]=MEL[melodyIdx%MEL.length];const v=(sett.musicVol/100)*.1;pNote(f,d*.9,musicGain,'square',v);if(melodyIdx%2===0)pNote(f/2,d,musicGain,'triangle',v*.5);melodyIdx++;melodyTimer=setTimeout(pMel,d);}
function startMusic(){if(musicPlaying||!sett.music)return;musicPlaying=true;iAudio();pMel();}
function stopMusic(){musicPlaying=false;clearTimeout(melodyTimer);}
function sfx(t){
  if(!sett.sfx)return;iAudio();
  const v=(sett.sfxVol/100)*.4;
  if(t==='move')pNote(220,50,sfxGain,'square',v*.3);
  else if(t==='rotate')pNote(440,80,sfxGain,'sine',v*.4);
  else if(t==='drop'){pNote(150,120,sfxGain,'square',v*.6);setTimeout(()=>pNote(100,80,sfxGain,'square',v*.4),60);}
  else if(t==='clear')[523,659,784,1047].forEach((f,i)=>setTimeout(()=>pNote(f,100,sfxGain,'square',v),i*80));
  else if(t==='tetris')[523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>pNote(f,150,sfxGain,'square',v*1.2),i*60));
  else if(t==='lvlup')[400,500,600,800].forEach((f,i)=>setTimeout(()=>pNote(f,100,sfxGain,'square',v),i*70));
  else if(t==='go')[440,350,300,200,150].forEach((f,i)=>setTimeout(()=>pNote(f,200,sfxGain,'sawtooth',v*.8),i*120));
  else if(t==='land')pNote(180,80,sfxGain,'square',v*.4);
}

// ===================== SETTINGS =====================
let sett={music:true,sfx:true,musicVol:40,sfxVol:70,startLevel:1,ghost:true};
function applySettings(){
  sett.music=document.getElementById('set-music').checked;
  sett.sfx=document.getElementById('set-sfx').checked;
  sett.musicVol=+document.getElementById('set-mvol').value;
  sett.sfxVol=+document.getElementById('set-svol').value;
  sett.ghost=document.getElementById('set-ghost').checked;
  if(musicGain)musicGain.gain.value=sett.music?(sett.musicVol/100)*.1:0;
}
function setLvl(l){sett.startLevel=l;document.querySelectorAll('.lvl-btn').forEach(b=>b.classList.toggle('active',+b.dataset.l===l));}

// ===================== NAV =====================
function showScreen(n){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+n).classList.add('active');
  if(n==='menu'){document.getElementById('menu-hi').textContent=hiScore;stopGame();}
}

// ===================== TETRIS =====================
const COLS=10,ROWS=20;
let CELL=26;
const PIECES={
  I:{shape:[[1,1,1,1]],color:'#00d4ff',glow:'rgba(0,212,255,.6)'},
  O:{shape:[[1,1],[1,1]],color:'#ffcc00',glow:'rgba(255,204,0,.6)'},
  T:{shape:[[0,1,0],[1,1,1]],color:'#9b4dff',glow:'rgba(155,77,255,.6)'},
  S:{shape:[[0,1,1],[1,1,0]],color:'#00ff88',glow:'rgba(0,255,136,.6)'},
  Z:{shape:[[1,1,0],[0,1,1]],color:'#ff3366',glow:'rgba(255,51,102,.6)'},
  J:{shape:[[1,0,0],[1,1,1]],color:'#ff8800',glow:'rgba(255,136,0,.6)'},
  L:{shape:[[0,0,1],[1,1,1]],color:'#00aaff',glow:'rgba(0,170,255,.6)'}
};
const PK=Object.keys(PIECES);
const LS=[0,100,300,500,800];
const canvas=document.getElementById('game-canvas');
const ctx=canvas.getContext('2d');
const nc=document.getElementById('next-canvas');
const nCtx=nc.getContext('2d');
let board,cur,nxt,score,level,lines,hiScore=0,running=false,paused=false,dead=false;
let dropTmr,startT,elapsed=0;

function calcCell(){
  const topH=52,ctrlH=148,pad=14;
  const avH=window.innerHeight-topH-ctrlH-pad;
  const avW=window.innerWidth-8*2-72-8;
  const bH=Math.floor(avH/ROWS),bW=Math.floor(avW/COLS);
  CELL=Math.max(18,Math.min(bH,bW,30));
}
function resizeCanvas(){
  calcCell();
  canvas.width=COLS*CELL;canvas.height=ROWS*CELL;
}
function mkBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(null));}
function rndPiece(){
  const k=PK[Math.floor(Math.random()*PK.length)];
  const p=PIECES[k];
  return{shape:p.shape.map(r=>[...r]),color:p.color,glow:p.glow,x:Math.floor((COLS-p.shape[0].length)/2),y:0};
}
function rot(s){const r=s.length,c=s[0].length,R=Array.from({length:c},()=>Array(r).fill(0));for(let i=0;i<r;i++)for(let j=0;j<c;j++)R[j][r-1-i]=s[i][j];return R;}
function ok(s,x,y){for(let r=0;r<s.length;r++)for(let c=0;c<s[r].length;c++)if(s[r][c]){const nx=x+c,ny=y+r;if(nx<0||nx>=COLS||ny>=ROWS)return false;if(ny>=0&&board[ny][nx])return false;}return true;}

function place(){
  for(let r=0;r<cur.shape.length;r++)for(let c=0;c<cur.shape[r].length;c++)
    if(cur.shape[r][c]){const ny=cur.y+r;if(ny<0){endGame();return;}board[ny][cur.x+c]=cur.color;}
  sfx('land');clearLines();cur=nxt;nxt=rndPiece();drawNext();
  if(!ok(cur.shape,cur.x,cur.y))endGame();
}
function clearLines(){
  let cl=0;
  for(let r=ROWS-1;r>=0;r--){if(board[r].every(c=>c!==null)){board.splice(r,1);board.unshift(Array(COLS).fill(null));cl++;r++;}}
  if(cl>0){
    const pts=LS[cl]*level;score+=pts;lines+=cl;showSpop(pts,cl);
    if(cl===4)sfx('tetris');else sfx('clear');
    const nl=Math.floor(lines/10)+sett.startLevel;
    if(nl>level){level=nl;sfx('lvlup');showLvlUp();resetDrop();}
    if(score>hiScore){hiScore=score;localStorage.setItem('t-hi',hiScore);}
    updHUD();
  }
}
function ghostY(){let g=cur.y;while(ok(cur.shape,cur.x,g+1))g++;return g;}
function dropSpd(){return Math.max(80,800-(level-1)*80);}
function resetDrop(){clearInterval(dropTmr);dropTmr=setInterval(autoDown,dropSpd());}
function autoDown(){if(!running||paused||dead)return;if(ok(cur.shape,cur.x,cur.y+1))cur.y++;else place();draw();}

// RENDER
function dCell(cx,x,y,color,glow,a=1){
  const px=x*CELL,py=y*CELL;
  cx.globalAlpha=a;
  if(glow){cx.shadowColor=glow;cx.shadowBlur=8;}
  cx.fillStyle=color;cx.fillRect(px+1,py+1,CELL-2,CELL-2);
  cx.shadowBlur=0;
  const g=cx.createLinearGradient(px,py,px+CELL,py+CELL);
  g.addColorStop(0,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(0,0,0,.2)');
  cx.fillStyle=g;cx.fillRect(px+1,py+1,CELL-2,CELL-2);
  cx.fillStyle='rgba(255,255,255,.22)';cx.fillRect(px+1,py+1,CELL-2,3);
  cx.strokeStyle='rgba(255,255,255,.07)';cx.lineWidth=1;cx.strokeRect(px+1.5,py+1.5,CELL-3,CELL-3);
  cx.globalAlpha=1;cx.shadowBlur=0;
}
function draw(){
  ctx.fillStyle='#070b14';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(26,45,90,.35)';ctx.lineWidth=.5;
  for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(c*CELL,0);ctx.lineTo(c*CELL,ROWS*CELL);ctx.stroke();}
  for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*CELL);ctx.lineTo(COLS*CELL,r*CELL);ctx.stroke();}
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(board[r][c])dCell(ctx,c,r,board[r][c],null);
  if(!cur)return;
  if(sett.ghost){
    const gy=ghostY();
    for(let r=0;r<cur.shape.length;r++)for(let c=0;c<cur.shape[r].length;c++)
      if(cur.shape[r][c]){const px=(cur.x+c)*CELL,py=(gy+r)*CELL;ctx.strokeStyle=cur.color+'55';ctx.lineWidth=1;ctx.strokeRect(px+1.5,py+1.5,CELL-3,CELL-3);ctx.fillStyle=cur.color+'15';ctx.fillRect(px+2,py+2,CELL-4,CELL-4);}
  }
  for(let r=0;r<cur.shape.length;r++)for(let c=0;c<cur.shape[r].length;c++)
    if(cur.shape[r][c])dCell(ctx,cur.x+c,cur.y+r,cur.color,cur.glow);
}
function drawNext(){
  nCtx.clearRect(0,0,nc.width,nc.height);if(!nxt)return;
  const s=nxt.shape,cs=13;
  const ox=Math.floor((4-s[0].length)/2),oy=Math.floor((4-s.length)/2);
  for(let r=0;r<s.length;r++)for(let c=0;c<s[r].length;c++)
    if(s[r][c]){const px=(ox+c)*cs+4,py=(oy+r)*cs+6;nCtx.shadowColor=nxt.glow;nCtx.shadowBlur=5;nCtx.fillStyle=nxt.color;nCtx.fillRect(px,py,cs-1,cs-1);nCtx.shadowBlur=0;const g=nCtx.createLinearGradient(px,py,px+cs,py+cs);g.addColorStop(0,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(0,0,0,.18)');nCtx.fillStyle=g;nCtx.fillRect(px,py,cs-1,cs-1);}
}
function updHUD(){
  document.getElementById('sc').textContent=score.toLocaleString();
  document.getElementById('lv').textContent=level;
  document.getElementById('ln').textContent=lines;
  document.getElementById('hi').textContent=hiScore.toLocaleString();
}
function updTimer(){
  if(!running||paused||dead)return;
  const el=Math.floor((Date.now()-startT+elapsed)/1000);
  const m=String(Math.floor(el/60)).padStart(2,'0'),s=String(el%60).padStart(2,'0');
  document.getElementById('tm').textContent=m+':'+s;
  setTimeout(updTimer,500);
}
function showSpop(pts,cl){
  const p=document.createElement('div');p.className='score-popup';
  p.style.left=(Math.random()*120+10)+'px';p.style.top=(Math.random()*120+60)+'px';
  const lb=['','','DOUBLE!','TRIPLE!','TETRIS!!!'];
  p.textContent='+'+pts.toLocaleString()+(cl>1?' '+lb[cl]:'');
  if(cl===4)p.style.color='var(--yellow)';
  document.querySelector('.board-wrapper').appendChild(p);
  setTimeout(()=>p.remove(),1000);
}
function showLvlUp(){
  const el=document.createElement('div');el.className='lvlup';el.textContent='DARAJA '+level+'!';
  document.querySelector('.board-wrapper').appendChild(el);setTimeout(()=>el.remove(),1200);
}

// GAME CONTROL
function startGame(){
  resizeCanvas();
  board=mkBoard();score=0;level=sett.startLevel;lines=0;dead=false;paused=false;running=true;
  startT=Date.now();elapsed=0;
  hiScore=parseInt(localStorage.getItem('t-hi')||'0');
  cur=rndPiece();nxt=rndPiece();
  document.getElementById('go-ov').classList.remove('visible');
  document.getElementById('pause-ov').classList.remove('visible');
  showScreen('game');updHUD();drawNext();draw();resetDrop();updTimer();
  if(sett.music){stopMusic();startMusic();}
}
function stopGame(){running=false;clearInterval(dropTmr);stopMusic();}
function togglePause(){
  if(!running||dead)return;paused=!paused;
  if(paused){elapsed+=Date.now()-startT;document.getElementById('pause-ov').classList.add('visible');stopMusic();clearInterval(dropTmr);}
  else{startT=Date.now();document.getElementById('pause-ov').classList.remove('visible');startMusic();resetDrop();updTimer();}
}
function endGame(){
  running=false;dead=true;clearInterval(dropTmr);stopMusic();sfx('go');
  document.getElementById('fin-sc').textContent=score.toLocaleString();
  document.getElementById('fin-hi').textContent=hiScore.toLocaleString();
  document.getElementById('go-ov').classList.add('visible');
}
function exitToMenu(){
  stopGame();running=false;
  document.getElementById('pause-ov').classList.remove('visible');
  document.getElementById('go-ov').classList.remove('visible');
  showScreen('menu');
}

// KEYBOARD
let dasT=null,dasI=false;
const DAS=150,ARR=50;
document.addEventListener('keydown',e=>{
  if(!running||dead)return;
  if(e.key==='Escape'){exitToMenu();return;}
  if(e.key==='p'||e.key==='P'){togglePause();return;}
  if(paused)return;
  switch(e.key){
    case'ArrowLeft':e.preventDefault();mH(-1);sDAS(-1);break;
    case'ArrowRight':e.preventDefault();mH(1);sDAS(1);break;
    case'ArrowDown':e.preventDefault();if(ok(cur.shape,cur.x,cur.y+1)){cur.y++;score+=1;updHUD();draw();}break;
    case'ArrowUp':e.preventDefault();doRot();break;
    case' ':e.preventDefault();hDrop();break;
  }
});
document.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight')eDAS();});
function mH(d){if(!running||paused||dead)return;if(ok(cur.shape,cur.x+d,cur.y)){cur.x+=d;sfx('move');draw();}}
function doRot(){
  if(!running||paused||dead)return;
  const r=rot(cur.shape);
  if(ok(r,cur.x,cur.y)){cur.shape=r;sfx('rotate');}
  else if(ok(r,cur.x-1,cur.y)){cur.shape=r;cur.x--;sfx('rotate');}
  else if(ok(r,cur.x+1,cur.y)){cur.shape=r;cur.x++;sfx('rotate');}
  draw();
}
function sDrop(){if(!running||paused||dead)return;if(ok(cur.shape,cur.x,cur.y+1)){cur.y++;score+=1;updHUD();draw();}}
function hDrop(){if(!running||paused||dead)return;let d=0;while(ok(cur.shape,cur.x,cur.y+1)){cur.y++;d++;}score+=d*2;updHUD();sfx('drop');place();draw();}
function sDAS(d){clearTimeout(dasT);eDAS();dasT=setTimeout(()=>{dasI=setInterval(()=>mH(d),ARR);},DAS);}
function eDAS(){clearTimeout(dasT);clearInterval(dasI);dasI=false;}

// TOUCH BUTTONS
function mkHoldBtn(id,onTap,repeat=true,ms=80){
  const el=document.getElementById(id);if(!el)return;
  let iv=null;
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();el.classList.add('pressed');
    onTap();
    if(repeat)iv=setInterval(onTap,ms);
  },{passive:false});
  const up=()=>{el.classList.remove('pressed');clearInterval(iv);iv=null;};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);
}
function mkTapBtn(id,onTap){
  const el=document.getElementById(id);if(!el)return;
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('pressed');onTap();},{passive:false});
  const up=()=>el.classList.remove('pressed');
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);
}

mkHoldBtn('btn-left',()=>mH(-1),true,50);
mkHoldBtn('btn-right',()=>mH(1),true,50);
mkHoldBtn('btn-down',sDrop,true,80);
mkTapBtn('btn-rotate',doRot);
mkTapBtn('btn-drop',hDrop);

// Swipe to rotate on canvas
let tSX=0,tSY=0,tST=0;
canvas.addEventListener('touchstart',e=>{e.preventDefault();tSX=e.touches[0].clientX;tSY=e.touches[0].clientY;tST=Date.now();},{passive:false});
canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  const dx=e.changedTouches[0].clientX-tSX,dy=e.changedTouches[0].clientY-tSY,dt=Date.now()-tST;
  if(Math.abs(dx)<15&&Math.abs(dy)<15&&dt<200)doRot();
},{passive:false});

// Resize
window.addEventListener('resize',()=>{if(running){resizeCanvas();draw();}});

// INIT
hiScore=parseInt(localStorage.getItem('t-hi')||'0');
document.getElementById('menu-hi').textContent=hiScore;

function spawnP(){
  const p=document.createElement('div');p.className='particle';
  const c=['var(--blue)','var(--purple)','var(--green)','var(--yellow)'];
  p.style.background=c[Math.floor(Math.random()*c.length)];
  p.style.left=Math.random()*100+'vw';p.style.top=Math.random()*100+'vh';
  p.style.animationDuration=(3+Math.random()*3)+'s';
  document.body.appendChild(p);setTimeout(()=>p.remove(),6000);
}
setInterval(spawnP,700);