// Ride Gate (4-6, the action game): every zone through the real controls (let in / turn away, rule tiles, test
// riders), each kind of mistake and what it costs, the hint card, practice, fail and retry, town messages,
// no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/ride_gate'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-6-ride-gate/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing (gate.js made the round, so it knows the answer).
const st=(p)=>p.evaluate(async()=>{ const m=await import('./gate.js'); const f=window.__gate, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  const rider=r.type==='keep'?r.riders[Math.min(W.k,r.riders.length-1)]:null, rule=rider?rider.rule:r.rule||{};
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, mode:r.mode||null, rush:!!r.rush, frozen:W.frozen, tries:W.tries,
    k:W.k, kx:W.kx, misses:W.misses, count:r.type==='keep'?r.riders.length:0, v:rider?rider.v:null, should:rider?m.passes(rider.rule,rider.v):null,
    letter:rule.letter, sym:rule.sym, edge:rule.n, slots:[...W.slots], wsym:W.sym, tv:W.tv, testsLeft:W.testsLeft, notes:W.notes.map(x=>({...x})), range:r.range||null,
    tiles:(r.tiles||[]).map(t=>({id:t.id,t:t.t,v:t.v})), ruleText:rule.letter?m.ruleText(rule):'',
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes},
    riders:document.querySelectorAll('.rider').length, lamp:document.getElementById('lamp').className, board:document.getElementById('boardText').textContent,
    sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent, line:document.getElementById('gline').textContent }; });
