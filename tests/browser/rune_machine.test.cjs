// Rune Machine (4-9, the action game): every zone through the real controls (the basket, the dials, choosing stones),
// each kind of mistake and what it costs, the hint card, practice, fail and retry, town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/rune_machine'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-9-rune-machine/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing, with outputs worked out by the game's own math module (rune.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./rune.js'); const f=window.__rune, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  const out={ zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, score:G.score, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, frozen:W.frozen, tries:W.tries,
    val:W.val, axis:W.axis, locked:W.locked, stage:W.stage, ci:W.ci, t:W.t, fed:[...W.fed], g:W.g?{...W.g}:null, di:W.di,
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes}, sign:document.getElementById('signText').textContent };
  if(r.rule) Object.assign(out,{ rule:{...r.rule}, ruleText:m.ruleText(r.rule,r.X,r.Y), X:r.X, Y:r.Y, forms:r.forms||[], broken:!!r.broken, preset:r.preset||null, fedRound:!!r.fed,
    inputs:r.inputs||[], outs:(r.inputs||[]).map(x=>m.run(r.rule,x)), far:!!r.far, target:r.target, answer:r.answer, strip:r.strip, stones:r.stones, rows:r.rows||[], hidden:r.hidden||[] });
  return out; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__rune.W.speed=v; },x);
