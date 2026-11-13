// Key Fitter (4-1, the action game): every zone through the real controls (tapping locks, number keys, sliding a key,
// forging a lock), each kind of mistake and what it costs, free test keys, the hint card, practice, fail and retry,
// town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/key_fitter'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-1-key-fitter/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const near=(a,b)=>Math.abs(a-b)<1e-6;
// What the game is showing right now (keys.js made the round, so it knows which locks open).
const st=(p)=>p.evaluate(()=>{ const f=window.__keyfitter, W=f.W, G=f.G, r=W.round, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, score:G.score, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, value:r.value, money:r.money, decimal:r.decimal,
    items:W.items.map(i=>({n:i.n,x:i.x,state:i.state,opens:i.lock.opens,trap:i.lock.trap})), frozen:W.frozen, pick:W.pick, tries:W.tries, marks:W.marks.map(m=>m.text),
    strip:r.strip, order:r.order, maxTries:r.tries, solution:r.lock&&r.lock.solution, ops:r.ops, story:r.story, kinds:(r.locks||[]).map(l=>l.kind),
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), sign:document.getElementById('signText').textContent, mistakes:{...G.mistakes} }; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__keyfitter.W.speed=v; },x);
async function ready(p){ await p.waitForFunction(()=>{ const W=window.__keyfitter.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (['ready','belt','pick','forge'].includes(W.phase) && hid('banner')); },null,{timeout:30000}); await startBelt(p); }
// A belt waits for the student to start it: by Enter one time, by its button the next.
let starts=0; async function startBelt(p){ if(await p.evaluate(()=>window.__keyfitter.W.phase!=='ready')) return; if(starts++%2===0) await p.keyboard.press('Enter'); else await p.click('#beltStart'); await p.waitForFunction(()=>window.__keyfitter.W.phase==='belt'); }
async function nextRound(p,s){ await p.waitForFunction(([z,r])=>{ const f=window.__keyfitter, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && ['ready','belt','pick','forge'].includes(W.phase) && hid('banner')); },[s.zone,s.ri],{timeout:60000}); await startBelt(p); }
async function frozen(p){ await p.waitForFunction(()=>window.__keyfitter.W.frozen,null,{timeout:30000}); }
const used={ tapKey:0, tapClick:0, pickKeys:0, pickDrag:0, pickButtons:0 };
const onBelt=(i)=>i.state==='roll' && i.x<1200 && i.x>200;
async function tap(p,i){
  if((used.tapKey+used.tapClick)%2===0){ used.tapKey++; await p.keyboard.press(String(i.n+1)); }
  else { used.tapClick++; const b=await p.evaluate((n)=>{ const r=window.__keyfitter.W.items[n].el.getBoundingClientRect(); return { x:r.x+r.width/2-60, y:r.y+r.height/2+10 }; },i.n); await p.mouse.click(b.x,b.y); }
}
/** Wait for a lock the key does NOT open to be on the belt, opening the right ones on the way. */
async function findTrap(p){ const done=new Set();
  for(let guard=0;guard<1500;guard++){ const s=await st(p); const trap=s.items.find(i=>!i.opens&&onBelt(i)); if(trap) return trap;
    const t=s.items.find(i=>i.opens&&onBelt(i)&&!done.has(i.n)); if(t){ done.add(t.n); await p.keyboard.press(String(t.n+1)); } else await p.waitForTimeout(30); }
  return null; }
/** Play a belt: tap every lock the key opens (or, with `wrong`, do nothing at all). */
async function playBelt(p){ const done=new Set();
  for(let guard=0;guard<1500;guard++){ const s=await st(p); if(s.phase!=='belt'||s.frozen||s.report) break;
    const t=s.items.find(i=>i.opens && onBelt(i) && !done.has(i.n)); if(!t){ await p.waitForTimeout(30); continue; } done.add(t.n); await tap(p,t); } }
