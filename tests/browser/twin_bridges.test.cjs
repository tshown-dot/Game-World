// Twin Bridges (Grade 7, 4-2, the action game): every zone through the real controls (test posts and call it, hook
// rafts, set the dials, find the broken step), each kind of mistake and what it costs, the hint card, practice, fail
// and retry, town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/twin_bridges'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/g7-topic-4-factor-falls/games/4-2-twin-bridges/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const POSTS=[-3,-2,-1,0,1,2,3,4];
// What the game is showing (bridges.js made the round, so it knows the answer).
const st=(p)=>p.evaluate(()=>{ const f=window.__bridges, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden'), q=(s)=>document.querySelectorAll(s).length;
  const card=r.type==='raft'?r.cards[Math.min(W.raft.i,r.cards.length-1)]:null, A=r.type==='chain'?r.lines[0]:r.type==='raft'?r.target:r.A;
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, form:r.form||r.slip||null, hidden:!!r.hidden, frozen:W.frozen, tries:W.tries,
    eq:r.eq, lucky:r.lucky, v:r.v, am:A?A.m:null, ak:A?A.k:null, atext:A?A.text:'', seen:[...W.seen], testsLeft:W.testsLeft, m:W.m, k:W.k, traps:(r.traps||[]).map(t=>({m:t.m,k:t.k,key:t.key})),
    ci:card?W.raft.i:-1, cards:r.cards?r.cards.length:0, twin:card?card.twin:null, ctext:card?card.text:'', cx:card?W.raft.x:0, twins:r.cards?r.cards.filter(c=>c.twin).length:0,
    badStep:r.bad, key:r.key, last:r.lines?{m:r.lines[3].m,k:r.lines[3].k}:null, found:W.brokenFound,
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes},
    planksA:q('.plank.a'), planksB:q('.plank.b'), planksBoth:q('.plank.both'), deckB:q('.deck.b'), fell:q('.hiker.fell'), stamp:document.getElementById('stamp').textContent, exprs:document.getElementById('exprs').textContent,
    sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent, line:document.getElementById('bline').textContent }; });