let RATE=1; const speed=(p,x)=>{ RATE=x; return p.evaluate((v)=>{ window.__gate.W.speed=v; },x); };
// The test runs the game sped up, so it stops the clock while it reads a rider (a student has 5 seconds each).
const hold=(p)=>p.evaluate(()=>{ window.__gate.W.speed=0; }), go=(p)=>p.evaluate((v)=>{ window.__gate.W.speed=v; },RATE);
const PH=['keep','build','test'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__gate.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__gate, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__gate.W.frozen,null,{timeout:30000}); }
/** After Enter: the gate has run and the game has said what happened. */
async function settled(p,s){ await p.waitForFunction(([r])=>{ const W=window.__gate.W; return W.frozen || W.phase==='gap' || W.ri!==r || W.phase==='idle'; },[s.ri],{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ keys:0, taps:0 };
const byKey=()=>{ const k=used.keys<=used.taps; if(k) used.keys++; else used.taps++; return k; };
/** One rider at the gate. right: do the right thing, or the wrong one. */
async function keepRider(p,right=true){ await hold(p); const s=await st(p), letIn=right?s.should:!s.should;
  if(byKey()) await p.keyboard.press(letIn?'ArrowUp':'ArrowDown'); else await p.click(`[data-keep="${letIn?'in':'out'}"]`);
  await go(p); await afterRider(p,s); return s; }
async function afterRider(p,s){ await p.waitForFunction(([r,k])=>{ const W=window.__gate.W; return W.frozen || W.ri!==r || W.k!==k || W.phase!=='keep'; },[s.ri,s.k],{timeout:30000}); }
async function playKeep(p){ for(let g=0;g<12;g++){ await hold(p); const s=await st(p); if(s.type!=='keep'||s.phase!=='keep'){ await go(p); return; } await keepRider(p); if((await st(p)).ri!==s.ri) return; } }
const SYMKEYS={ '<':['<'], '≤':['<','<'], '>':['>'], '≥':['>','>'], '≠':['='] };
const FLIP={ '<':'>', '>':'<', '≤':'≥', '≥':'≤', '≠':'≠' }, STRICT={ '<':'≤', '≤':'<', '>':'≥', '≥':'>' }, OTHER={ '<':'≥', '≥':'<', '>':'≤', '≤':'>' };
/** Build "letter sym number" (or number first), where sym is as the rule is read letter-first. num: which number tile (default: the edge). */
async function build(p,s,sym,{numberFirst=false,num=s.edge,rawSym=null}={}){
  const letter=s.tiles.findIndex(t=>t.t==='var'), number=s.tiles.findIndex(t=>t.t==='num'&&t.v===num), order=numberFirst?[number,letter]:[letter,number], shown=rawSym||(numberFirst?FLIP[sym]:sym), keys=byKey();
  const tile=async(i)=>{ if(keys) await p.keyboard.press(String(i+1)); else await p.click(`[data-tile="${s.tiles[i].id}"]`); };
  await tile(order[0]); if(keys){ for(const k of SYMKEYS[shown]) await p.keyboard.press(k); } else await p.click(`[data-sym="${shown}"]`); await tile(order[1]);
}
async function setTV(p,target){ let s=await st(p), d=target-s.tv; const keys=byKey();
  if(keys){ const key=d<0?'ArrowLeft':'ArrowRight'; d=Math.abs(d); for(let i=0;i<Math.floor(d/5);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<d%5;i++) await p.keyboard.press(key); }
  else for(let i=0;i<Math.abs(d);i++) await p.click(`[data-tv="${d<0?-1:1}"]`);
  return (await st(p)).tv===target; }
async function sendTest(p,v){ const s=await st(p); await setTV(p,v); await p.keyboard.press('Enter'); await p.waitForFunction(([n])=>window.__gate.W.notes.length>n && window.__gate.W.phase!=='run',[s.notes.length],{timeout:30000}); }
let builtFlipped=0;
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='keep') return playKeep(p);
  if(s.mode==='hidden'){ for(const v of [s.edge,s.edge-1,s.edge+1]) await sendTest(p,v); await p.waitForFunction(()=>window.__gate.W.phase==='build'); }
  const nf=s.mode==='mirror'||(s.mode!=='mirror'&&s.ri%2===1); if(nf) builtFlipped++;
  await build(p,s,s.sym,{numberFirst:nf}); await p.keyboard.press('Enter'); await settled(p,s);
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
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type: the whole screen is the gate');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const kinds=new Set(), shots=new Set();
  for(let guard=0;guard<50;guard++){
    const s=await st(p); if(s.report) break;
    const kind=s.type==='keep'?(s.rush?'rush':'keep'):(s.mode||'sign'); kinds.add(kind);
    const name=`${s.zone+2}_${kind}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,s); rounds++;
    if(!shots.has(name+'_done')){ shots.add(name+'_done'); await p.screenshot({path:`${OUT}/${name}_done.png`}); }
    await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__gate.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['keep','sign','other','mirror','hidden','calc','record','rush'].every(k=>kinds.has(k)),'every kind of round appeared: '+[...kinds].join(', '));
  ok(builtFlipped>=6,`rules written number-first were accepted too (${builtFlipped})`);
  ok(used.keys>=15&&used.taps>=15,`played by keys (${used.keys}) and by tapping (${used.taps})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no grumbling ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=40 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Gatekeeper');
  await open(p); let s=await st(p); ok(s.type==='keep' && s.count===6 && s.board.length>10 && (await p.$$('[data-keep]')).length===2 && s.riders===1,'a sign, a rider walking up, and two buttons: '+s.board);
  await speed(p,8); await frozen(p); let t=await st(p); let msg=await p.textContent('#calloutText');
  ok(t.mistakes.too_slow===1 && t.meter===15 && /Too slow/.test(msg) && msg.includes(s.ruleText),'a rider who reaches the gate undecided costs a little: '+msg.slice(0,100)); await speed(p,5); await carryOn(p); await afterRider(p,s);
  let edge=false; const n0=s.n;
  for(let g=0;g<8;g++){ await hold(p); s=await st(p); if(s.phase!=='keep'||s.frozen){ await go(p); break; }
    if(s.v===s.edge && !edge){ edge=true; await keepRider(p,false); t=await st(p); msg=await p.textContent('#calloutText');
      ok(t.mistakes.boundary_rider===1 && /Exactly/.test(msg) && /alarm/.test(t.lamp),'the rider exactly on the edge, sorted wrongly: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/3_edge.png'}); await carryOn(p); await afterRider(p,s); }
    else await keepRider(p); }
  await frozen(p); msg=await p.textContent('#calloutText');
  ok(edge && /That sign as a rule: /.test(msg) && /one more gate/.test(msg),'two misses at one sign: the sign is shown as a rule: '+msg.slice(0,80));
  await p.keyboard.press('Enter'); ok((await st(p)).n===n0+1,'and one more gate is added');

  console.log('\n[4] Program the gate');
  await open(p,{zone:1}); s=await st(p); ok(s.type==='write' && (await p.$$('[data-sym]')).length===5 && (await p.$$('[data-tile]')).length===2 && s.riders===0,'started at zone 2: tiles, five symbols and an empty lane: '+s.board);
  await p.keyboard.press('Enter'); ok(/three parts/.test((await st(p)).line) && (await st(p)).bad===0,'running an unfinished rule only nudges');
  const near=s.sym==='≠'?'>':STRICT[s.sym], nearKey=s.sym==='≠'?'not_equal':'boundary';
  await build(p,s,near); await p.keyboard.press('Enter'); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.bad===1 && t.meter===25 && t.mistakes[nearKey]===1 && /Your gate (LET IN|TURNED AWAY)/.test(msg) && (await p.$$('.rider.wrong')).length===1 && /alarm/.test(t.lamp) && !msg.includes(s.ruleText),
    'the gate does what was written, and the inspector stops it at the rider it got wrong: '+msg.slice(0,120)); await p.screenshot({path:OUT+'/4_wrong.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='build' && t.slots.every(x=>x===null) && t.wsym===null && t.riders===0,'TRY AGAIN clears the rule and the lane');
  const far=s.sym==='≠'?'<':FLIP[s.sym]; await build(p,s,far); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok(msg.includes('The rule: '+s.ruleText),'two misses: the rule is given: '+msg.slice(-40)); await carryOn(p); await nextRound(p,s);
  s=await st(p); await p.click('[data-tile="L"]'); await p.click('[data-slot="0"]'); ok((await st(p)).slots[0]===null,'tapping a space empties it');
  await build(p,s,s.sym,{numberFirst:true}); await speed(p,1); await p.keyboard.press('Enter'); await settled(p,s); t=await st(p);
  ok(t.phase==='gap' && t.riders===6 && /fine/.test(t.lamp) && /every rider is sorted/.test(t.line),'a right rule, written number first, sorts all six riders: '+t.line); await p.screenshot({path:OUT+'/4b_right.png'});

  console.log('\n[5] The other side, and the mirrored display');
  await open(p,{zone:2}); s=await st(p); ok(s.mode==='other' && /^NO|NOT FOR/.test(s.board) && /KEPT OUT/.test(s.sign),'started at zone 3: the sign says who is kept out: '+s.board);
  await build(p,s,OTHER[s.sym]); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.other_side===1 && /keeps OUT/.test(msg),'writing the sign\'s own words lets in the wrong people: '+msg.slice(0,120)); await p.screenshot({path:OUT+'/5_other.png'});
  await p.keyboard.press('Enter'); await build(p,s,s.sym); await p.keyboard.press('Enter'); await nextRound(p,s);
  s=await st(p); ok(s.mode==='mirror' && /NUMBER FIRST/.test(s.sign),'then the mirrored display');
  await build(p,s,s.sym); await p.keyboard.press('Enter'); ok(/starts with the NUMBER/.test((await st(p)).line) && (await st(p)).bad===1,'letter first only nudges here');
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); ok((await st(p)).slots.every(x=>x===null) && (await st(p)).wsym===null,'Backspace clears the rule one piece at a time');
  await build(p,s,s.sym,{numberFirst:true,rawSym:s.sym}); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.flipped_order===1 && /turn around/.test(msg),'number first with the symbol not turned around: '+msg.slice(0,120)); await p.screenshot({path:OUT+'/5b_mirror.png'});
  await p.keyboard.press('Enter'); await build(p,s,s.sym,{numberFirst:true}); await p.keyboard.press('Enter'); await settled(p,s); ok((await st(p)).phase==='gap','turned around, it runs');

  console.log('\n[6] Hidden sign');
  await open(p,{zone:3}); s=await st(p); ok(s.mode==='hidden' && /▒/.test(s.board) && s.board.includes(String(s.edge)) && s.testsLeft===3 && s.tv!==s.edge && await p.isVisible('#skipBtn'),'started at zone 4: only the number is left on the sign: '+s.board);
  ok(await setTV(p,s.edge),'the test rider\'s number is the student\'s to choose'); await p.screenshot({path:OUT+'/6_test.png'});
  await p.keyboard.press('Enter'); await p.waitForFunction(()=>window.__gate.W.notes.length===1 && window.__gate.W.phase==='test'); t=await st(p);
  const edgeIn=['≤','≥'].includes(s.sym);
  ok(t.notes[0].v===s.edge && t.notes[0].opens===edgeIn && t.bad===0 && t.testsLeft===2 && !/fine|alarm/.test(t.lamp) && (await p.$$('.note')).length===1,'a test rider costs nothing and leaves a note: '+await p.textContent('.note'));
  await sendTest(p,s.edge+1); await p.click('#skipBtn'); t=await st(p);
  ok(t.phase==='build' && t.testsLeft===1 && (await p.$$('.note')).length===2 && /NOW WRITE/.test(t.sign),'the student can stop testing early and write the rule');
  await build(p,s,STRICT[s.sym]); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.boundary===1 && msg.includes('exactly '+s.edge),'the wrong symbol at the edge points back at the test: '+msg.slice(0,120)); await p.screenshot({path:OUT+'/6b_wrong.png'});
  await p.keyboard.press('Enter'); await build(p,s,s.sym); await p.keyboard.press('Enter'); await settled(p,s); ok((await st(p)).phase==='gap','the right rule opens the gate for the right riders');

  console.log('\n[7] The boss: work out the edge, beat the record, a fast gate');
  await open(p,{zone:4}); s=await st(p); ok(await p.isVisible('#bossBar') && s.mode==='calc' && s.tiles.length===4,'three number tiles: the edge has to be worked out: '+s.board.slice(0,70));
  const decoy=s.tiles.find(x=>x.t==='num'&&x.v!==s.edge).v;
  await build(p,s,s.sym,{num:decoy}); await p.keyboard.press('Enter'); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes.calc_first===1 && t.riders===0 && /Work it out first/.test(msg) && / = /.test(msg),'a number straight off the sign is not the edge: '+msg.slice(0,120)); await p.screenshot({path:OUT+'/7_calc.png'});
  await p.keyboard.press('Enter'); await build(p,s,s.sym); await p.keyboard.press('Enter'); await nextRound(p,s);
  s=await st(p); ok(s.mode==='record' && s.sym==='<' && !Number.isInteger(s.edge*10)===false,'then a lap record with a decimal: '+s.board);
  await build(p,s,'>'); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.direction===1 && /FEWER seconds/.test(msg),'"beat the record" means less time: '+msg.slice(0,120));
  await p.keyboard.press('Enter'); await build(p,s,s.sym); await p.keyboard.press('Enter'); await nextRound(p,s);
  for(let k=0;k<2;k++){ s=await st(p); await playRound(p,s); await nextRound(p,s); }
  s=await st(p); ok(s.rush && s.count===9 && /KEEPS CHANGING/.test(s.small),'last: a fast gate where the sign keeps changing');
  const boards=new Set(); for(let g=0;g<9;g++){ await hold(p); t=await st(p); if(t.phase!=='keep'){ await go(p); break; } boards.add(t.board); await keepRider(p); }
  ok(boards.size===3,'three different signs in one line of riders');

  console.log('\n[8] Practice mode');
  await open(p,{practice:true,fast:8}); ok(await p.isVisible('#practiceTag') && (await p.getAttribute('#meterBox','style')).includes('hidden'),'PRACTICE tag shows and the grumble meter is hidden');
  await p.waitForTimeout(2500); s=await st(p); ok(s.k===0 && s.kx<1 && s.phase==='keep' && !s.frozen,'the rider waits at the gate');
  await keepRider(p,false); t=await st(p); ok(t.meter===0 && t.lives===3 && t.bad===1,'a mistake is explained but adds no grumbling');

  console.log('\n[9] Gate closed, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__gate.G; G.lives=1; G.meter=90; });
  await hold(p); s=await st(p); await p.keyboard.press(s.should?'ArrowDown':'ArrowUp'); await go(p); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/GATE CLOSED/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'GATE CLOSED! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.ri===0 && s.k===0,'all 3 passes back and a fresh line');

  console.log('\n[10] Help pauses the line');
  await speed(p,1); await p.waitForTimeout(400); await p.keyboard.press('h'); const x1=(await st(p)).kx; await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && x1===(await st(p)).kx,'H opens the help and the rider stops');
  await p.keyboard.press('h'); await p.waitForTimeout(500); ok((await st(p)).kx>x1,'closing help lets them walk again');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/ride-gate/.test(fr.url()));
  await f.evaluate(()=>{ window.__gate.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
