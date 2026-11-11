const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/food_truck'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-5-food-truck/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,tap:0,key:0}; const forms={decimal:0,mixed:0,improper:0,recip:0};
// Reads the ticket and works out answers with the game's own math module (truck.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./truck.js'); const g=window.__truck.G, pr=g.problem; if(!pr) return null; const eq=pr.eq;
  const step=m.undoStep(eq); const sh=(q)=>m.show(q,eq.style);
  const out={ id:pr.id, type:pr.type, phase:g.phase, locked:g.locked, zone:g.zone, style:eq.style, kind:eq.kind, boilers:g.lives,
    options:pr.options&&pr.options.map((o,i)=>({ok:!!o.ok,i})), tried:[...g.tried], bigger: m.value(eq.x)>m.value(eq.c),
    op:step.op, n:sh(step.n), sameOp:{plus:'+',minus:'-',times:'×',div:'÷'}[eq.kind], a:sh(eq.a),
    recip: eq.kind==='times'&&eq.style==='fraction'&&eq.a.d>1 ? m.show(m.recip(eq.a)) : null };
  if(g.pending){ const v=m.apply(eq.c,g.pending.op,g.pending.n); out.answer=sh(v); out.improper=`${v.n}/${v.d}`; out.wrongAnswer=sh(m.add(v,m.fr(1))); }
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__truck.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function block(p,s,wrong){
  let op=s.op, n=s.n;
  if(wrong){ op=s.sameOp; n=s.a; }
  else if(s.recip && way%2===0){ op='×'; n=s.recip; forms.recip++; }
  await p.click(`[data-op="${op}"]`);
  await p.keyboard.type(n);
  const how=['drag','tap','key'][way++%3]; ways[how]++;
  if(how==='drag'){ const bb=await (await p.$('#block')).boundingBox(); const m=await (await p.$('#ticket')).boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(m.x+m.width/2,m.y+m.height/2,{steps:8});
    if(!shots.has('drag')){ shots.add('drag'); await p.screenshot({path:OUT+'/3_dragging_block.png'}); }
    await p.mouse.up(); }
  else if(how==='tap'){ await p.click('#block'); const m=await (await p.$('#ticket')).boundingBox(); await p.mouse.click(m.x+m.width/2,m.y+m.height/2); }
  else await p.keyboard.press('Enter');
}
let cway=0;
async function calc(p,s,wrong){
  const improper = !wrong && s.style==='fraction' && (cway++)%2===1 && s.improper!==s.answer;
  const t = wrong ? s.wrongAnswer : improper ? s.improper : s.answer;
  if(!wrong){ if(improper) forms.improper++; else if(/ /.test(t)) forms.mixed++; else forms.decimal++; }
  way++;
  await p.keyboard.type(t); await p.keyboard.press('Enter');
}
async function act(p,s,wrong=false){
  if(s.phase==='option'){ const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1)); }
  if(s.phase==='predict') return p.keyboard.press((s.bigger!==wrong)?'ArrowRight':'ArrowLeft');
  if(s.phase==='block') return block(p,s,wrong);
  if(s.phase==='calc') return calc(p,s,wrong);
}
async function changed(p,s){ await p.waitForFunction(([id,ph])=>{ const g=window.__truck.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && (g.problem.id!==id || g.phase!==ph) && !g.locked && document.getElementById('banner').classList.contains('hidden')); },[s.id,s.phase],{timeout:15000}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] Full shift through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const phases=new Set(), types=new Set(); let sawHint=false, sawWorked=false, sawPredictMiss=false;
  for(let guard=0; guard<150; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); phases.add(s.phase); types.add(s.type);
    const name={block:'2_block',calc:'4_calc',predict:'6_predict',option:s.type==='story'?'5_story_pick':s.type==='critique'?'8_boss_critique':'9_boss_choose'}[s.phase];
    if(name && !shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.zone===2 && s.phase==='calc' && !shots.has('7_fraction_calc')){ shots.add('7_fraction_calc'); await p.screenshot({path:OUT+'/7_fraction_calc.png'}); }
    if(solved===1 && s.phase==='block' && !sawHint){ // one wrong block, then a hint
      await act(p,s,true); await p.waitForTimeout(900);
      sawHint=/Try again/.test(await p.textContent('#feedback')); ok(sawHint,'a wrong block gets a specific hint: '+(await p.textContent('#feedback')).slice(0,90));
      ok(/WRONG BLOCK/.test(await p.textContent('#scene')),'and the ticket is stamped WRONG BLOCK');
      await p.waitForFunction(()=>!window.__truck.G.locked,null,{timeout:5000});
      await act(p,await st(p)); await changed(p,s); continue;
    }
    if(solved===3 && !sawWorked && s.phase==='calc'){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(400);
      await p.waitForFunction(()=>!window.__truck.G.locked,null,{timeout:5000});
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/10_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      ok(/BACKUP/.test(await p.textContent('#taskTag')),'then a backup ticket');
      ok((await st(p)).type===s.type,'of the same type ('+s.type+')'); continue;
    }
    if(s.phase==='predict' && !sawPredictMiss){
      await act(p,s,true); await p.waitForTimeout(300); sawPredictMiss=/Not always/.test(await p.textContent('#feedback'));
      ok(sawPredictMiss,'a wrong prediction explains bigger or smaller: '+(await p.textContent('#feedback')).slice(0,90));
      await p.waitForFunction(()=>!window.__truck.G.locked && window.__truck.G.phase==='block',null,{timeout:5000}); continue;
    }
    await act(p,s); if(s.phase==='calc' || (s.phase==='option' && s.type==='choose')) solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} tickets)`);
  ok(['option','predict','block','calc'].every(x=>phases.has(x)),'every step appeared: '+[...phases].join(', '));
  ok(['solve','story','predict','choose','critique'].every(x=>types.has(x)),'every ticket type appeared: '+[...types].join(', '));
  ok(ways.drag>=3 && ways.tap>=3 && ways.key>=3,`dragged (${ways.drag}), tapped (${ways.tap}) and used keys (${ways.key})`);
  ok(forms.decimal>0 && forms.mixed>0 && forms.improper>0,`answers accepted as decimals (${forms.decimal}), mixed numbers (${forms.mixed}) and improper fractions (${forms.improper})`);
  ok(forms.recip>0,`multiplying by the reciprocal was accepted as the opposite block (${forms.recip})`);
  await p.screenshot({path:OUT+'/11_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__truck.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' tickets');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__truck.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__truck.G.meter===t,t0),'the line does not grow in practice');

  console.log('\n[5] Three walkouts, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__truck.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'TRUCK CLOSED appears'); await p.screenshot({path:OUT+'/13_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).boilers===3,'all 3 chances back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/food-truck/.test(fr.url()));
  await f.evaluate(()=>{ window.__truck.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