let RATE=1; const speed=(p,x)=>{ RATE=x; return p.evaluate((v)=>{ window.__bridges.W.speed=v; },x); };
// The test runs the game sped up, so it stops the clock while it reads a raft (a student has 8 seconds each).
const hold=(p)=>p.evaluate(()=>{ window.__bridges.W.speed=0; }), go=(p)=>p.evaluate((v)=>{ window.__bridges.W.speed=v; },RATE);
const PH=['test','raft','build','span'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__bridges.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__bridges, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__bridges.W.frozen,null,{timeout:30000}); }
/** After a call or SEND: the hiker has walked and the game has said what happened. */
async function settled(p,s){ await p.waitForFunction(([r])=>{ const W=window.__bridges.W; return W.frozen || W.phase==='gap' || W.ri!==r || W.phase==='idle'; },[s.ri],{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ keys:0, taps:0 };
const byKey=()=>{ const k=used.keys<=used.taps; if(k) used.keys++; else used.taps++; return k; };
async function post(p,x){ if(byKey()) await p.keyboard.press(String(POSTS.indexOf(x)+1)); else await p.click(`[data-post="${x}"]`,{position:{x:20,y:60}}); }
async function call(p,twins){ if(byKey()) await p.keyboard.press(twins?'t':'n'); else await p.click(`[data-call="${twins?'twins':'not'}"]`); }
/** One raft. right: do the right thing, or the wrong one. */
async function raft(p,right=true){ await hold(p); const s=await st(p), hook=right?s.twin:!s.twin, keys=byKey();
  if(hook){ if(keys) await p.keyboard.press('Enter'); else await p.click('#raftTag'); } else { if(keys) await p.keyboard.press('ArrowRight'); else await p.click('#passBtn'); }
  await go(p); return s; }
async function afterRaft(p,s){ await p.waitForFunction(([r,i])=>{ const W=window.__bridges.W; return W.frozen || W.ri!==r || W.phase!=='raft' || (W.raft.i!==i && W.raft.wait<=0); },[s.ri,s.ci],{timeout:30000}); }
async function playRafts(p){ for(let g=0;g<8;g++){ await hold(p); const s=await st(p); if(s.type!=='raft'||s.phase!=='raft'){ await go(p); return; } await raft(p); await afterRaft(p,s); if((await st(p)).ri!==s.ri) return; } }
async function dials(p,m,k){ let s=await st(p); const keys=byKey(), dm=m-s.m; let dk=k-s.k;
  for(let i=0;i<Math.abs(dm);i++){ if(keys) await p.keyboard.press(dm<0?'ArrowLeft':'ArrowRight'); else await p.click(`[data-dial="m"][data-by="${dm<0?-1:1}"]`); }
  if(keys){ const key=dk<0?'ArrowDown':'ArrowUp'; dk=Math.abs(dk); for(let i=0;i<Math.floor(dk/5);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<dk%5;i++) await p.keyboard.press(key); }
  else for(let i=0;i<Math.abs(dk);i++) await p.click(`[data-dial="k"][data-by="${dk<0?-1:1}"]`);
  s=await st(p); return s.m===m && s.k===k; }
async function send(p,s){ if(byKey()) await p.keyboard.press('Enter'); else await p.click('#goBtn'); await settled(p,s); }
async function span(p,i){ if(byKey()) await p.keyboard.press('abc'[i-1]); else await p.click(`[data-span="${i}"]`); }
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='test'){ await post(p,0); await post(p,2); await call(p,s.eq); return settled(p,s); }
  if(s.type==='raft') return playRafts(p);
  if(s.type==='chain'){ await post(p,3); await span(p,s.badStep); await p.waitForFunction(()=>window.__bridges.W.phase==='build'); }
  if(s.hidden){ await post(p,0); await post(p,1); }
  await dials(p,s.am,s.ak); await send(p,s);
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
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type: the whole screen is the river');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const kinds=new Set(), shots=new Set();
  for(let guard=0;guard<50;guard++){
    const s=await st(p); if(s.report) break;
    const kind=s.type==='build'&&s.hidden?'hidden':s.type; kinds.add(kind); kinds.add(`${s.type}:${s.form}`);
    const name=`${s.zone+2}_${kind}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,s); rounds++;
    if(!shots.has(name+'_done')){ shots.add(name+'_done'); await p.screenshot({path:`${OUT}/${name}_done.png`}); }
    await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__bridges.G.result);
  ok(rounds===23,`finished all 5 zones (${rounds} rounds)`);
  ok(['test','raft','build','chain','hidden','build:sub','build:distNeg','build:combine'].every(k=>kinds.has(k)) && (kinds.has('build:dec')||kinds.has('build:frac')),'every kind of round appeared: '+[...kinds].filter(k=>!k.includes(':')).join(', '));
  ok(used.keys>=15&&used.taps>=15,`played by keys (${used.keys}) and by tapping (${used.taps})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no ropes lost ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=30 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Test the bridges');
  await open(p); let s=await st(p); ok(s.type==='test' && s.n===6 && s.testsLeft===3 && (await p.$$('[data-post]')).length===8 && (await p.$$('[data-call]')).length===2 && s.planksA+s.planksBoth===0,'two expressions, eight bare posts and two buttons: '+s.exprs.replace(/\s+/g,' ').slice(0,60));
  await call(p,true); let t=await st(p); ok(/Test at least one post/.test(t.line) && t.bad===0 && t.phase==='test','calling it without a test only nudges');
  await post(p,-3); await post(p,4); await post(p,1); t=await st(p); ok(t.testsLeft===0 && t.seen.length===3 && t.planksA+t.planksBoth===3 && /A = .*B = /.test(t.line),'each test lays the planks at that post: '+t.line);
  await post(p,2); t=await st(p); ok(/No tests left/.test(t.line) && t.seen.length===3,'only three tests');
  let msg; const did={ doubted:0, lucky:0, ignored:0, hint:false, grew:0 };
  for(let g=0;g<12;g++){ s=await st(p); if(s.type!=='test'||s.report) break;
    if(s.eq && !did.doubted){ if(!s.seen.length){ await post(p,0); await post(p,3); } await call(p,false); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText'); did.doubted=1;
      ok(t.mistakes.doubted_twins===1 && t.meter===25 && t.planksBoth===8 && /They ARE twins/.test(msg) && t.n===s.n+0,'calling real twins NOT TWINS: the hiker crosses every post: '+msg.slice(0,90));
      await p.screenshot({path:OUT+'/3_doubted.png'}); await carryOn(p); t=await st(p); ok(t.n===s.n+1,'and one more pair of the same kind is added'); did.grew++; }
    else if(s.lucky!==null && did.lucky<2){ if(s.seen.length){ await call(p,s.eq); await settled(p,s); await nextRound(p,s); continue; }
      await post(p,s.lucky); t=await st(p); const same=t.planksBoth===1; await call(p,true); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText'); did.lucky++;
      if(did.lucky===1){ ok(same && t.mistakes.one_test_value===1 && t.fell===1 && /not proof/.test(msg) && !t.hint,'one matching post, called TWINS: the hiker falls at the first post that splits: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/3_lucky.png'}); }
      else { did.hint=t.hint; ok(t.hint && /cross each other/.test(await p.textContent('#hint')),'the same mistake twice in a zone opens the hint card'); await p.screenshot({path:OUT+'/3_hint.png'}); }
      await carryOn(p); }
    else if(s.lucky!==null && !did.ignored){ const other=POSTS.find(x=>x!==s.lucky&&!s.seen.includes(x)); if(!s.seen.includes(s.lucky)) await post(p,s.lucky); await post(p,other); await call(p,true); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText'); did.ignored=1;
      ok(t.mistakes.ignored_test===1 && /One of your own tests/.test(msg),'a test that split, ignored: '+msg.slice(0,90)); await carryOn(p); }
    else { if(!s.seen.length){ await post(p,0); await post(p,2); } await call(p,s.eq); await settled(p,s); }
    await nextRound(p,s); }
  ok(did.doubted && did.lucky===2 && did.ignored && did.hint,'the zone met each test mistake');

  console.log('\n[4] Rafts on the river');
  await open(p,{zone:1}); await hold(p); s=await st(p); ok(s.type==='raft' && s.planksA===8 && s.cards>=4 && await p.isVisible('#raftTag') && await p.isVisible('#passBtn'),'started at zone 2: the bridge is laid out and a raft floats in: '+s.atext+' / '+s.ctext);
  const n0=s.n; let misses=0, slow=false, hooked=false;
  for(let g=0;g<8;g++){ await hold(p); s=await st(p); if(s.type!=='raft'||s.phase!=='raft'||s.ri!==0){ await go(p); break; }
    if(misses<2 && s.twin && !slow){ slow=true; misses++; await speed(p,8); await frozen(p); await speed(p,5); t=await st(p); msg=await p.textContent('#calloutText');
      ok(t.mistakes.missed_twin===1 && t.meter>=20 && /was a twin/.test(msg),'a twin that floats past unhooked: '+msg.slice(0,90)); await carryOn(p); await afterRaft(p,s); }
    else if(misses<2 && !s.twin && !hooked){ hooked=true; misses++; await raft(p,false); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
      ok(t.bad>=1 && t.deckB===1 && t.planksB>=7 && /is not a twin: at /.test(msg),'a trap hooked on is laid across the river and splits from the bridge: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/4_trap.png'}); await carryOn(p); await afterRaft(p,s); }
    else { const r=await raft(p); if(r.twin){ await p.waitForFunction(()=>window.__bridges.W.B!==null||window.__bridges.W.raft.i!==0,null,{timeout:5000}).catch(()=>{}); } await afterRaft(p,s); } }
  ok(misses===2,'both raft mistakes happened on one bridge'); await frozen(p); msg=await p.textContent('#calloutText');
  ok(/The twins of .* were: /.test(msg) && /one more bridge/.test(msg),'two misses on one bridge: its twins are listed: '+msg.slice(0,90));
  await p.keyboard.press('Enter'); ok((await st(p)).n===n0+1,'and one more bridge is added'); await nextRound(p,s);
  await hold(p); s=await st(p); let twinShot=false; for(let g=0;g<8&&!twinShot;g++){ await hold(p); s=await st(p); if(s.ri!==1||s.phase!=='raft'){ break; }
    if(s.twin){ await p.keyboard.press('Enter'); t=await st(p); twinShot=true; ok(t.planksBoth===8 && /PROPERTY|LIKE TERMS/.test(t.stamp) && t.good>=1,'a hooked twin lies exactly on the bridge and is stamped: '+t.stamp); await p.screenshot({path:OUT+'/4b_twin.png'}); await go(p); await afterRaft(p,s); }
    else { await raft(p); await afterRaft(p,s); } }
  ok(twinShot,'a twin came by');

  console.log('\n[5] Build the twin');
  await open(p,{zone:2}); s=await st(p); ok(s.type==='build' && s.form==='assoc' && (await p.$$('[data-dial]')).length===4 && s.planksA===0 && s.m===1 && s.k===0,'started at zone 3: two dials and an empty river: '+s.atext);
  await send(p,s); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.frozen && t.mistakes.number_part===1 && t.meter===25 && t.fell===1 && t.planksA===8 && t.planksB===8 && /never meets it/.test(msg) && !msg.includes(String(s.ak)+'.'),'a wrong twin is built for real, and the hiker falls: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/5_wrong.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='build' && t.planksA===0 && t.planksB===0,'TRY AGAIN clears the river');
  await dials(p,1,s.ak-1); await send(p,s); t=await st(p); ok(t.hint,'the same slip twice: the hint card'); await p.keyboard.press('Enter'); msg=await p.textContent('#calloutText'); t=await st(p);
  ok(msg.includes(`${s.atext} = ${s.v} + ${s.ak}.`) && t.m===1 && t.k===s.ak && t.planksBoth===8,'two misses: the twin is given and laid on the bridge: '+msg.slice(-40)); await p.keyboard.press('Enter'); await nextRound(p,s);
  s=await st(p); const trap=s.traps[0]; ok(await dials(p,trap.m,trap.k),'the dials turn by key or by tap'); await send(p,s); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes[trap.key]===1 && msg.length>20,`a known slip (${trap.key}) gets its own message: `+msg.slice(0,100)); await p.keyboard.press('Enter');
  await dials(p,s.am,s.ak); await speed(p,1); await send(p,s); t=await st(p);
  ok(t.phase==='gap' && t.planksBoth===8 && t.stamp==='DISTRIBUTIVE PROPERTY' && /twins at every post/.test(t.line),'the right twin: every plank matches, and the property is stamped: '+t.line); await p.screenshot({path:OUT+'/5b_right.png'});

  console.log('\n[6] The broken span');
  await open(p,{zone:3}); s=await st(p); ok(s.type==='chain' && (await p.$$('[data-span]')).length===3 && (await p.$$('.ex.line')).length===4 && s.testsLeft===3,'started at zone 4: four lines of work joined by three steps: '+s.exprs.replace(/\s+/g,' ').slice(0,70));
  await post(p,3); t=await st(p); const ems=await p.$$eval('.ex.line em',(l)=>l.map(e=>e.textContent));
  ok(t.testsLeft===2 && ems.every(x=>x.length>0) && new Set(ems).size===2 && new RegExp(`line ${s.badStep+1}`).test(t.line),'walking a post writes its number under each line: '+ems.join(' → ')+' · '+t.line); await p.screenshot({path:OUT+'/6_walk.png'});
  const wrong=[1,2,3].find(i=>i!==s.badStep); await span(p,wrong); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes.wrong_span===1 && t.meter===25 && /That step is fine/.test(msg),'tapping a step that is fine: '+msg.slice(0,80)); await p.keyboard.press('Enter');
  await span(p,s.badStep); t=await st(p); ok(t.found && t.phase==='build' && /NOW BUILD/.test(t.sign) && (await p.$$('.step.broken')).length===1 && (await p.$$('.ex.line.wrong')).length===4-s.badStep,'the wrong step turns red and the dials appear');
  await dials(p,s.last.m,s.last.k); await send(p,s); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes[s.key]>=1 && /same as the wrong last line/.test(msg),'rebuilding the wrong last line is caught: '+msg.slice(0,100)); await p.keyboard.press('Enter');
  await dials(p,s.am,s.ak); await send(p,s); t=await st(p); ok(t.phase==='gap' && t.planksBoth===8,'the right last line is a twin of the first'); await p.screenshot({path:OUT+'/6b_fixed.png'});
  await nextRound(p,s); s=await st(p); for(const i of [1,2,3].filter(i=>i!==s.badStep)){ await span(p,i); await frozen(p); await carryOn(p); }
  t=await st(p); ok(t.found && t.phase==='build' && t.mistakes.wrong_span===3,'two wrong steps: the wrong one is shown, then the repair');

  console.log('\n[7] The boss: groups, decimals or fractions, and a hidden bridge');
  await open(p,{zone:4}); s=await st(p); ok(await p.isVisible('#bossBar') && s.form==='sub' && /− \(/.test(s.atext),'the boss starts by subtracting a whole group: '+s.atext);
  const sg=s.traps.find(x=>x.key==='subtract_group'); await dials(p,sg.m,sg.k); await send(p,s); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.subtract_group===1 && /group|subtracted/.test(msg),'the minus sign is for the whole group: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/7_group.png'});
  await p.keyboard.press('Enter'); await dials(p,s.am,s.ak); await send(p,s); await nextRound(p,s);
  s=await st(p); ok(['dec','frac'].includes(s.form) && /[./]/.test(s.atext),'then a decimal or a fraction outside: '+s.atext); await playRound(p,s); await nextRound(p,s);
  s=await st(p); ok(s.hidden && s.atext==='? ? ?' && s.testsLeft===3 && /HIDDEN/.test(s.sign),'then a hidden bridge: no expression at all');
  await post(p,0); await post(p,1); t=await st(p); ok(t.planksA===2 && t.testsLeft===1 && t.bad===s.bad && /hidden bridge is at/.test(t.line),'the student chooses which posts to look at: '+t.line); await p.screenshot({path:OUT+'/7b_hidden.png'});
  await post(p,4); await post(p,-3); t=await st(p); ok(t.planksA===3 && /No more looks/.test(t.line),'three looks only');
  await dials(p,s.am,s.ak); await send(p,s); ok((await st(p)).phase==='gap','the twin built from the planks holds'); await nextRound(p,s);
  for(let k=0;k<2;k++){ s=await st(p); await playRound(p,s); await nextRound(p,s); }
  ok((await st(p)).report && (await p.evaluate(()=>window.__bridges.G.result.bossDefeated)),'the last bridge ends the run with the boss beaten');

  console.log('\n[8] Practice mode');
  await open(p,{zone:1,practice:true,fast:8}); ok(await p.isVisible('#practiceTag') && (await p.getAttribute('#meterBox','style')).includes('hidden'),'PRACTICE tag shows and the flood meter is hidden');
  await p.waitForTimeout(2500); s=await st(p); ok(s.ci===0 && s.cx<=0.5 && s.phase==='raft' && !s.frozen,'the raft waits in the middle of the stream');
  await raft(p,false); await frozen(p); t=await st(p); ok(t.meter===0 && t.lives===3 && t.bad===1,'a mistake is explained but raises no water');

  console.log('\n[9] Washed out, then a fast retry');
  await open(p,{zone:2}); await p.evaluate(()=>{ const G=window.__bridges.G; G.lives=1; G.meter=90; });
  await p.keyboard.press('Enter'); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/WASHED OUT/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'WASHED OUT! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.ri===0 && s.zone===2,'all 3 ropes back and the zone starts again');

  console.log('\n[10] Help pauses the river');
  await open(p,{zone:1,fast:1}); await p.waitForTimeout(400); await p.keyboard.press('h'); const x1=(await st(p)).cx; await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && x1===(await st(p)).cx,'H opens the help and the raft stops');
  await p.keyboard.press('h'); await p.waitForTimeout(500); ok((await st(p)).cx>x1,'closing help lets it float again');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/twin-bridges/.test(fr.url()));
  await f.evaluate(()=>{ window.__bridges.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
