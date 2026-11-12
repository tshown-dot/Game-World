// Force Field (4-7, the action game): every zone through the real controls (keys, buttons, dragging, tapping pods),
// each kind of mistake and what it costs, the hint card, practice, fail and retry, town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/force_field'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-7-force-field/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const near=(a,b)=>Math.abs(a-b)<1e-6;
// What the game is showing right now (the rule comes from field.js, which made it).
const st=(p)=>p.evaluate(()=>{ const f=window.__field, W=f.W, G=f.G, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  return { zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, score:G.score, practice:G.practice, phase:W.phase, mode:W.wave.mode, wi:W.wi, n:W.waves.length,
    rule:W.wave.rule, graph:W.graph, band:W.band, active:W.active, frozen:W.frozen, marks:W.marks.length, prepLeft:W.prepLeft,
    pods:W.pods.map(q=>({v:q.v,i:q.i,state:q.state})), banner:vis('banner'), report:vis('report'), hint:vis('hint'), fail:vis('fail'), callout:vis('callout'),
    sign:document.getElementById('signText').textContent, mistakes:{...G.mistakes} }; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__field.W.speed=v; },x);
async function prep(p){ await p.waitForFunction(()=>{ const W=window.__field.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (W.phase==='prep' && hid('banner')); },null,{timeout:30000}); }
async function nextWave(p,s){ await p.waitForFunction(([z,w])=>{ const f=window.__field, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.wi!==w) && W.phase==='prep' && hid('banner')); },[s.zone,s.wi],{timeout:40000}); }
async function frozen(p){ await p.waitForFunction(()=>window.__field.W.frozen,null,{timeout:20000}); }
const isSol=(r,v)=>near(v,r.n) ? (r.sym==='≤'||r.sym==='≥') : (r.sym==='<'||r.sym==='≤' ? v<r.n : v>r.n);
const wantGraph=(r)=>({ edge:r.n, dir:r.sym==='>'||r.sym==='≥'?'right':'left', closed:r.sym==='≤'||r.sym==='≥' });
// Where a value is on the screen.
async function at(p,v,range){ const b=await (await p.$('#scene')).boundingBox(); return { x:b.x+(90+(v-range.lo)/(range.hi-range.lo)*1186)/1366*b.width, y:b.y+520/698*b.height }; }
const used={ keys:0, buttons:0, drag:0, tapEdge:0, tapLine:0, zapKey:0, zapTap:0 };
async function moveKeys(p,from,to,step){ let n=Math.round((to-from)/step); const key=n<0?'ArrowLeft':'ArrowRight'; n=Math.abs(n);
  for(let i=0;i<Math.floor(n/10);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<n%10;i++) await p.keyboard.press(key); }
