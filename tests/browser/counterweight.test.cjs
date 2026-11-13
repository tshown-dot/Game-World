// Counterweight (4-2, the action game): every zone through the real controls (operation keys, the amount dial,
// level/tips), each kind of mistake and what it costs, the beam as a timer, the hint card, practice, fail and retry,
// town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/counterweight'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-2-counterweight/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing (balance.js made the round, so it knows the answer).
const st=(p)=>p.evaluate(async()=>{ const m=await import('./balance.js'); const f=window.__scale, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden'), txt=(s)=>(document.querySelector(s)||{}).textContent||'';
  const hit=(r.hits||[])[Math.min(W.step,(r.hits||[1]).length-1)]||null;
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, curtain:!!r.curtain, hits:(r.hits||[]).map(h=>({...h})), step:W.step, frozen:W.frozen, tries:W.tries,
    hop:hit?hit.op:null, hn:hit?hit.n:null, side:r.side, other:r.other, op:W.op, num:W.n, t:W.t, seconds:r.seconds, angle:W.angle, level:r.level, kind:r.kind, sop:r.op, sn:r.n, x:r.x, inv:r.op?m.INVERSE[r.op]:null,
    left:txt('#panL .ptext'), right:txt('#panR .ptext'), was:txt('#panL .pwas')+txt('#panR .pwas'), mine:document.querySelectorAll('.pan.mine').length, mineId:(document.querySelector('.pan.mine')||{}).id||'',
    burst:[...document.querySelectorAll('.burst:not(.hidden)')].map(b=>b.textContent).join('|'), stamp:txt('#stamp'), stampOn:document.getElementById('stamp').classList.contains('show'), clamp:vis('clamp'), clampText:txt('#clamp'), before:vis('before')?txt('#before'):'', move:txt('#moveVal'),
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes},
    sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent, line:document.getElementById('cline').textContent }; });
