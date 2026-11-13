// Trail Mapper (4-10, the action game): every zone through the real controls (stakes on the map, the pointer, the
// rule dials), each kind of mistake and what it costs, the hint card, practice, fail and retry, town messages,
// no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/trail_mapper'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-10-trail-mapper/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing (trail.js made the round, so it knows the answer).
const st=(p)=>p.evaluate(async()=>{ const m=await import('./trail.js'); const f=window.__trail, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden'), q=(s)=>document.querySelectorAll(s).length;
  const d=r.type==='rule'?m.dialsOf(r.rule):null;
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, fix:!!r.fix, hidden:!!r.hidden, backward:!!r.backward, rocks:!!r.rocks, frozen:W.frozen, tries:W.tries,
    stakes:W.stakes.map(x=>({...x})), cur:{...W.cur}, pv:W.pv, mi:W.mi, b:W.b, grid:r.grid, want:(r.want||[]).map(x=>({x:x.x,y:x.y})), fixed:(r.fixed||[]).length, badAt:r.bad, trap:r.trap||null,
    form:r.rule?r.rule.form:null, m:r.rule?r.rule.m:null, rb:r.rule?r.rule.b:null, given:r.given, answer:r.answer, wantMi:d?m.DIALS.m.indexOf(d.m):-1, wantB:d?d.b:null, rule:r.rule?m.ruleText(r.rule,r.X,r.Y):'', X:r.X,
    scoutX:W.shown.scout?W.shown.scout.x:null, flags:q('.flag'), lit:q('.flag.lit'), red:q('.flag.bad'), given2:q('.flag.given'), spots:q('.spot'), trail:q('.trail'), ghost:q('.ghost'), guide:q('.guide'), rocksOn:q('.rocks'),
    pointer:(document.querySelector('.pointer')||{className:{baseVal:''}}).className.baseVal, log:[...document.querySelectorAll('#logRows td')].map(x=>x.textContent), yes:q('#logRows td.yes'), no:q('#logRows td.no'),
    ruleText:document.getElementById('ruleText').textContent, dialM:document.getElementById('dialM').textContent, dialB:document.getElementById('dialB').textContent,
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes},
    sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent, line:document.getElementById('tline').textContent }; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__trail.W.speed=v; },x);
const PH=['stake','drop','rule'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__trail.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__trail, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__trail.W.frozen,null,{timeout:30000}); }
/** After Enter: the scout has walked and the game has said what happened. */
async function settled(p,s){ await p.waitForFunction(([r])=>{ const W=window.__trail.W; return W.frozen || W.phase==='gap' || W.ri!==r || W.phase==='idle'; },[s.ri],{timeout:30000}); }
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
const used={ keys:0, taps:0 };
const byKey=()=>{ const k=used.keys<=used.taps; if(k) used.keys++; else used.taps++; return k; };
/** Where a point of the graph is on the screen. */
async function at(p,g,x,y){ const b=await (await p.$('#map')).boundingBox(); return [b.x+(64+x/g.xStep*40)/500*b.width, b.y+(420-y/g.yStep*40)/470*b.height]; }
async function arrows(p,dx,dy){ const go=async(key,n)=>{ for(let i=0;i<Math.floor(n/5);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<n%5;i++) await p.keyboard.press(key); };
  await go(dx<0?'ArrowLeft':'ArrowRight',Math.abs(dx)); await go(dy<0?'ArrowDown':'ArrowUp',Math.abs(dy)); }
/** Put a stake on a crossing, or pick up the one that is there: by tapping it, or with the arrow keys and Space. */
async function stake(p,pt){ const s=await st(p), g=s.grid;
  if(byKey()){ await arrows(p,Math.round((pt.x-s.cur.x)/g.xStep),Math.round((pt.y-s.cur.y)/g.yStep)); await p.keyboard.press(' '); }
  else { const [x,y]=await at(p,g,pt.x,pt.y); await p.mouse.click(x,y); } }
async function setPointer(p,v){ const s=await st(p), g=s.grid, step=s.backward?g.xStep:g.yStep, d=Math.round((v-s.pv)/step);
  if(byKey()) await arrows(p,s.backward?d:0,s.backward?0:d); else { const [x,y]=s.backward?await at(p,g,v,g.yStep*4):await at(p,g,g.xStep*6,v); await p.mouse.click(x,y); }
  return (await st(p)).pv===v; }
