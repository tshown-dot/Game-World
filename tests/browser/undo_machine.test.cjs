// Undo Machine (4-3, the action game): every zone through the real controls (placing the cart, the push dial, tiles),
// each kind of mistake and what it costs, the fuse, free test carts, the hint card, practice, fail and retry,
// town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/undo_machine'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-3-undo-machine/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing (undo.js made the round, so it knows the answer).
const st=(p)=>p.evaluate(async()=>{ const m=await import('./undo.js'); const f=window.__undo, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  const run=r.type==='build'?r.run:r;
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, score:G.score, practice:G.practice, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, kind:r.kind, frozen:W.frozen, tries:W.tries,
    v:W.v, testsLeft:W.testsLeft, tests:[...W.tests], fuseLeft:W.fuseLeft, slots:[...W.slots], op:W.op,
    unknown:run.unknown, x:run.x, c:run.c, a:run.a, s:run.s, push:run.push, letter:run.letter, flipped:run.flipped, fuse:run.fuse, axis:run.axis, eq:run.kind?m.eqText(run):'', tiles:(r.tiles||[]).map(t=>t.id), story:r.story||null,
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes}, sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent }; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__undo.W.speed=v; },x);
// The test runs the game sped up, so it stops the clock while it works the controls (a student has a 14 second fuse).
const hold=(p)=>p.evaluate(()=>{ const W=window.__undo.W, was=W.speed; W.speed=0; return was; });
const PH=['set','build'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__undo.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__undo, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__undo.W.frozen,null,{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ keys:0, drag:0, dial:0, buildKeys:0, buildTap:0 };
/** Set the cart's start (or the push) to a number: arrow keys, dragging the cart, or the dial's buttons. */
async function setTo(p,target){
  const was=await hold(p), s=await st(p); let d=target-s.v;
  if(d){ const n=used.keys+used.drag+used.dial, how=s.unknown==='start' ? (n%2?'drag':'keys') : (n%2&&Math.abs(d)<=24?'dial':'keys'); used[how]++;
    if(how==='keys'){ const key=d<0?'ArrowLeft':'ArrowRight'; d=Math.abs(d); for(let i=0;i<Math.floor(d/10);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<d%10;i++) await p.keyboard.press(key); }
    if(how==='dial') for(let i=0;i<Math.abs(d);i++) await p.click(d<0?'#dialDown':'#dialUp');
    if(how==='drag'){ const b=await (await p.$('#track')).boundingBox(); const at=(v)=>b.x+110+(v-s.axis.lo)/(s.axis.hi-s.axis.lo)*(b.width-220), y=b.y+86;
      await p.mouse.move(at(s.v),y); await p.mouse.down(); await p.mouse.move(at(target),y,{steps:6}); await p.mouse.up(); } }
  await speed(p,was); return (await st(p)).v===target;
}
/** Launch and wait until the cart has stopped and the game has said what happened. */
async function launch(p){ const s=await st(p); if((used.keys+used.drag)%2) await p.click('#goBtn'); else await p.keyboard.press('Enter');
  await p.waitForFunction(([t,r])=>{ const W=window.__undo.W; return W.frozen || W.phase==='gap' || W.ri!==r || (W.phase==='set' && W.testsLeft!==t) || W.phase==='idle'; },[s.testsLeft,s.ri],{timeout:30000}); }
const WAYS={ start_plus:['L','+','p','q'], start_minus:['L','-','p','q'], push_plus:['p','+','L','q'], push_minus:['p','-','L','q'] };
async function build(p,s,[first,op,second,third],how){
  for(const id of [first,second,third]){ if(how==='keys') await p.keyboard.press(String(s.tiles.indexOf(id)+1)); else await p.click(`[data-tile="${id}"]`); }
  if(how==='keys') await p.keyboard.type(op); else await p.click(`[data-op="${op}"]`);
}
let setOk=true;
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='build'){ const keys=used.buildKeys<=used.buildTap; if(keys) used.buildKeys++; else used.buildTap++; await build(p,s,WAYS[s.kind],keys?'keys':'tap'); return p.keyboard.press('Enter'); }
  for(let k=s.testsLeft;k>0;k--){ await setTo(p,s.x+(k===2?-4:3)); await launch(p); }          // free test carts first
  setOk=(await setTo(p,s.x))&&setOk; await launch(p);
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
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type: the whole screen is the game');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const kinds=new Set(), shots=new Set(); let flipped=0, big=0;
  for(let guard=0;guard<40;guard++){
    const s=await st(p); if(s.report) break;
    kinds.add(s.type==='build'?'build':s.kind); if(s.flipped) flipped++; if(s.axis&&s.axis.hi===100) big++;
    const name=`${s.zone+2}_${s.type==='build'?'build':s.kind}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,s); rounds++;
    if(!shots.has('done'+s.zone) && s.type==='run'){ shots.add('done'+s.zone); await p.screenshot({path:`${OUT}/${s.zone+2}_landed.png`}); }
    await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__undo.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['start_plus','start_minus','push_plus','push_minus','build','two','mystery'].every(k=>kinds.has(k)),'every kind of round appeared: '+[...kinds].join(', '));
  ok(flipped>=2 && big>=2,`flipped equations (${flipped}) and a track to 100 (${big})`);
  ok(setOk,'every cart and push was set through the controls');
  ok(used.keys>=3&&used.drag>=3&&used.dial>=1,`set by arrow keys (${used.keys}), dragging the cart (${used.drag}) and the dial buttons (${used.dial})`);
  ok(used.buildKeys>=1&&used.buildTap>=1,'equations built by keys and by tapping tiles');
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no pressure ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=27 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Find the start: the cart misses the flag');
  await open(p); let s=await st(p); ok(s.unknown==='start' && s.v!==s.x && (await p.textContent('#eq'))===s.eq,'the equation is on the board and the cart does not start on the answer: '+s.eq);
  await setTo(p,s.c); await speed(p,1); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok((await st(p)).phase==='run' && Number(await p.textContent('.cart'))!==s.c,'the cart rolls along the track (now at '+(await p.textContent('.cart'))+')'); await speed(p,5);
  await frozen(p); s=await st(p); let msg=await p.textContent('#calloutText');
  ok(s.bad===1 && s.meter===25 && s.mistakes.started_on_flag===1 && /not where it starts/.test(msg),'starting on the flag is explained: '+msg.slice(0,110));
  ok((await p.$$('.cart.bad')).length===1 && /, not /.test(await p.textContent('#eqLine')),'the board shows the check: '+await p.textContent('#eqLine')); await p.screenshot({path:OUT+'/3_missed.png'});
  await p.keyboard.press('Enter'); ok((await st(p)).phase==='set' && (await p.$$('.cart.bad')).length===0,'TRY AGAIN puts the cart back');
  await setTo(p,s.x+2); await launch(p); msg=await p.textContent('#calloutText');
  ok(/PAST|SHORT/.test(msg) && msg.includes('The answer: '+s.letter+' = '+s.x),'two misses: how far off, and the answer: '+msg.slice(-60));
  await carryOn(p); await nextRound(p,s); s=await st(p); await setTo(p,s.c); await launch(p);
  ok(await p.isVisible('#hint') && /END of the run/.test(await p.textContent('#hintText')),'the same mistake twice opens the hint card'); await p.screenshot({path:OUT+'/3b_hint.png'});

  console.log('\n[4] Find the push');
  await open(p,{zone:1}); s=await st(p); ok(s.unknown==='push' && await p.isVisible('#pushDial') && (await p.$$('.cart.fixed')).length===1,'started at zone 2: the cart is fixed and the push is on a dial: '+s.eq);
  await setTo(p,s.c); await launch(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.used_total===1 && /is the flag, not the push/.test(msg),'using the flag number as the push is explained: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/4_push.png'});
  await p.keyboard.press('Enter'); await setTo(p,s.x); await launch(p); ok((await st(p)).phase==='gap' && /✓/.test(await p.textContent('#eqLine')),'the right push lands on the flag: '+await p.textContent('#eqLine'));

  console.log('\n[5] Rush: the fuse');
  await open(p,{zone:2,fast:1}); s=await st(p); ok(s.fuse>0 && /LAUNCH \(ENTER\) · \d+/.test(await p.textContent('#goBtn')),'started at zone 3: the launch button counts down: '+await p.textContent('#goBtn'));
  await speed(p,8); await frozen(p); ok((await st(p)).bad===1,'when the fuse runs out the machine fires by itself');

  console.log('\n[6] Write it');
  await open(p,{zone:3}); s=await st(p); ok(s.type==='build' && s.story.length>30 && await p.isVisible('#tiles') && !(await p.isVisible('#track')),'started at zone 4: '+s.story.slice(0,80));
  await p.keyboard.press('Enter'); ok(/Fill every space/.test(await p.textContent('#eqLine')) && (await st(p)).bad===0,'an unfinished equation only nudges');
  const w=WAYS[s.kind]; await build(p,s,[w[0],w[1]==='+'?'-':'+',w[2],w[3]],'tap'); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && /does not tell the story/.test(msg),'the wrong operation is explained: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/6_wrong_story.png'});
  await p.keyboard.press('Enter'); ok((await p.$$('#slots .slot.full')).length===0,'TRY AGAIN clears the spaces');
  const other={ start_plus:['q','-','p','L'], start_minus:['q','+','p','L'], push_plus:['q','-','p','L'], push_minus:['q','+','L','p'] }[s.kind];
  await build(p,s,other,'keys'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(/tells the story/.test(await p.textContent('#eqLine')) && (await st(p)).bad===1,'another true way of writing it is accepted ('+other.join(' ')+')'); await nextRound(p,s);
  let t=await st(p); ok(t.type==='run' && (await p.textContent('#story'))===s.story && await p.isVisible('#track'),'then the cart runs that equation, with the story still showing: '+t.eq);

  console.log('\n[7] The boss: two pushes and a mystery machine');
  await open(p,{zone:4}); s=await st(p); ok(await p.isVisible('#bossBar') && s.kind==='two' && /then/.test(await p.textContent('.pushlab')),'two pushes in a row: '+s.eq);
  await setTo(p,s.c-s.a); await launch(p); msg=await p.textContent('#calloutText'); ok((await st(p)).mistakes.combine===1 && /TWO pushes/.test(msg),'undoing only one push is explained: '+msg.slice(0,100));
  await p.keyboard.press('Enter'); await setTo(p,s.x); await launch(p); await nextRound(p,s);
  s=await st(p); ok(s.kind==='mystery' && s.testsLeft===2 && /\? \?/.test(await p.textContent('#eq')) && /TEST CART/.test(await p.textContent('#goBtn')),'mystery machine: the push is hidden and 2 test carts are free');
  await setTo(p,20); await launch(p); t=await st(p);
  ok(t.testsLeft===1 && t.bad===1 && t.tests[0]===`20 → ${20+s.push}` && (await p.textContent('.tests')).includes('→'),'a test cart costs nothing and leaves a note: '+t.tests[0]); await p.screenshot({path:OUT+'/7_mystery.png'});
  await setTo(p,10); await launch(p); ok(/THIS ONE COUNTS/.test((await st(p)).small),'after the tests, the next cart counts');
  await setTo(p,s.x); await launch(p); ok((await st(p)).bad===1 && (await st(p)).phase==='gap','working backward from the flag lands it');

  console.log('\n[8] Practice mode');
  await open(p,{zone:2,practice:true,fast:8}); ok(await p.isVisible('#practiceTag') && !/·/.test(await p.textContent('#goBtn')),'PRACTICE tag shows and there is no fuse on the button');
  await p.waitForTimeout(3000); ok((await st(p)).phase==='set','the machine waits for the student');
  s=await st(p); await setTo(p,s.x+1); await launch(p); s=await st(p); ok(s.meter===0 && s.lives===3 && s.bad===1,'a mistake is explained but adds no pressure');

  console.log('\n[9] Machine down, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__undo.G; G.lives=1; G.meter=90; });
  s=await st(p); await setTo(p,s.c); await p.keyboard.press('Enter'); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/MACHINE DOWN/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'MACHINE DOWN! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.ri===0,'all 3 boilers back and a fresh round');

  console.log('\n[10] Help pauses the machine');
  await speed(p,0.3); await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('h'); const h1=await p.textContent('.cart'); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && h1===await p.textContent('.cart'),'H opens the help and the cart stops (at '+h1+')');
  await p.keyboard.press('h'); await speed(p,2); await p.waitForTimeout(500); ok(h1!==await p.textContent('.cart'),'closing help lets it roll again');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/undo-machine/.test(fr.url()));
  await f.evaluate(()=>{ window.__undo.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