async function dragEdge(p,from,to,range){ const a=await at(p,from,range), b=await at(p,to,range); await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(b.x,b.y,{steps:6}); await p.mouse.up(); }
/** Set the single-edge graph with one kind of control. */
async function setGraph(p,want,how){
  let s=await st(p); const range=s.rule.range, steps=Math.abs(Math.round((want.edge-s.graph.edge)/range.step));
  if(how==='buttons' && steps>24) how='keys';
  used[how]++;
  if(how==='keys'){ await moveKeys(p,s.graph.edge,want.edge,range.step);
    for(let k=0;k<2;k++){ s=await st(p); if(s.graph.dir!==want.dir) await p.keyboard.press(k?'ArrowDown':'ArrowUp'); }
    s=await st(p); if(s.graph.closed!==want.closed) await p.keyboard.press('Space'); }
  if(how==='buttons'){ const id=want.edge<s.graph.edge?'#stepL':'#stepR'; for(let i=0;i<steps;i++) await p.click(id);
    await p.click(want.dir==='left'?'#leftBtn':'#rightBtn'); s=await st(p); if(s.graph.closed!==want.closed) await p.click('#circleBtn'); }
  if(how==='drag'){ if(!near(s.graph.edge,want.edge)) await dragEdge(p,s.graph.edge,want.edge,range);
    await p.click(want.dir==='left'?'#leftBtn':'#rightBtn'); s=await st(p);
    if(s.graph.closed!==want.closed){ used.tapEdge++; const c=await at(p,want.edge,range); await p.mouse.click(c.x,c.y); } }
  if(how==='tap'){ used.tapLine++; const c=await at(p,want.edge,range); await p.mouse.click(c.x,c.y-40);   // tap the line: the edge jumps there
    await p.click(want.dir==='left'?'#leftBtn':'#rightBtn'); s=await st(p); if(s.graph.closed!==want.closed) await p.keyboard.press('Space'); }
  const g=(await st(p)).graph; return near(g.edge,want.edge) && g.dir===want.dir && g.closed===want.closed;
}
async function setBand(p,how){
  let s=await st(p); const b=s.rule.band, range=s.rule.range;
  for(const e of ['a','b']){
    s=await st(p);
    if(how==='keys'){ if(s.active!==e) await p.keyboard.press('Tab'); await moveKeys(p,s.band[e],b[e],range.step); if(s.band[e+'Closed']!==b[e+'Closed']) await p.keyboard.press('Space'); }
    else { await dragEdge(p,s.band[e],b[e],range); if(s.band[e+'Closed']!==b[e+'Closed']){ const c=await at(p,b[e],range); await p.mouse.click(c.x,c.y); } }
  }
  const z=(await st(p)).band; return near(z.a,b.a) && near(z.b,b.b) && z.aClosed===b.aClosed && z.bClosed===b.bClosed;
}
/** Shield offline: zap every pod that is not a solution, by its number key or by tapping it. */
async function playZap(p){
  const zapped=new Set();
  for(let guard=0;guard<600;guard++){
    const s=await st(p); if(s.mode!=='zap'||s.phase!=='run'||s.frozen||s.report) break;
    const target=s.pods.find(q=>q.state==='fall' && !isSol(s.rule,q.v) && !zapped.has(q.i));
    if(!target){ await p.waitForTimeout(40); continue; }
    zapped.add(target.i);
    if(zapped.size%2){ used.zapKey++; await p.keyboard.press(String(target.i+1)); }
    else { used.zapTap++; const r=await p.evaluate((i)=>{ const b=window.__field.W.pods[i].el.getBoundingClientRect(); return { x:b.x+b.width/2, y:b.y+b.height/2+6 }; },target.i); await p.mouse.click(r.x,r.y); }
  }
}
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function open(p,{zone=0,practice=false,fast=5}={}){
  await p.goto(URL,{waitUntil:'load'});
  if(zone) await p.click(`[data-zone="${zone}"]`);
  if(practice) await p.click('#practiceBtn'); else await p.keyboard.press('Enter');
  await speed(p,fast); await prep(p);
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
  await p.keyboard.press('Enter'); await speed(p,5); await prep(p);
  const hows=['keys','buttons','drag','tap']; let waves=0, setOk=0, pods=0; const modes=new Set(), kinds=new Set(), shots=new Set(); let cluesOk=true;
  for(let guard=0;guard<40;guard++){
    let s=await st(p); if(s.report) break;
    modes.add(s.mode); kinds.add(s.rule.kind); pods+=s.rule?0:0;
    const name=`${s.zone+2}_${s.mode}_${s.rule.kind}`, shoot=!shots.has(s.zone+s.mode);
    if(s.mode==='zap'){ await speed(p,2); await p.keyboard.press('Enter'); if(shoot){ shots.add(s.zone+s.mode); await p.waitForTimeout(1500); await p.screenshot({path:`${OUT}/${name}.png`}); } await playZap(p); await speed(p,5); }
    else {
      if(s.mode==='hidden') cluesOk=cluesOk && s.marks>=4 && /SHADE THE SAME RULE/.test(s.sign);
      const good=s.mode==='band' ? await setBand(p,waves%2?'drag':'keys') : await setGraph(p,wantGraph(s.rule),hows[waves%4]);
      if(good) setOk++; else console.log('  (could not set the graph for '+s.rule.sign+')');
      if(shoot){ shots.add(s.zone+s.mode); await speed(p,1); await p.keyboard.press('Enter'); await p.waitForTimeout(3300); await p.screenshot({path:`${OUT}/${name}.png`}); await speed(p,5); }
      else await p.keyboard.press('Enter');
    }
    waves++; await nextWave(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  const end=await st(p); const res=await p.evaluate(()=>window.__field.G.result);
  ok(true,`finished all 5 zones (${waves} waves)`);
  ok(setOk===waves-2,`every graph was set through the controls (${setOk} of ${waves-2} graph waves)`);
  ok(used.keys>=1&&used.buttons>=1&&used.drag>=1&&used.tapLine>=1,`edge moved by keys (${used.keys}), buttons (${used.buttons}), dragging (${used.drag}) and tapping the line (${used.tapLine}); circle tapped ${used.tapEdge} times`);
  ok(used.zapKey>=2&&used.zapTap>=2,`pods zapped by number key (${used.zapKey}) and by tapping (${used.zapTap})`);
  ok(['graph','zap','hidden','band'].every(m=>modes.has(m)),'every kind of wave appeared: '+[...modes].join(', '));
  ok(['plain','decimal','words','story','solve','band'].every(k=>kinds.has(k)),'every kind of rule appeared: '+[...kinds].join(', '));
  ok(cluesOk,'hidden rules: the test pods left their marks before the student had to shade');
  ok(end.bad===0 && end.lives===3,'a correct graph every time means no mistakes and no damage ('+end.good+' pods right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=60 && res.stars===3,'result for the town: boss beaten, '+res.total+' pods judged, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] The wrong circle costs exactly the edge value');
  await open(p); let s=await st(p); let want=wantGraph(s.rule);
  await setGraph(p,{...want,closed:!want.closed},'keys'); await p.keyboard.press('Enter'); await frozen(p);
  s=await st(p); let msg=await p.textContent('#calloutText');
  ok(s.bad===1 && Object.keys(s.mistakes).join()===(want.closed?'edge_included':'edge_excluded'),'only the pod ON the edge exposes it: '+Object.keys(s.mistakes).join());
  ok(new RegExp(want.closed?'CLOSED circle':'OPEN circle').test(msg) && msg.includes(String(s.rule.n)),'and the pod says why: '+msg.slice(0,110));
  ok(s.meter===25 && s.lives===3 && s.good>=0,'the mistake adds damage (meter '+s.meter+')');
  await p.screenshot({path:OUT+'/3_wrong_circle.png'});
  await p.keyboard.press('Space'); await p.keyboard.press('Enter'); await nextWave(p,s);
  ok((await st(p)).bad===1,'fixing the circle while the action is stopped saves the rest of the wave');

  console.log('\n[4] Nothing shaded, then the wrong side: the hint card');
  await open(p); s=await st(p); want=wantGraph(s.rule);
  await p.keyboard.press('Enter'); await frozen(p);
  msg=await p.textContent('#calloutText'); ok(/should LAND/.test(msg) && /shade to the (LEFT|RIGHT)/.test(msg),'with nothing shaded, a blocked solution is explained: '+msg.slice(0,100));
  await setGraph(p,{...want,dir:want.dir==='left'?'right':'left'},'buttons');
  await p.keyboard.press('Enter'); await p.waitForSelector('#hint:not(.hidden)',{timeout:20000});
  ok(/smaller values, shade LEFT/.test(await p.textContent('#hintText')),'the same mistake twice opens the hint card'); await p.screenshot({path:OUT+'/4_hint.png'});
  const before=(await st(p)).pods.filter(q=>q.state==='fall').length; await p.waitForTimeout(500);
  ok((await st(p)).pods.filter(q=>q.state==='fall').length===before && (await st(p)).frozen,'the action waits while the hint is open');
  await p.keyboard.press('Enter'); ok(!(await p.isVisible('#hint')) && await p.isVisible('#callout'),'closing the hint returns to the stopped pod');
  await setGraph(p,want,'keys'); s=await st(p); await p.keyboard.press('Enter'); await nextWave(p,s);
  ok((await st(p)).bad===2,'after the fix, no more damage in that wave');

  console.log('\n[5] Shield offline: zapping a solution');
  await open(p,{zone:3,fast:2}); s=await st(p); ok(s.mode==='zap' && s.zone===3,'started at zone 4 from the briefing');
  await p.keyboard.press('Enter');
  let hit=null; for(let guard=0;guard<300&&!hit;guard++){ const now=await st(p); hit=now.pods.find(q=>q.state==='fall'&&isSol(now.rule,q.v)); if(!hit) await p.waitForTimeout(40); }
  await p.keyboard.press(String(hit.i+1)); await frozen(p);
  msg=await p.textContent('#calloutText'); ok(/was a solution/.test(msg),'zapping a solution is explained: '+msg.slice(0,90));
  await p.keyboard.press('Enter'); ok(!(await st(p)).frozen,'Enter carries on');

  console.log('\n[6] Practice mode');
  await open(p,{practice:true,fast:5}); ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  await p.waitForTimeout(2500); s=await st(p); ok(s.phase==='prep' && s.pods.length===0,'no countdown: the pods wait for the student');
  await p.click('#goBtn'); await frozen(p); s=await st(p);
  ok(s.meter===0 && s.lives===3 && s.bad===1,'a mistake is explained but does no damage');

  console.log('\n[7] The shield falls, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__field.G; G.lives=1; G.meter=90; });
  await p.keyboard.press('Enter'); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/SHIELD FELL/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'THE SHIELD FELL appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await prep(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.graph.dir===null,'all 3 cores back and a fresh wave');

  console.log('\n[8] Help pauses the action');
  await speed(p,1); await setGraph(p,wantGraph(s.rule),'keys'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  await p.keyboard.press('h'); const y1=await p.evaluate(()=>window.__field.W.pods.map(q=>q.y).join()); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing') && y1===await p.evaluate(()=>window.__field.W.pods.map(q=>q.y).join()),'H opens the help and the pods stop');
  await p.keyboard.press('h'); await p.waitForTimeout(400); ok(y1!==await p.evaluate(()=>window.__field.W.pods.map(q=>q.y).join()),'closing help lets them fall again');

  console.log('\n[9] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/force-field/.test(fr.url()));
  await f.evaluate(()=>{ window.__field.G.result={score:60,total:66,accuracy:91,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