async function setDials(p,mi,b){ const s=await st(p), keys=byKey(), turn=async(which,d)=>{ for(let i=0;i<Math.abs(d);i++){ if(keys) await p.keyboard.press(which==='m'?(d<0?'ArrowLeft':'ArrowRight'):(d<0?'ArrowDown':'ArrowUp')); else await p.click(`[data-dial="${which}"][data-by="${d<0?-1:1}"]`); } };
  await turn('m',mi-s.mi); await turn('b',b-s.b); const t=await st(p); return t.mi===mi && t.b===b; }
const has=(list,q)=>list.some(x=>x.x===q.x&&x.y===q.y);
let setOk=true;
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='stake'){ for(const q of s.stakes) if(!has(s.want,q)) await stake(p,q); for(const q of s.want) if(!has(s.stakes,q)) await stake(p,q); }
  else if(s.type==='drop') setOk=(await setPointer(p,s.answer))&&setOk;
  else setOk=(await setDials(p,s.wantMi,s.wantB))&&setOk;
  if(used.keys%2) await p.click('#goBtn'); else await p.keyboard.press('Enter');
  await settled(p,s);
}
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function open(p,{zone=0,practice=false,fast=5}={}){
  await p.goto(URL,{waitUntil:'load'});
  if(zone) await p.click(`[data-zone="${zone}"]`);
  if(practice) await p.click('#practiceBtn'); else await p.keyboard.press('Enter');
  await speed(p,fast); await ready(p);
}
const total=(m)=>Object.values(m).reduce((a,c)=>a+c,0);
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(16).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type: the map is the playfield');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const kinds=new Set(), shots=new Set();
  for(let guard=0;guard<50;guard++){
    const s=await st(p); if(s.report) break;
    const kind=s.type==='stake'?(s.fix?'fix':s.hidden?'hidden':'stake'):s.type==='drop'?(s.rocks?'rocks':s.backward?'back':'drop'):'rule'; kinds.add(kind);
    const name=`${s.zone+2}_${kind}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,s); rounds++;
    if(!shots.has(name+'_done')){ shots.add(name+'_done'); await p.screenshot({path:`${OUT}/${name}_done.png`}); }
    await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__trail.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['stake','drop','back','rule','fix','hidden','rocks'].every(k=>kinds.has(k)),'every kind of round appeared: '+[...kinds].join(', '));
  ok(setOk,'every pointer and dial was set through the controls');
  ok(used.keys>=15&&used.taps>=15,`played by keys (${used.keys}) and by tapping the map and buttons (${used.taps})`);
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and a fresh scout ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=35 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] Stake the trail');
  await open(p); let s=await st(p); ok(s.type==='stake' && s.flags===0 && s.log.filter(x=>x==='?').length===3 && s.ruleText===s.rule && s.trail===0,'a rule, a logbook with three empty rows, and a bare map: '+s.rule);
  await p.keyboard.press('Enter'); ok(/needs a stake/.test((await st(p)).line) && (await st(p)).bad===0,'sending the scout with no stakes only nudges');
  const w0=s.want[0], offPt={x:w0.x,y:w0.y+(w0.y+s.grid.yStep<=s.grid.yMax?1:-1)*s.grid.yStep};
  await stake(p,offPt); await stake(p,s.want[1]); await stake(p,s.want[2]); ok((await st(p)).flags===3,'three stakes on the map');
  const [fx,fy]=await at(p,s.grid,s.grid.xStep*9,s.grid.yStep*9); await p.mouse.click(fx,fy); ok(/pick it up first/.test((await st(p)).line) && (await st(p)).flags===3,'a fourth stake is not allowed');
  await p.keyboard.press('Enter'); await frozen(p); let t=await st(p); let msg=await p.textContent('#calloutText');
  ok(t.bad===1 && t.meter===25 && total(t.mistakes)===1 && t.red===1 && t.lit===2 && t.spots===1 && t.trail===1 && !t.log.includes('?') && !msg.includes(`(${w0.x}, ${w0.y})`),
    'the scout walks the real trail: two stakes light up, one is left behind, the logbook fills in: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/3_off.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='stake' && t.flags===3 && t.red===0 && t.trail===0 && t.log.includes('?'),'TRY AGAIN keeps the stakes and hides the trail again');
  await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok(/The trail goes through/.test(msg) && (await st(p)).lit===3,'two misses: the scout stakes the trail and names the points: '+msg.slice(-50)); await carryOn(p); await nextRound(p,s);
  s=await st(p); const sw=s.want.find(q=>q.x!==q.y && q.y<=s.grid.xMax && q.x<=s.grid.yMax);
  await stake(p,{x:sw.y,y:sw.x}); for(const q of s.want) if(q!==sw) await stake(p,q); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.swapped===1 && /ACROSS/.test(msg),'a stake with x and y swapped is named: '+msg.slice(0,120)); await p.screenshot({path:OUT+'/3b_swapped.png'});

  console.log('\n[4] Read the map');
  await open(p,{zone:1}); s=await st(p); ok(s.type==='drop' && !s.backward && s.trail===1 && s.pv!==s.answer && /read it from the map/.test(s.ruleText) && (await p.$$('.al.known')).length===1,'started at zone 2: the trail is drawn, the rule is not shown, and one number on the bottom axis is marked: '+s.sign);
  const ys=s.grid.yStep, wrongV=s.given%ys===0?s.given:(s.answer+ys<=s.grid.yMax?s.answer+ys:s.answer-ys);   // the x value itself, when the side axis has that number on it
  ok(await setPointer(p,wrongV),'the pointer slides along the side axis'); await p.keyboard.press('Enter'); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok((wrongV===s.given?t.mistakes.wrong_axis:total(t.mistakes))===1 && t.guide===1 && /bad/.test(t.pointer) && /UP to the trail/.test(msg) && t.log.includes(String(s.answer)),'a wrong reading: the scout shows the way up and across: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/4_wrong_axis.png'});
  await p.keyboard.press('Enter'); await nextRound(p,s); t=await st(p); ok(t.n===s.n+1,'a miss adds another reading of the same kind');
  s=t; await playRound(p,s); t=await st(p); ok(t.phase==='gap' && /lit/.test(t.pointer) && t.guide===1,'a right reading: the guide lands on the pointer');
  for(let g=0;g<8;g++){ await nextRound(p,s); s=await st(p); if(s.backward) break; await playRound(p,s); }
  ok(s.backward && /SLIDE THE POINTER TO THAT/.test(s.sign) && (await p.$$('.al.known')).length===1,'then backward: a height is given and the pointer is on the bottom axis: '+s.sign);
  await setPointer(p,s.answer===0?s.grid.xStep:s.answer-s.grid.xStep); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok(total((await st(p)).mistakes)===2 && /ACROSS|side/.test(msg),'a wrong reading backward is explained: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/4b_backward.png'});

  console.log('\n[5] Map to rule');
  await open(p,{zone:2}); s=await st(p); ok(s.type==='rule' && s.trail===1 && s.ghost===0 && /= [a-z]$/.test(s.ruleText) && await p.isVisible('#dials'),'started at zone 3: a trail on the map and two dials, starting at '+s.ruleText);
  await setDials(p,s.wantMi,s.wantB+1); await p.keyboard.press('Enter'); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.mistakes.forgot_start===1 && t.ghost===1 && t.no===3 && await p.isVisible('#logMine') && /sits above/.test(msg) && !msg.includes(s.rule),'the student\'s trail is drawn over the map and the logbook shows both: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/5_above.png'});
  await p.keyboard.press('Enter'); t=await st(p); ok(t.phase==='rule' && t.ghost===0,'TRY AGAIN clears the second trail');
  await setDials(p,(s.wantMi+2)%11,s.wantB); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText'); t=await st(p);
  ok(t.mistakes.steep===1 && msg.includes('The rule: '+s.rule) && t.ruleText===s.rule,'two misses: the rule is given and set on the dials: '+msg.slice(-40)); await carryOn(p); await nextRound(p,s);
  s=await st(p); await speed(p,1); await playRound(p,s); t=await st(p); ok(t.phase==='gap' && t.yes===3 && t.no===0 && /same trail/.test(t.line),'a right rule: both trails are one, and every logbook row matches'); await p.screenshot({path:OUT+'/5b_right.png'});

  console.log('\n[6] Fix the map');
  await open(p,{zone:3}); s=await st(p); ok(s.fix && s.flags===4 && s.stakes.filter(q=>!has(s.want,q)).length===1,'started at zone 4: four stakes, one of them off the trail');
  await p.keyboard.press('Enter'); await frozen(p); t=await st(p); msg=await p.textContent('#calloutText');
  ok(t.bad===1 && t.red===1 && t.lit===3 && msg.length>30,'sending the scout shows which stake is off: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/6_fix.png'});
  await p.keyboard.press('Enter'); const badPt=s.stakes[s.badAt]; const [bx,by]=await at(p,s.grid,badPt.x,badPt.y); await p.mouse.click(bx,by); ok((await st(p)).flags===3,'tapping a stake picks it up');
  await stake(p,s.want[s.badAt]); await p.keyboard.press('Enter'); await settled(p,s); t=await st(p); ok(t.phase==='gap' && t.lit===4,'moved to the right crossing, all four light up');

  console.log('\n[7] The boss: a head start, a buried rule, a buried trail');
  await open(p,{zone:4}); s=await st(p); ok(await p.isVisible('#bossBar') && s.form==='line' && s.want[0].x===0 && s.want[0].y===s.rb,'the trail does not start at zero: '+s.rule);
  await stake(p,{x:0,y:0}); await stake(p,s.want[1]); await stake(p,s.want[2]); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).mistakes.forgot_start===1 && /also adds/.test(msg),'starting the trail at 0 anyway is named: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/7_start.png'});
  await p.keyboard.press('Enter'); await stake(p,{x:0,y:0}); await stake(p,s.want[0]); await p.keyboard.press('Enter'); await nextRound(p,s);
  s=await st(p); ok(s.hidden && s.given2===2 && /\? \? \?/.test(s.ruleText) && s.log.filter(x=>x==='?').length===3,'then a buried rule: two gray stakes are given, three rows to carry on'); await p.screenshot({path:OUT+'/7b_hidden.png'});
  await playRound(p,s); await nextRound(p,s); s=await st(p); await playRound(p,s); await nextRound(p,s);
  s=await st(p); ok(s.rocks && s.backward && s.rocksOn===1,'then a buried trail: only the start of it can be seen'); await p.screenshot({path:OUT+'/7c_rocks.png'});
  await playRound(p,s); t=await st(p); ok(t.rocksOn===0 && t.guide===1 && /lit/.test(t.pointer),'the scout clears the rocks and lands on the pointer'); await nextRound(p,s);
  s=await st(p); ok(s.m===0.5,'last: a trail that climbs by a half: '+s.rule); await playRound(p,s); await p.waitForSelector('#report:not(.hidden)',{timeout:20000});
  ok(/× 0.5/.test((await st(p)).dialM),'the TIMES dial goes down to a half');

  console.log('\n[8] Practice mode');
  await open(p,{zone:3,practice:true}); ok(await p.isVisible('#practiceTag') && (await p.getAttribute('#meterBox','style')).includes('hidden'),'PRACTICE tag shows and the tired meter is hidden');
  await p.keyboard.press('Enter'); await frozen(p); t=await st(p); ok(t.meter===0 && t.lives===3 && t.bad===1,'a mistake is explained but costs nothing');

  console.log('\n[9] Trip over, then a fast retry');
  await open(p,{zone:3}); await p.evaluate(()=>{ const G=window.__trail.G; G.lives=1; G.meter=90; });
  await p.keyboard.press('Enter'); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/TRIP OVER/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'TRIP OVER! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.ri===0,'all 3 canteens back and a fresh map');

  console.log('\n[10] Help pauses the scout');
  await speed(p,0.15); await p.keyboard.press('Enter'); await p.waitForTimeout(500); await p.keyboard.press('h'); const x1=(await st(p)).scoutX; await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && x1!==null && x1===(await st(p)).scoutX,'H opens the help and the scout stops');
  await p.keyboard.press('h'); await p.waitForTimeout(600); ok((await st(p)).scoutX>x1,'closing help lets the scout walk on');

  console.log('\n[11] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/trail-mapper/.test(fr.url()));
  await f.evaluate(()=>{ window.__trail.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