async function at(p,v,strip){ const b=await (await p.$('#scene')).boundingBox(); return { x:b.x+(110+(v-strip.lo)/(strip.hi-strip.lo)*1146)/1366*b.width, y:b.y+470/698*b.height }; }
async function canPick(p){ await p.waitForFunction(()=>{ const W=window.__keyfitter.W; return W.phase==='pick' && W.pickEl && !W.fly && !W.frozen && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
let pickWay=0;
async function setPick(p,target){
  await canPick(p); const s=await st(p), step=s.strip.step, n=Math.round((target-s.pick)/step);
  const how=['pickKeys','pickDrag','pickButtons'][pickWay++%3]; used[how]++;
  if(how==='pickKeys'){ const key=n<0?'ArrowLeft':'ArrowRight'; for(let i=0;i<Math.floor(Math.abs(n)/5);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<Math.abs(n)%5;i++) await p.keyboard.press(key); }
  if(how==='pickButtons') for(let i=0;i<Math.abs(n);i++) await p.click(n<0?'#stepL':'#stepR');
  if(how==='pickDrag'){ const a=await at(p,s.pick,s.strip), b=await at(p,target,s.strip); await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(b.x,b.y,{steps:6}); await p.mouse.up(); }
  return near((await st(p)).pick,target);
}
async function tryKey(p){ const s=await st(p); if(pickWay%2) await p.keyboard.press('Enter'); else await p.click('#goBtn');
  await p.waitForFunction(([t,r])=>{ const W=window.__keyfitter.W; return W.frozen || W.ri!==r || W.phase!=='pick' || (W.tries!==t && W.pickEl); },[s.tries,s.ri],{timeout:15000}); }
async function forge(p,op,a,c){ if(op) await p.click(`#forgeOps [data-op="${op}"]`); await p.fill('#fa',String(a)); await p.fill('#fc',String(c)); await p.keyboard.press('Enter'); }
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='belt') return playBelt(p);
  if(s.type==='forge') return s.ops ? forge(p,null,3,s.value*3) : forge(p,'+',5,s.value+5);
  const ok1=await setPick(p,s.order==='jam'?s.solution+s.strip.step:s.solution); await tryKey(p); return ok1;
}
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function open(p,{zone=0,practice=false,fast=5}={}){
  await p.goto(URL,{waitUntil:'load'});
  if(zone) await p.click(`[data-zone="${zone}"]`);
  if(practice) await p.click('#practiceBtn'); else await p.keyboard.press('Enter');
  await speed(p,fast); await ready(p);
}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(16).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');
  ok(!(await p.$('.panel')) && !(await p.$('[data-kb]')),'no question panel and no pick-1-of-4 keys: the whole screen is the game');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,4); await ready(p);
  let rounds=0; const types=new Set(), kinds=new Set(), shots=new Set(); let emptyBelts=0, styles=new Set();
  for(let guard=0;guard<40;guard++){
    const s=await st(p); if(s.report) break;
    types.add(s.type+(s.order==='jam'?':jam':'')+(s.story?':story':'')); s.kinds.forEach(k=>kinds.add(k));
    if(s.type==='belt'){ styles.add(s.money?'money':s.decimal?'decimal':'whole'); if(s.items.every(i=>!i.opens)) emptyBelts++; }
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); if(s.type==='belt'){ await speed(p,1); await p.waitForTimeout(6500); await p.screenshot({path:`${OUT}/${name}.png`}); await speed(p,4); }
      else if(s.type!=='forge'){ await setPick(p,s.solution-s.strip.step); await tryKey(p); await p.screenshot({path:`${OUT}/${name}.png`}); }
      else { await p.fill('#fa','5'); await p.screenshot({path:`${OUT}/${name}.png`}); } }
    await playRound(p,await st(p)); rounds++; await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__keyfitter.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['belt','ring','ring:jam','ring:story','forge','mystery'].every(t=>types.has(t)),'every kind of round appeared: '+[...types].join(', '));
  ok(['add','mul','two'].every(k=>kinds.has(k)) && (kinds.has('sub')||kinds.has('subFrom')) && (kinds.has('divBy')||kinds.has('divOf')),'belts carried every kind of lock: '+[...kinds].join(', '));
  ok(styles.has('whole')&&styles.has('decimal')&&styles.has('money'),'whole-number, decimal and money keys');
  ok(emptyBelts>=2,'some belts had no lock the key opens ('+emptyBelts+')');
  ok(used.tapKey>=3&&used.tapClick>=3,`locks tried by number key (${used.tapKey}) and by tapping (${used.tapClick})`);
  ok(used.pickKeys>=1&&used.pickDrag>=1&&used.pickButtons>=1,`own key moved by keys (${used.pickKeys}), dragging (${used.pickDrag}) and the arrow buttons (${used.pickButtons})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no alarm ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=60 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] The belt: it waits to be started, a jammed lock, and an open one that got away');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await p.waitForFunction(()=>window.__keyfitter.W.phase==='ready' && document.getElementById('banner').classList.contains('hidden'),null,{timeout:30000});
  let s=await st(p); const xs0=s.items.map(i=>i.x).join(); await p.waitForTimeout(700); await p.keyboard.press('1'); s=await st(p);
  ok(await p.isVisible('#beltStart') && xs0===s.items.map(i=>i.x).join() && s.bad===0 && s.good===0 && s.items[0].x<1366-116 && /START THE BELT/.test(s.sign),'the belt stands still, first lock in view, until it is started: '+s.sign); await p.screenshot({path:OUT+'/3_ready.png'});
  const gaps=s.items.slice(1).map((i,k)=>i.x-s.items[k].x); ok(gaps.every(g=>g===500),'locks are 5 seconds apart in zone 1 ('+gaps[0]+' px at 100 px a second)');
  await p.click('#beltStart'); await p.waitForTimeout(500); s=await st(p); ok(s.phase==='belt' && !(await p.isVisible('#beltStart')) && s.items[0].x<1236,'START THE BELT sets it rolling');
  await speed(p,5);
  let trap=await findTrap(p);
  await p.keyboard.press(String(trap.n+1)); await frozen(p); s=await st(p); let msg=await p.textContent('#calloutText');
  ok(s.bad===1 && s.meter<=25 && s.meter>=19 && Object.keys(s.mistakes).join()===trap.trap,'a key that does not fit jams the lock and raises the alarm ('+trap.trap+')');
  ok(msg.includes('≠') && (await p.$$('#scene .lock.jam')).length===1,'the lock shows both sides: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/3_jam.png'});
  const x0=(await st(p)).items.filter(i=>i.state==='roll').map(i=>i.x).join(); await p.waitForTimeout(400);
  ok(x0===(await st(p)).items.filter(i=>i.state==='roll').map(i=>i.x).join(),'the belt waits while the message is up');
  await p.keyboard.press('Enter');
  // now tap nothing: every lock the key opens gets away
  let missed=0; for(let guard=0;guard<40;guard++){ await p.waitForFunction(()=>{ const W=window.__keyfitter.W; return W.frozen || W.phase==='ready' || !document.getElementById('hint').classList.contains('hidden') || !document.getElementById('fail').classList.contains('hidden'); },null,{timeout:60000});
    if((await st(p)).phase==='ready'){ await startBelt(p); continue; }
    if(await p.isVisible('#hint')||await p.isVisible('#fail')) break; msg=await p.textContent('#calloutText'); if(/Your key opened that one/.test(msg)) missed++; await p.keyboard.press('Enter'); }
  ok(missed>=1 && /Your key opened that one: .* = /.test(msg),'letting an opening lock roll out is explained: '+msg.slice(0,90));
  ok(await p.isVisible('#hint') && /put your key in for the letter/.test(await p.textContent('#hintText')),'the same mistake twice opens the hint card'); await p.screenshot({path:OUT+'/3b_hint.png'});

  console.log('\n[4] Key Ring: test keys are free, the last try counts');
  await open(p,{zone:3}); s=await st(p); ok(s.type==='ring' && s.zone===3 && !near(s.pick,s.solution),'started at zone 4; the key does not start on the answer');
  ok(/2 TEST KEYS LEFT/.test(s.sign),'the sign counts the test keys: '+s.sign);
  await setPick(p,s.solution+1); await tryKey(p); let t=await st(p);
  ok(!t.frozen && t.bad===0 && t.tries===1 && t.marks.length===1 && /1 TEST KEY LEFT/.test(t.sign),'a wrong test key costs nothing and leaves what it made under the strip ('+t.marks[0]+')');
  ok(/≠/.test(await p.textContent('#tryLine')),'the lock shows the test: '+await p.textContent('#tryLine'));
  await setPick(p,s.solution+2); await tryKey(p); ok(/LAST TRY/.test((await st(p)).sign),'then the last try');
  await p.screenshot({path:OUT+'/5_ring_tests.png'});
  await setPick(p,s.solution-1); await tryKey(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.frozen && t.bad===1 && /too (big|small)/.test(msg) && msg.includes('The key was '+s.solution),'a wrong last try is a mistake and shows the key: '+msg.slice(0,110));
  await p.keyboard.press('Enter'); await nextRound(p,s);
  for(let k=0;k<3;k++){ const now=await st(p); await playRound(p,now); await nextRound(p,now); }
  s=await st(p); ok(s.order==='jam' && near(s.pick,s.solution) && /DOES NOT OPEN/.test(s.sign),'last: cut a key that does NOT open it (the key starts on the solution)');
  await canPick(p); await p.keyboard.press('Enter'); await frozen(p); ok(/That key opens it/.test(await p.textContent('#calloutText')),'a key that opens it is not what was asked');

  console.log('\n[5] The Locksmith: forge a lock, then a mystery lock');
  await open(p,{zone:4}); ok(await p.isVisible('#bossBar'),'the boss bar shows');
  for(let k=0;k<2;k++){ const now=await st(p); await playRound(p,now); await nextRound(p,now); }
  s=await st(p); ok(s.type==='forge' && await p.isVisible('#forge') && (await p.textContent('#signText')).includes('KEY '+s.value),'forge: build a lock for the key '+s.value);
  await p.keyboard.press('Enter'); ok(/Fill in both/.test(await p.textContent('#forgeNote')) && (await st(p)).bad===0,'empty boxes only nudge');
  await forge(p,'-',2,s.value); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && msg.includes('Make the right side '+(s.value-2)),'a lock the key does not open is explained: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/6_forge_wrong.png'});
  await p.keyboard.press('Enter'); await forge(p,'-',2,s.value-2); await p.waitForTimeout(300);
  ok(/It opens!/.test(await p.textContent('#forgeNote')),'any true lock is accepted: '+(await p.textContent('#forgeNote')).slice(0,70)); await nextRound(p,s);
  s=await st(p); await forge(p,'+',5,s.value+5); ok(/has to use × or ÷/.test(await p.textContent('#forgeNote')) && (await st(p)).bad===1,'the second forge has to use × or ÷ (a nudge, not a mistake)');
  await p.keyboard.type('*'); await p.fill('#fa','2'); await p.fill('#fc',String(s.value*2)); await p.keyboard.press('Enter'); await nextRound(p,s);
  s=await st(p); ok(s.type==='mystery' && /^\? \? \? = /.test(await p.textContent('#bigEq')) && /3 TEST KEYS LEFT/.test(s.sign),'mystery lock: the rule is hidden: '+await p.textContent('#bigEq'));
  await setPick(p,0); await tryKey(p); t=await st(p); ok(t.marks.length===1 && /Key 0 makes \d+/.test(await p.textContent('#tryLine')) && t.bad===1,'a test key shows what the lock makes of it: '+await p.textContent('#tryLine'));
  await setPick(p,1); await tryKey(p); await p.screenshot({path:OUT+'/7_mystery.png'});
  await speed(p,1); await setPick(p,s.solution); await tryKey(p); await p.waitForTimeout(150);
  ok(!/\?/.test(await p.textContent('#bigEq')),'solving it shows what the lock was: '+await p.textContent('#bigEq'));

  console.log('\n[6] Practice mode');
  await open(p,{practice:true,fast:1}); ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const xa=(await st(p)).items[0].x; await p.waitForTimeout(1000); const moved=xa-(await st(p)).items[0].x;
  ok(moved>40 && moved<95,'the belt runs slower in practice ('+Math.round(moved)+' px in a second)');
  await speed(p,5); trap=await findTrap(p);
  await p.keyboard.press(String(trap.n+1)); await frozen(p); s=await st(p); ok(s.meter===0 && s.lives===3 && s.bad===1,'a mistake is explained but raises no alarm');

  console.log('\n[7] Caught, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__keyfitter.G; G.lives=1; G.meter=90; });
  trap=await findTrap(p);
  await p.keyboard.press(String(trap.n+1)); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/CAUGHT/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'CAUGHT! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.items.length>=5,'all 3 chances back and a fresh belt');

  console.log('\n[8] Help pauses the belt');
  await speed(p,1); await p.waitForTimeout(800); await p.keyboard.press('h'); const h1=(await st(p)).items.map(i=>i.x).join(); await p.waitForTimeout(500);
  ok(await p.isVisible('#briefing') && h1===(await st(p)).items.map(i=>i.x).join(),'H opens the help and the belt stops');
  await p.keyboard.press('h'); await p.waitForTimeout(400); ok(h1!==(await st(p)).items.map(i=>i.x).join(),'closing help starts it again');

  console.log('\n[9] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/key-fitter/.test(fr.url()));
  await f.evaluate(()=>{ window.__keyfitter.G.result={score:60,total:66,accuracy:91,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
