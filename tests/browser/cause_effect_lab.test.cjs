// Cause and Effect Lab (4-8, the action game): every zone through the real controls (tags, the belt, the up/down
// buttons, machines, test cranks), each kind of mistake and what it costs, the hint card, practice, fail and retry,
// town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/cause_effect_lab'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-8-cause-effect-lab/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing (lab.js made the round, so it knows the answer).
const st=(p)=>p.evaluate(async()=>{ const m=await import('./lab.js'); const f=window.__lab, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  const idx=(name)=>(r.tags||[]).findIndex(t=>t.name===name), can=r.type==='build'?m.buildable(r)[0]:null, pair=r.pair||null;
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, frozen:W.frozen, tries:W.tries,
    crank:W.crank, gauge:W.gauge, way:W.way, testsLeft:W.testsLeft, tested:{...W.tested}, beltI:W.belt.i, beltX:W.belt.x, misses:W.belt.misses,
    cause:r.type==='wire'?r.tags.findIndex(t=>t.role==='cause'):can?idx(can.cause.name):-1, effect:can?idx(can.effect.name):-1,
    decoy:can?r.tags.findIndex(t=>!m.buildable(r).some(x=>[x.cause.name,x.effect.name].includes(t.name))):-1,
    affects:r.type==='belt'&&r.tags[W.belt.i]?r.tags[W.belt.i].affects:null, tagName:r.type==='belt'&&r.tags[W.belt.i]?r.tags[W.belt.i].name:'',
    dir:pair?pair.dir:null, time:pair?pair.time||null:null, causeName:pair?pair.cause.name:'', effectName:pair?pair.effect.name:'', follow:!!r.follow,
    spotBad:r.type==='spot'?r.bad:-1, real:r.type==='mystery'?r.real:-1, opt:r.type==='mystery'?r.options.indexOf(r.pair.effect.name):-1,
    rows:document.querySelectorAll('#logRows tr').length, dead:document.getElementById('machine').classList.contains('dead'), live:document.getElementById('machine').classList.contains('live'),
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes},
    sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent, line:document.getElementById('benchLine').textContent }; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__lab.W.speed=v; },x);