let RATE=1; const speed=(p,x)=>{ RATE=x; return p.evaluate((v)=>{ window.__scale.W.speed=v; },x); };
// The test runs the game sped up, so it stops the clock while it works the controls (a student has 10 seconds a pan).
const hold=(p)=>p.evaluate(()=>{ window.__scale.W.speed=0; }), go=(p)=>p.evaluate((v)=>{ window.__scale.W.speed=v; },RATE);
const PH=['match','solve','inspect'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__scale.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__scale, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__scale.W.frozen,null,{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ keys:0, taps:0 };
const byKey=()=>{ const k=used.keys<=used.taps; if(k) used.keys++; else used.taps++; return k; };
const OPKEY={ '+':'+', '-':'-', '×':'*', '÷':'/' };
/** Choose an operation and an amount: by the keyboard (operation key, then type the number), or by tapping the buttons and the dial. */
async function setMove(p,op,n){
  if(byKey()){ await p.keyboard.press(OPKEY[op]); for(const d of String(n)) await p.keyboard.press(d); }
  else { await p.click(`[data-op="${op}"]`); const s=await st(p); for(let i=0;i<Math.abs(n-s.num);i++) await p.click(`[data-n="${n<s.num?-1:1}"]`); }
  const t=await st(p); return t.op===op && t.num===n; }
/** One move in a match or solve round. Returns when the game has reacted. */
async function move(p,op,n){ await hold(p); const s=await st(p), set=await setMove(p,op,n);
  if(used.keys%2) await p.click('#goBtn'); else await p.keyboard.press('Enter');
  await go(p); await p.waitForFunction(([r,k])=>{ const W=window.__scale.W; return W.frozen || W.phase==='gap' || W.ri!==r || W.phase==='idle' || (W.phase==='match' && W.step!==k); },[s.ri,s.step],{timeout:30000}); return set; }
async function call(p,level){ await hold(p); const s=await st(p); if(byKey()) await p.keyboard.press(level?'ArrowUp':'ArrowDown'); else await p.click(`[data-says="${level?'level':'tips'}"]`);
  await go(p); await p.waitForFunction(([r])=>{ const W=window.__scale.W; return W.frozen || W.phase==='gap' || W.ri!==r || W.phase==='idle'; },[s.ri],{timeout:30000}); }
let setOk=true;
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='match'){ for(let k=0;k<s.hits.length;k++) setOk=(await move(p,s.hits[k].op,s.hits[k].n))&&setOk; }
  else if(s.type==='solve') setOk=(await move(p,s.inv,s.sn))&&setOk;
  else await call(p,s.level);
}
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function open(p,{zone=0,practice=false,fast=5}={}){
  await p.goto(URL,{waitUntil:'load'});
  if(zone) await p.click(`[data-zone="${zone}"]`);
  if(practice) await p.click('#practiceBtn'); else await p.keyboard.press('Enter');
  await speed(p,fast); await ready(p);
}
const total=(m)=>Object.values(m).reduce((a,c)=>a+c,0);
const SIGN={ '+':'+', '-':'−', '×':'×', '÷':'÷' }, INV={ '+':'-', '-':'+', '×':'÷', '÷':'×' };
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(16).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type into: the scale is the playfield');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const kinds=new Set(), shots=new Set(), props=new Set();
  for(let guard=0;guard<60;guard++){
    await hold(p); const s=await st(p); if(s.report){ break; }
    const kind=s.type==='match'?(s.curtain?'curtain':s.hits.length===2?'two':'match'):s.type; kinds.add(kind);
    const name=`${s.zone+2}_${kind}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,s); rounds++; const t=await st(p); if(t.stamp) props.add(t.stamp.split(' ')[0]);
    if(!shots.has(name+'_done')){ shots.add(name+'_done'); await p.screenshot({path:`${OUT}/${name}_done.png`}); }
    await nextRound(p,s);
  }
  await go(p); await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__scale.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['match','solve','inspect','two','curtain'].every(k=>kinds.has(k)),'every kind of round appeared: '+[...kinds].join(', '));
  ok(['ADDITION','SUBTRACTION','MULTIPLICATION','DIVISION'].every(k=>props.has(k)),'each save stamped its property of equality: '+[...props].join(', '));
  ok(setOk,'every operation and amount was set through the controls');
  ok(used.keys>=15&&used.taps>=15,`played by keys (${used.keys}) and by tapping (${used.taps})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no shake ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=38 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Steady hands: the saboteur hits one pan');
  await open(p,{fast:1}); let s=await st(p);
  ok(s.type==='match' && s.burst===`${SIGN[s.hop]} ${s.hn}` && s.mine===1 && s.mineId===(s.other==='left'?'panL':'panR') && (s.side==='left'?s.left:s.right).endsWith(s.burst),'a burst shows what was done to one pan, and the other pan is lit: '+s.left+' | '+s.right+' ['+s.burst+']');
  await p.waitForTimeout(1500); let t=await st(p); const down=(s.hop==='+')===(s.side==='right')?1:-1;
  ok(Math.abs(t.angle)>0.8 && Math.sign(t.angle)===down && t.angle!==0,'the beam is tipping toward the heavier pan ('+t.angle.toFixed(1)+'°)'); await p.screenshot({path:OUT+'/3_tipping.png'});
  await hold(p); await p.keyboard.press('Enter'); ok(/Choose/.test((await st(p)).line) && (await st(p)).bad===0,'pressing Enter with no operation only nudges'); await speed(p,5);
  await move(p,INV[s.hop],s.hn); await p.waitForTimeout(500); t=await st(p); let msg=await p.textContent('#calloutText');
  ok(t.bad===1 && t.meter===25 && t.mistakes.undid===1 && /OPPOSITE/.test(msg) && Math.abs(t.angle)>10,'undoing instead of matching: the pan shows it and the beam drops ('+t.angle.toFixed(1)+'°): '+msg.slice(0,90)); await p.screenshot({path:OUT+'/3b_undid.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='match' && (s.other==='left'?t.left:t.right)===(s.other==='left'?s.left:s.right) && t.t<2,'TRY AGAIN puts the pan back and restarts the beam');
  await move(p,s.hop,s.hn+1); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.amount===1 && msg.includes(`Do ${SIGN[s.hop]} ${s.hn} to this pan too`),'two misses: the move is given: '+msg.slice(-40)); await carryOn(p); await nextRound(p,s);
  s=await st(p); await speed(p,8); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes.too_slow===1 && /Too slow/.test(msg),'a pan that reaches the ground costs too: '+msg.slice(0,70)); await speed(p,2); await p.keyboard.press('Enter');
  await move(p,s.hop,s.hn); t=await st(p); ok(t.phase==='gap' && t.stampOn && /PROPERTY OF EQUALITY/.test(t.stamp),'matched: the property is stamped on the scale: '+t.stamp); await p.screenshot({path:OUT+'/3c_stamp.png'});
  await p.waitForTimeout(400); ok(Math.abs((await st(p)).angle)<1.5,'and the beam comes back level');

  console.log('\n[4] Heavy lifting');
  await open(p,{zone:1}); s=await st(p); ok(s.hop==='×' && /×/.test(s.burst),'started at zone 2: a whole pan is multiplied: '+s.burst);
  await move(p,'+',s.hn); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.mixed_ops===1 && /is not the same as/.test(msg),'adding the number instead of multiplying by it: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/4_mixed.png'});
  await p.keyboard.press('Enter'); await move(p,s.hop,s.hn); ok((await st(p)).phase==='gap','multiplying the other pan levels it');

  console.log('\n[5] Your move');
  await open(p,{zone:2}); s=await st(p); ok(s.type==='solve' && s.burst==='' && s.mine===0 && Math.abs(s.angle)<0.5 && /x/.test(s.left+s.right),'started at zone 3: a level scale with an x-block: '+s.left+' = '+s.right);
  await move(p,s.sop,s.sn); await p.waitForTimeout(300); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes.same_op===1 && /Still level, but x is not alone/.test(msg) && Math.abs(t.angle)<0.5 && t.left!==s.left && t.right!==s.right,'the wrong move is done to BOTH pans: still level, but not solved: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/5_same_op.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='solve' && t.left===s.left && t.right===s.right,'TRY AGAIN puts both pans back');
  await move(p,s.inv,s.sn); t=await st(p); ok(t.phase==='gap' && [t.left,t.right].includes('x') && [t.left,t.right].includes(String(s.x)) && t.stampOn,'the opposite operation leaves x alone: '+t.left+' = '+t.right); await p.screenshot({path:OUT+'/5b_alone.png'});

  console.log('\n[6] Inspector\'s line');
  await open(p,{zone:3}); s=await st(p); ok(s.type==='inspect' && s.clamp && /BEFORE THE REPAIR/.test(s.before) && (await p.$$('[data-says]')).length===2 && Math.abs(s.angle)<0.5,'started at zone 4: a clamped scale and the equation it came from: '+s.before); await p.screenshot({path:OUT+'/6_clamped.png'});
  await call(p,!s.level); await p.waitForTimeout(500); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.bad===1 && !t.clamp && total(t.mistakes)===1 && (s.level?Math.abs(t.angle)<0.5:Math.abs(t.angle)>8) && msg.length>30,'a wrong call: the clamp opens and the scale shows it ('+t.angle.toFixed(1)+'°): '+msg.slice(0,100)); await p.screenshot({path:OUT+'/6b_wrong.png'});
  await p.keyboard.press('Enter'); await nextRound(p,s); s=await st(p);
  await speed(p,1); await p.waitForTimeout(600); await speed(p,8); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.too_slow===1 && /opened by itself/.test(msg),'the clamp opens by itself if nobody calls it: '+msg.slice(0,70)); await speed(p,5); await p.keyboard.press('Enter'); await nextRound(p,s);
  let sawTip=false, sawLevel=false; for(let g=0;g<8&&!(sawTip&&sawLevel);g++){ await hold(p); s=await st(p); if(s.type!=='inspect'||s.zone!==3){ await go(p); break; } await call(p,s.level); t=await st(p);
    if(!s.level&&!sawTip){ sawTip=Math.abs(t.angle)>6; } if(s.level&&!sawLevel){ sawLevel=Math.abs(t.angle)<0.5; } await nextRound(p,s); }
  ok(sawTip&&sawLevel,'right calls: a bad repair tips and a good one stays level');

  console.log('\n[7] The boss: two changes, then the curtain');
  await open(p,{zone:4}); s=await st(p); ok(await p.isVisible('#bossBar') && s.hits.length===2 && / then /.test(s.burst) && /SAME ORDER/.test(s.sign),'two changes at once: '+s.burst);
  await move(p,s.hits[0].op,s.hits[0].n); t=await st(p); ok(t.phase==='match' && t.step===1 && t.good===1 && /One more/.test(t.line),'the first match counts, and the beam is still tipping'); await p.screenshot({path:OUT+'/7_two.png'});
  await move(p,s.hits[1].op,s.hits[1].n); ok((await st(p)).phase==='gap','the second match levels it'); await nextRound(p,s);
  s=await st(p); ok(s.curtain && s.burst==='? ? ?' && /^was: /.test(s.was) && !/[()]/.test(s.side==='left'?s.left:s.right),'behind the curtain: only the pan before and after: '+s.was+' → '+(s.side==='left'?s.left:s.right)); await p.screenshot({path:OUT+'/7b_curtain.png'});
  await move(p,s.hop,s.hn+1); msg=await p.textContent('#calloutText'); ok((await st(p)).mistakes.amount===1 && /before and after/.test(msg) && !/saboteur did/.test(msg),'a wrong amount does not give the hidden change away: '+msg.slice(0,90));
  await p.keyboard.press('Enter'); await move(p,s.hop,s.hn); ok((await st(p)).phase==='gap','working it out and matching it levels the scale');

  console.log('\n[8] Practice mode');
  await open(p,{practice:true,fast:8}); ok(await p.isVisible('#practiceTag') && (await p.getAttribute('#meterBox','style')).includes('hidden'),'PRACTICE tag shows and the shake meter is hidden');
  await p.waitForTimeout(2500); s=await st(p); ok(s.phase==='match' && !s.frozen && s.t<=s.seconds*0.46 && Math.abs(s.angle)<8,'the beam leans and waits');
  await move(p,INV[s.hop],s.hn); t=await st(p); ok(t.meter===0 && t.lives===3 && t.bad===1,'a mistake is explained but adds no shake');

  console.log('\n[9] The scale falls, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__scale.G; G.lives=1; G.meter=90; });
  await hold(p); s=await st(p); await setMove(p,INV[s.hop],s.hn); await p.keyboard.press('Enter'); await go(p); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/THE SCALE FELL/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'THE SCALE FELL! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await p.waitForFunction(()=>['run','match'].includes(window.__scale.W.phase) && document.getElementById('banner').classList.contains('hidden'),null,{timeout:10000});
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  await ready(p); s=await st(p); ok(s.lives===3 && s.meter===0 && s.ri===0,'all 3 chains back and a fresh scale');

  console.log('\n[10] Help pauses the beam');
  await speed(p,1); await p.waitForTimeout(500); await p.keyboard.press('h'); const t1=(await st(p)).t, a1=(await st(p)).angle; await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && t1===(await st(p)).t && a1===(await st(p)).angle,'H opens the help and the beam stops');
  await p.keyboard.press('h'); await p.waitForTimeout(500); ok((await st(p)).t>t1,'closing help lets it tip again');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/counterweight/.test(fr.url()));
  await f.evaluate(()=>{ window.__scale.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