// The test runs the game sped up, so it stops the clock while it works the controls (a student has about 5 seconds a stone).
const hold=(p)=>p.evaluate(()=>{ const W=window.__rune.W, was=W.speed; W.speed=0; return was; });
const PH=['catch','dials','back','feed'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__rune.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__rune, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__rune.W.frozen,null,{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ lineKeys:0, lineDrag:0, formKey:0, formTap:0, dialKeys:0, dialTap:0 };
/** Move the basket (or the chosen stone) along the number line, with the arrow keys or by dragging. */
async function moveTo(p,target){
  const s=await st(p); if(s.val===target) return;
  if((used.lineKeys+used.lineDrag)%2===0){ used.lineKeys++; let d=target-s.val; const key=d<0?'ArrowLeft':'ArrowRight'; d=Math.abs(d);
    for(let i=0;i<Math.floor(d/10);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<d%10;i++) await p.keyboard.press(key); }
  else { used.lineDrag++; const b=await (await p.$('#play')).boundingBox(); const at=(v)=>b.x+110+(v-s.axis.lo)/(s.axis.hi-s.axis.lo)*(b.width-220), y=b.y+452+40;
    await p.mouse.move(at(s.val),y); await p.mouse.down(); await p.mouse.move(at(target),y,{steps:6}); await p.mouse.up(); }
}
/** Catch every stone of a round (or, with `miss`, put the basket in the wrong place for the first one). */
async function playCatch(p){
  for(let guard=0;guard<12;guard++){ let s=await st(p); if(s.phase!=='catch'||s.report) break;
    await p.waitForFunction((ci)=>{ const W=window.__rune.W; return W.phase!=='catch' || (W.stage==='roll' && W.ci>=ci && !W.locked); },s.ci,{timeout:30000});
    s=await st(p); if(s.phase!=='catch') break;
    const was=await hold(p); await moveTo(p,s.outs[s.ci]); await speed(p,was);
    await p.waitForFunction((ci)=>{ const W=window.__rune.W; return W.phase!=='catch' || W.frozen || W.ci!==ci; },s.ci,{timeout:30000});
    if((await st(p)).frozen) break; }
}
/** Miss a stone by ADDING the multiplier (input + m). When that happens to be the right answer (2 + 2 = 2 × 2), catch it and miss the next. */
async function missByAdding(p){
  for(let guard=0;guard<5;guard++){ await p.waitForFunction(()=>{ const W=window.__rune.W; return W.phase==='catch' && W.stage==='roll' && !W.locked && !W.frozen; },null,{timeout:30000});
    const s=await st(p), bad=s.inputs[s.ci]+s.rule.m, was=await hold(p); await moveTo(p,bad); await speed(p,was);
    if(bad!==s.outs[s.ci]) return bad;
    await p.waitForFunction((ci)=>window.__rune.W.ci!==ci,s.ci,{timeout:30000}); }
  return null;
}
/** Set the machine's dials to a rule, with keys or by tapping. */
async function setDials(p,want){
  let s=await st(p);
  if(s.g.form!==want.form){ if(used.formKey<=used.formTap){ used.formKey++; for(let k=0;k<5&&(await st(p)).g.form!==want.form;k++) await p.keyboard.press('ArrowDown'); } else { used.formTap++; await p.click(`[data-form="${want.form}"]`); } }
  const keys={ times:['m'], plus:['b'], line:['m','b'], down:['b','m'] }[want.form];
  for(let i=0;i<keys.length;i++){ s=await st(p); let d=want[keys[i]]-s.g[keys[i]]; if(!d) continue;
    if(used.dialKeys<=used.dialTap){ used.dialKeys++; while((await st(p)).di!==i) await p.keyboard.press('Tab'); const key=d<0?'ArrowLeft':'ArrowRight'; d=Math.abs(d);
      for(let k=0;k<Math.floor(d/5);k++) await p.keyboard.press('Shift+'+key); for(let k=0;k<d%5;k++) await p.keyboard.press(key); }
    else { used.dialTap++; for(let k=0;k<Math.abs(d);k++) await p.click(`[data-dial="${i}"][data-turn="${d<0?-1:1}"]`); } }
  s=await st(p); return s.g.form===want.form && keys.every(k=>s.g[k]===want[k]);
}
async function runMachine(p){ if(used.dialKeys%2) await p.click('#goBtn'); else await p.keyboard.press('Enter');
  await p.waitForFunction(()=>{ const W=window.__rune.W; return W.frozen || (W.phase!=='test' && W.phase!=='dials'); },null,{timeout:30000}); }
async function feed(p,xs){ for(const x of xs){ const n=(await st(p)).fed.length; await moveTo(p,x); await p.keyboard.press('Enter'); await p.waitForFunction((n)=>window.__rune.W.fed.length>n || window.__rune.W.phase==='dials',n,{timeout:10000}); }
  await p.waitForFunction(()=>window.__rune.W.phase==='dials',null,{timeout:15000}); }
let setOk=true;
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='catch') return playCatch(p);
  if(s.type==='back'){ await moveTo(p,s.answer); return p.keyboard.press('Enter'); }
  if(s.type==='feed'){ await feed(p,[0,1,2,Math.min(5,s.strip.hi)]); s=await st(p); }
  setOk=(await setDials(p,s.rule))&&setOk; await runMachine(p);
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
  let rounds=0; const types=new Set(), forms=new Set(), shots=new Set(); let sawFar=false, sawBroken=false, sawOwn=0;
  for(let guard=0;guard<40;guard++){
    const s=await st(p); if(s.report) break;
    types.add(s.type); forms.add(s.rule.form); if(s.far) sawFar=true; if(s.broken) sawBroken=true;
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name);
      if(s.type==='catch'){ await speed(p,1); await p.waitForTimeout(2600); await p.screenshot({path:`${OUT}/${name}.png`}); await speed(p,5); }
      else if(s.type==='feed'){ await moveTo(p,2); await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.screenshot({path:`${OUT}/${name}.png`}); }
      else await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='feed'){ const left=s.stones-(await st(p)).fed.length; await feed(p,[0,1,5,3].slice(0,left)); const d=await st(p); sawOwn+=d.hidden.length;
      setOk=(await setDials(p,d.rule))&&setOk; if(!shots.has('fed')){ shots.add('fed'); await speed(p,1); await p.keyboard.press('Enter'); await p.waitForTimeout(2600); await p.screenshot({path:`${OUT}/${s.zone+2}_feed_test.png`}); await speed(p,5); await p.waitForFunction(()=>window.__rune.W.phase!=='test',null,{timeout:20000}); } else await runMachine(p); }
    else await playRound(p,await st(p));
    rounds++; await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__rune.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['catch','dials','back','feed'].every(t=>types.has(t)),'every move appeared: '+[...types].join(', '));
  ok(['times','plus','line','down'].every(f=>forms.has(f)),'every kind of rule appeared: '+[...forms].join(', '));
  ok(sawFar && sawBroken && sawOwn>=2,'a far-ahead catch, a broken rule to fix, and the machine\'s own test stones ('+sawOwn+')');
  ok(setOk,'every rule was set on the dials through the controls');
  ok(used.lineKeys>=3&&used.lineDrag>=3,`basket and stones moved by keys (${used.lineKeys}) and by dragging (${used.lineDrag})`);
  ok(used.formKey>=1&&used.formTap>=1&&used.dialKeys>=2&&used.dialTap>=2,`rule shape and dials set by keys and by tapping (${used.formKey}/${used.formTap}, ${used.dialKeys}/${used.dialTap})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no heat ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=30 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Catch: a basket in the wrong place, and the lock');
  await open(p); let s=await st(p); ok(s.type==='catch' && s.rule.form==='times','the rule is carved on the machine: '+s.ruleText);
  let was; const wrong=await missByAdding(p); const at=(await st(p)).ci;
  await p.waitForFunction(()=>window.__rune.W.locked,null,{timeout:20000}); was=await hold(p);
  ok(await p.textContent('#stone')==='?','the output is hidden while the stone flies'); await p.keyboard.press('ArrowRight');
  ok((await st(p)).val===wrong,'and the basket is locked once the stone goes in'); await speed(p,was);
  await frozen(p); s=await st(p); let msg=await p.textContent('#calloutText');
  ok(s.bad===1 && s.meter===25 && s.mistakes.add_vs_times===1,'adding instead of multiplying is recognised');
  ok(msg.includes('Your basket was at '+wrong) && /TIMES/.test(msg) && await p.textContent('#stone')===String(s.outs[at]),'the stone shows where it really landed: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/3_missed.png'});
  await p.keyboard.press('Enter'); await missByAdding(p); await frozen(p);
  s=await st(p); ok(await p.isVisible('#hint') && /MULTIPLY/.test(await p.textContent('#hintText')),'the same mistake twice opens the hint card ('+JSON.stringify(s.mistakes)+', basket '+s.val+', stone '+s.ci+' of '+s.inputs.join()+', rule '+s.ruleText+')'); await p.screenshot({path:OUT+'/3b_hint.png'});

  console.log('\n[4] Dials: the machine runs your rule on every row');
  await open(p,{zone:1}); s=await st(p); ok(s.type==='dials' && s.forms.length===2 && await p.isVisible('#tbl'),'started at zone 2: a table of '+s.rows.length+' rows for '+s.ruleText);
  await setDials(p,{form:'plus',m:1,b:s.rule.m}); await runMachine(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && /your rule makes \d+, but the machine makes \d+/.test(msg),'a rule that breaks is caught on the row where it breaks: '+msg.slice(0,120));
  ok((await p.$$('#tbl tr.bad')).length===1,'that row is marked in the table'); await p.screenshot({path:OUT+'/4_wrong_rule.png'});
  await carryOn(p); ok((await st(p)).phase==='dials','TURN THE DIALS AGAIN goes back to the dials');
  await setDials(p,{form:'times',m:s.rule.m+1,b:0}); await runMachine(p); msg=await p.textContent('#calloutText');
  ok(msg.includes('The rule: '+s.ruleText),'two misses show the rule: '+msg.slice(-30)); await carryOn(p); await nextRound(p,s);
  s=await st(p); await setDials(p,s.rule); await speed(p,1); await p.keyboard.press('Enter'); await p.waitForFunction(()=>document.getElementById('mach').classList.contains('glow'),null,{timeout:15000});
  ok((await p.$$('#tbl tr.ok')).length===s.rows.length,'the right rule lights every row'); await p.screenshot({path:OUT+'/4b_right_rule.png'});

  console.log('\n[5] Run it backward');
  await open(p,{zone:2}); s=await st(p); ok(s.type==='back' && (await p.textContent('#crate')).includes(String(s.target)),'started at zone 3: '+s.sign);
  await moveTo(p,s.answer+1); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && msg.includes('not '+s.target) && /Undo/.test(msg),'a wrong input shows what it made and how to undo: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/5_backward.png'});
  await p.keyboard.press('Enter'); await moveTo(p,s.answer); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(/ok/.test(await p.getAttribute('#crate','class')) && (await st(p)).bad===1,'the right input makes the target');

  console.log('\n[6] Feed the machine: a hidden rule');
  await open(p,{zone:3}); s=await st(p); ok(s.type==='feed' && await p.textContent('#mRule')==='? ? ?' && /4 LEFT/.test(s.sign),'started at zone 4: the rule is hidden, 4 stones to test');
  await feed(p,[3,3,3,3]); s=await st(p);
  ok(s.fedRound && s.rows.length===1 && s.hidden.length>=1,'feeding the same stone four times fills only one row');
  await setDials(p,s.rule); await speed(p,1); await p.keyboard.press('Enter'); await p.waitForFunction(()=>document.getElementById('mach').classList.contains('glow'),null,{timeout:15000});
  ok((await p.$$('#tbl tr.own')).length===s.hidden.length && (await st(p)).bad===0,'the machine tests the rule on stones of its own too (★), and the real rule still passes'); await p.screenshot({path:OUT+'/6_own_stones.png'});
  await speed(p,5); await nextRound(p,s); s=await st(p); await feed(p,[0,1,2,3]); s=await st(p);
  ok(s.rows.length===4 && s.rows[0].x===0 && s.rows[0].y===s.rule.b,'testing 0 shows the number the rule adds ('+s.rows[0].y+')');
  await setDials(p,{form:'plus',m:1,b:s.rule.b+1}); await runMachine(p); ok((await st(p)).bad===1 && (await st(p)).frozen,'a near-miss rule is caught');

  console.log('\n[7] The boss: a broken rule to fix');
  await open(p,{zone:4}); ok(await p.isVisible('#bossBar'),'the boss bar shows');
  for(let guard=0;guard<6;guard++){ s=await st(p); if(s.broken) break; await playRound(p,s); await nextRound(p,s); }
  s=await st(p); ok(s.broken && s.g.form==='plus' && s.g.b===s.preset.b && /FIX THE RULE/.test(s.sign),'the dials start on a rule that fits only the first row');
  await runMachine(p); msg=await p.textContent('#calloutText'); ok((await p.$$('#tbl tr.ok')).length===1 && (await p.$$('#tbl tr.bad')).length===1,'running it shows row 1 passing and row 2 breaking'); await p.screenshot({path:OUT+'/7_broken.png'});
  await carryOn(p); await setDials(p,s.rule); await runMachine(p); await p.waitForSelector('#report:not(.hidden)',{timeout:15000}); ok(true,'fixing it ends the boss');

  console.log('\n[8] Practice mode');
  await open(p,{practice:true,fast:1}); ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  await p.waitForTimeout(5600); ok((await st(p)).stage==='roll','stones roll in slower in practice (still rolling after 5.6 seconds)');
  await speed(p,6); await frozen(p); s=await st(p); ok(s.meter===0 && s.lives===3 && s.bad===1,'a miss is explained but adds no heat');

  console.log('\n[9] Machine sealed, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__rune.G; G.lives=1; G.meter=90; });
  s=await st(p); was=await hold(p); await moveTo(p,s.outs[0]>=3?s.outs[0]-3:s.outs[0]+3); await speed(p,was); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/MACHINE SEALED/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'MACHINE SEALED! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.ci===0,'all 3 torches back and a fresh round');

  console.log('\n[10] Help pauses the machine');
  await speed(p,1); await p.waitForTimeout(700); await p.keyboard.press('h'); const h1=(await st(p)).t; await p.waitForTimeout(500);
  ok(await p.isVisible('#briefing') && h1===(await st(p)).t,'H opens the help and the stone stops');
  await p.keyboard.press('h'); await p.waitForTimeout(400); ok(h1!==(await st(p)).t,'closing help starts it again');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/rune-machine/.test(fr.url()));
  await f.evaluate(()=>{ window.__rune.G.result={score:36,total:40,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