// The test runs the game sped up, so it stops the clock while it reads the belt (a student has 6 seconds a tag).
const hold=(p)=>p.evaluate(()=>{ const W=window.__lab.W, was=W.speed; W.speed=0; return was; });
const PH=['wire','belt','way','spot','build','test'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__lab.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__lab, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__lab.W.frozen,null,{timeout:30000}); }
/** After Enter: the machine has run and the game has said what happened. */
async function settled(p,s){ await p.waitForFunction(([r])=>{ const W=window.__lab.W; return W.frozen || W.phase==='gap' || W.ri!==r || W.phase==='idle'; },[s.ri],{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ keys:0, taps:0 };
/** Choose something by its number key or by tapping it, turn about. */
async function choose(p,i,selector){ if(used.keys<=used.taps){ used.keys++; await p.keyboard.press(String(i+1)); } else { used.taps++; await p.click(selector); } }
const WAYKEY={ up:'ArrowUp', down:'ArrowDown', same:'ArrowRight' };
async function setWay(p,w){ if(used.keys<=used.taps){ used.keys++; await p.keyboard.press(WAYKEY[w]); } else { used.taps++; await p.click(`[data-way="${w}"]`); } }
/** One tag on the belt: plug it in, or let it go by. */
async function beltTag(p,plug){ const s=await st(p);
  if(plug){ if(used.keys<=used.taps){ used.keys++; await p.keyboard.press('Enter'); } else { used.taps++; await p.click('#beltTag'); } }
  else if(used.keys<=used.taps){ used.keys++; await p.keyboard.press('ArrowRight'); } else { used.taps++; await p.click('#passBtn'); }
  return s; }
async function afterTag(p,s){ await p.waitForFunction(([r,i])=>{ const W=window.__lab.W; return W.frozen || W.ri!==r || W.belt.i!==i || W.phase!=='belt'; },[s.ri,s.beltI],{timeout:30000}); }
async function playBelt(p){ for(let g=0;g<8;g++){ const was=await hold(p), s=await st(p); if(s.type!=='belt'||s.phase!=='belt'){ await speed(p,was); return; } await beltTag(p,s.affects); await speed(p,was); await afterTag(p,s); if((await st(p)).ri!==s.ri) return; } }
async function testCrank(p,i){ await choose(p,i,`[data-test="${i}"]`); await p.waitForFunction(([k])=>window.__lab.W.tested[k],[i],{timeout:30000}); }
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='wire'){ await choose(p,s.cause,`[data-tag="${s.cause}"]`); await p.keyboard.press('Enter'); }
  else if(s.type==='belt') return playBelt(p);
  else if(s.type==='way'){ await setWay(p,s.dir); await p.click('#goBtn'); }
  else if(s.type==='spot') await choose(p,s.spotBad,`[data-spot="${s.spotBad}"]`);
  else if(s.type==='build'){ await choose(p,s.cause,`[data-tag="${s.cause}"]`); await choose(p,s.effect,`[data-tag="${s.effect}"]`); await p.keyboard.press('Enter'); }
  else if(s.type==='mystery'){ await testCrank(p,(s.real+1)%3); await testCrank(p,s.real); await p.waitForFunction(()=>window.__lab.W.phase==='name'); await choose(p,s.opt,`[data-opt="${s.opt}"]`); }
  await settled(p,s);
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
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type: the whole screen is the machine');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const kinds=new Set(), shots=new Set(); let follows=0;
  for(let guard=0;guard<50;guard++){
    const s=await st(p); if(s.report) break;
    kinds.add(s.type); if(s.follow) follows++;
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,s); rounds++;
    if(!shots.has(name+'_done')){ shots.add(name+'_done'); await p.screenshot({path:`${OUT}/${name}_done.png`}); }
    await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__lab.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['wire','belt','way','spot','build','mystery'].every(k=>kinds.has(k)),'every kind of round appeared: '+[...kinds].join(', '));
  ok(follows===2,'each machine the student built was followed by a prediction ('+follows+')');
  ok(used.keys>=10&&used.taps>=10,`played by keys (${used.keys}) and by tapping (${used.taps})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no overload ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=30 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Wire and crank: wired backwards');
  await open(p); let s=await st(p); ok(s.type==='wire' && (await p.$$('[data-tag]')).length===2 && /CRANK/.test(s.sign),'two tags and a machine: '+s.causeName+' / '+s.effectName);
  await p.keyboard.press('Enter'); ok(/Tap the tag/.test((await st(p)).line) && (await st(p)).bad===0,'cranking with nothing on the crank only nudges');
  await p.click(`[data-tag="${1-s.cause}"]`); ok((await p.textContent('#crankSock'))===s.effectName && (await p.textContent('#gaugeSock'))===s.causeName,'tapping a tag puts it on the crank and the other on the gauge');
  await p.keyboard.press('Enter'); await frozen(p); let t=await st(p); let msg=await p.textContent('#calloutText');
  ok(t.bad===1 && t.meter===25 && t.mistakes.swapped===1 && t.dead && t.rows===0 && /Backwards/.test(msg),'wired backwards: the crank spins, the gauge stays dead, no lab notes: '+msg.slice(0,90)); await p.screenshot({path:OUT+'/3_backwards.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='wire' && t.crank===null && (await p.textContent('#crankSock'))==='','TRY AGAIN empties the machine');
  await p.keyboard.press(String(2-s.cause)); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok(/Watch it wired the right way/.test(msg) && await p.isVisible('#hint') && /BECAUSE/.test(await p.textContent('#hintText')),'two misses: the hint card opens (same mistake twice)'); await p.screenshot({path:OUT+'/3b_hint.png'});
  await carryOn(p); await p.waitForFunction(()=>window.__lab.W.phase==='gap',null,{timeout:20000}); t=await st(p);
  ok(t.rows===5 && t.live && t.bad===2 && (await p.textContent('#crankSock'))===s.causeName,'then the machine runs wired the right way, and the notes fill in'); await p.screenshot({path:OUT+'/3c_shown.png'});

  console.log('\n[4] What moves the gauge? (the belt)');
  await open(p,{zone:1}); s=await st(p); ok(s.type==='belt' && await p.isVisible('#beltTag') && await p.isVisible('#passBtn') && (await p.textContent('#gaugeSock')).length>5,'started at zone 2: a tag rolls past the gauge: '+s.sign);
  let wrongPlug=false, rolledBy=false; const n0=s.n;
  for(let g=0;g<8;g++){
    const was=await hold(p); s=await st(p); if(s.phase!=='belt') { await speed(p,was); break; }
    if(!s.affects && !wrongPlug){ wrongPlug=true; await p.click('#beltTag'); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
      ok(t.mistakes.unrelated_factor===1 && t.dead && /did not move/.test(msg) && msg.includes(s.tagName),'plugging in something that changes nothing: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/4_unrelated.png'}); await speed(p,was); await carryOn(p); }
    else if(s.affects && !rolledBy){ rolledBy=true; await speed(p,8); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
      ok(t.mistakes.missed_factor===1 && /WOULD change/.test(msg),'a factor that matters rolled off the belt: '+msg.slice(0,100)); await speed(p,was); await carryOn(p); }
    else { await beltTag(p,s.affects); await speed(p,was); }
    await afterTag(p,s); if((await st(p)).frozen) break;
  }
  await frozen(p); msg=await p.textContent('#calloutText');
  ok(wrongPlug && rolledBy && /These change/.test(msg) && /These do not/.test(msg) && /Try one more/.test(msg),'two misses in a hunt: every factor is listed: '+msg.slice(0,90)); await p.screenshot({path:OUT+'/4b_answer.png'});
  await p.keyboard.press('Enter'); ok((await st(p)).n===n0+1,'and one more hunt is added');

  console.log('\n[5] Which way?');
  await open(p,{zone:2}); s=await st(p); ok(s.type==='way' && await p.isVisible('#ways') && s.rows===1,'started at zone 3: the machine is wired and shows its first reading');
  await p.keyboard.press('Enter'); ok(/Choose first/.test((await st(p)).line) && (await st(p)).bad===0,'cranking with no prediction only nudges');
  let sawDown=false, sawSame=false; const n1=s.n;
  for(let g=0;g<10;g++){
    s=await st(p); if(s.type!=='way'||s.zone!==2) break;
    const trap=(s.dir==='down'&&!sawDown)||(s.dir==='same'&&!sawSame);
    await setWay(p,trap?'up':s.dir); await p.keyboard.press('Enter'); await settled(p,s); t=await st(p);
    if(trap && s.dir==='down'){ sawDown=true; msg=await p.textContent('#calloutText'); ok(t.mistakes.more_is_more===1 && t.rows===5 && /goes DOWN/.test(msg),'"more means more" is caught after the gauge drops: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/5_down.png'}); await carryOn(p); }
    if(trap && s.dir==='same'){ sawSame=true; msg=await p.textContent('#calloutText'); ok(t.mistakes.not_related===1 && /never moved/.test(msg) && (await p.getAttribute('#gaugeFill','style')).includes('50%'),'a crank that changes nothing leaves the gauge still: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/5_same.png'}); await carryOn(p); }
    if(sawDown&&sawSame) break; await nextRound(p,s);
  }
  ok(sawDown&&sawSame&&(await st(p)).n===n1+2,'each miss adds another machine of the same kind');

  console.log('\n[6] Time, and the miswired machine');
  await open(p,{zone:3}); let timeTrap=false, times=new Set();
  for(let g=0;g<6;g++){
    s=await st(p); if(s.type!=='wire') break; times.add(s.time);
    if(s.time==='effect' && !timeTrap){ timeTrap=true; await p.keyboard.press(String(2-s.cause)); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
      ok((await st(p)).mistakes.time_always_cause===1 && /Time is not always the crank/.test(msg),'time on the crank when time is the effect: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/6_time.png'}); await p.keyboard.press('Enter'); }
    await playRound(p,s); await nextRound(p,s);
  }
  ok(timeTrap && times.has('cause') && times.has('effect'),'time was the crank in some machines and the gauge in others');
  s=await st(p); ok(s.type==='spot' && (await p.$$('.spot')).length===3 && !(await p.isVisible('#machine')),'then three machines to inspect'); await p.screenshot({path:OUT+'/6b_spot.png'});
  const fine=[0,1,2].filter(i=>i!==s.spotBad);
  await p.click(`[data-spot="${fine[0]}"]`); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.fine_machine===1 && (await p.$$('.spot.runs')).length===1 && /→/.test(await p.textContent('.spot.runs .s-out')) && /runs fine/.test(msg),'a machine that is wired right runs when tapped: '+(await p.textContent('.spot.runs .s-out')).slice(0,60)); await p.screenshot({path:OUT+'/6c_fine.png'});
  await p.keyboard.press('Enter'); await p.keyboard.press(String(fine[1]+1)); await frozen(p); msg=await p.textContent('#calloutText');
  ok(msg.includes(`Machine ${s.spotBad+1} is backwards`),'two misses: the backwards machine is named'); await carryOn(p); await p.waitForTimeout(200);
  ok((await p.$$('.spot.sparks')).length===1,'and it is shown sparking');

  console.log('\n[7] The boss: a mystery gauge and a machine of your own');
  await open(p,{zone:4}); s=await st(p); ok(await p.isVisible('#bossBar') && s.type==='mystery' && s.testsLeft===2 && (await p.textContent('#gaugeSock'))==='? ? ?' && (await p.$$('[data-test]')).length===3,'the gauge has no label, and two test runs are free');
  const dud=(s.real+1)%3; await testCrank(p,dud); t=await st(p);
  ok(t.tested[dud]==='nothing' && t.bad===0 && t.rows===0 && t.testsLeft===1 && /1 FREE TEST/.test(t.small),'testing a crank that does nothing costs nothing and leaves a note');
  await testCrank(p,s.real); await p.waitForFunction(()=>window.__lab.W.phase==='name'); t=await st(p);
  ok(t.tested[s.real]==='moved' && t.rows===5 && /^[\d.]+$/.test(await p.textContent('#gaugeRead')) && (await p.$$('[data-opt]')).length===3,'the right crank moves the gauge (numbers only, no unit): '+await p.textContent('#gaugeRead')); await p.screenshot({path:OUT+'/7_mystery.png'});
  await p.click(`[data-opt="${(s.opt+1)%3}"]`); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.wrong_gauge===1 && /that crank did nothing/.test(msg),'naming the wrong gauge is explained: '+msg.slice(0,110));
  await p.keyboard.press('Enter'); await p.keyboard.press(String(s.opt+1)); await p.waitForFunction(()=>window.__lab.W.phase==='gap');
  ok((await p.textContent('#gaugeSock'))===s.effectName && (await st(p)).bad===1,'naming it right labels the gauge: '+s.effectName); await nextRound(p,s);
  s=await st(p); await playRound(p,s); await nextRound(p,s);
  s=await st(p); ok(s.type==='build' && (await p.$$('[data-tag]')).length===6,'build your own: six tags on the bench');
  await p.keyboard.press('Enter'); ok(/one tag on the CRANK/.test((await st(p)).line),'an unfinished machine only nudges');
  await p.click(`[data-tag="${s.decoy}"]`); await p.click(`[data-tag="${s.effect}"]`); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.not_related===1 && (await st(p)).dead && /did not move/.test(msg),'a crank that has nothing to do with the gauge: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/7b_unrelated.png'});
  await p.keyboard.press('Enter'); ok((await st(p)).crank===null && (await p.$$('.tag.used')).length===0,'TRY AGAIN puts the tags back');
  await p.click(`[data-tag="${s.cause}"]`); await p.click('#crankSock'); ok((await st(p)).crank===null,'tapping a socket empties it');
  await p.click(`[data-tag="${s.cause}"]`); await p.click(`[data-tag="${s.effect}"]`); await p.keyboard.press('Enter'); await nextRound(p,s); t=await st(p);
  ok(t.type==='way' && t.follow && /YOUR MACHINE/.test(t.small) && t.n===s.n+1,'a real experiment is accepted, and the student predicts which way it goes');

  console.log('\n[8] Practice mode');
  await open(p,{zone:1,practice:true,fast:8}); ok(await p.isVisible('#practiceTag') && (await p.getAttribute('#meterBox','style')).includes('hidden'),'PRACTICE tag shows and the overload meter is hidden');
  await p.waitForTimeout(2500); s=await st(p); ok(s.beltI===0 && s.beltX<=0.5 && s.phase==='belt','the belt waits for the student');
  await beltTag(p,!s.affects); await frozen(p); t=await st(p); ok(t.meter===0 && t.lives===3 && t.bad===1,'a mistake is explained but adds no overload');

  console.log('\n[9] Lab shut down, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__lab.G; G.lives=1; G.meter=90; });
  s=await st(p); await p.keyboard.press(String(2-s.cause)); await p.keyboard.press('Enter'); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/LAB SHUT DOWN/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'LAB SHUT DOWN! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.ri===0,'all 3 fuses back and a fresh round');

  console.log('\n[10] Help pauses the belt');
  await open(p,{zone:1,fast:1}); await p.waitForTimeout(400); await p.keyboard.press('h'); const x1=(await st(p)).beltX; await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && x1===(await st(p)).beltX,'H opens the help and the belt stops');
  await p.keyboard.press('h'); await p.waitForTimeout(500); ok((await st(p)).beltX>x1,'closing help lets it roll again');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/cause-effect-lab/.test(fr.url()));
  await f.evaluate(()=>{ window.__lab.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
