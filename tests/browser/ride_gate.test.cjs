const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/ride_gate'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-6-ride-gate/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,tap:0,key:0,flipped:0,tick:0};
const FLIP={'<':'>','>':'<','≤':'≥','≥':'≤','≠':'≠'}, SWAP={'<':'≤','≤':'<','>':'≥','≥':'>','≠':'<'};
// Reads the problem; works out the right answer with the game's own math module (gate.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./gate.js'); const g=window.__gate.G, pr=g.problem; if(!pr) return null;
  return { id:pr.id, type:pr.type, zone:g.zone, locked:g.locked, boilers:g.lives, rule:pr.rule, tiles:pr.tiles, two:!!pr.two,
    v:pr.v, letIn: pr.type==='rider' ? m.passes(pr.rule,pr.v) : null, options:pr.options&&pr.options.map((o,i)=>({ok:!!o.ok,i})), tried:[...g.tried], line:{...g.line} }; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__gate.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function write(p,s,wrong){
  const r=s.rule; const sym=wrong?SWAP[r.sym]:r.sym;
  const first=(way%2===1) && !wrong;                 // every other one written number-first: 42 ≤ h
  if(first) ways.flipped++;
  const right = r.other ? {t:'var',v:r.other} : {t:'num',i:s.tiles.findIndex(v=>Math.abs(v-r.n)<1e-9)};
  const seq = first ? [right,{t:'sym',v:FLIP[sym]},{t:'var',v:r.letter}] : [{t:'var',v:r.letter},{t:'sym',v:sym},right];
  let dragged=false;
  for(const t of seq){
    const sel = t.t==='num' ? `[data-tile="num"][data-i="${t.i}"]` : `[data-tile="${t.t}"][data-v="${t.v}"]`;
    if(!dragged && way%3===0){ dragged=true; ways.drag++;
      const bb=await (await p.$(sel)).boundingBox(); const rr=await (await p.$('#rail')).boundingBox();
      await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(rr.x+rr.width/2,rr.y+rr.height/2,{steps:6}); await p.mouse.up();
    } else await p.click(sel);
  }
  way++;
  await p.keyboard.press('Enter');
}
async function line(p,s,wrong){
  const r=s.rule; const n=Math.round(r.n);
  if(way%2===0){ ways.tick++; const bb=await (await p.$(`[data-tick="${n}"] text`)).boundingBox(); await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2); }    // tap the number on the line
  else { const steps=n-s.line.at; for(let k=0;k<Math.abs(steps);k++) await p.keyboard.press(steps>0?'ArrowRight':'ArrowLeft'); }
  way++;
  const closed=(r.sym==='≥'||r.sym==='≤')!==wrong;   // a wrong try gets the circle wrong
  await p.click(`[data-closed="${closed?1:0}"]`);
  await p.keyboard.press(r.sym==='>'||r.sym==='≥'?'>':'<');
  await p.keyboard.press('Enter');
}
async function act(p,s,wrong=false){
  if(s.type==='write') return write(p,s,wrong);
  if(s.type==='rider'){ const how=['key','tap','key'][way++%3]; ways[how]++; const yes=s.letIn!==wrong;
    if(how==='tap') return p.click(`[data-let="${yes?1:0}"]`); return p.keyboard.press(yes?'ArrowRight':'ArrowLeft'); }
  if(s.type==='line') return line(p,s,wrong);
  const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1));
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__gate.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] Opening day through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(); let sawHint=false, sawWorked=false, sawRiderMiss=false, sawBoundaryRider=false;
  for(let guard=0; guard<120; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type+(s.two?'2':''));
    const name={write:'2_write',rider:'4_rider',line:'6_line',readline:'7_readline',pick:'8_who_is_right'}[s.type];
    if(name && !shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='rider' && s.v===s.rule.n) sawBoundaryRider=true;
    if(solved===1 && s.type==='write' && !sawHint){ // one wrong rule: a boundary hint
      await act(p,s,true); await p.waitForTimeout(400);
      const fb=await p.textContent('#feedback'); sawHint=/Try again/.test(fb); ok(sawHint,'a wrong rule gets a specific hint: '+fb.slice(0,90));
      await p.screenshot({path:OUT+'/3_wrong_rule.png'});
      await p.waitForFunction(()=>!window.__gate.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='rider' && !sawRiderMiss){
      await act(p,s,true); await p.waitForTimeout(400); sawRiderMiss=/NEXT RIDER/.test(await p.textContent('#feedback'));
      ok(sawRiderMiss,'a wrong call at the gate is explained: '+(await p.textContent('#feedback')).slice(0,90));
      await p.screenshot({path:OUT+'/5_rider_miss.png'}); await p.keyboard.press('Enter'); await ready(p); continue;
    }
    if(s.type==='line' && !sawWorked){ // two misses on a number line: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await p.waitForFunction(()=>!window.__gate.G.locked,null,{timeout:5000});
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/9_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      ok(/BACKUP/.test(await p.textContent('#taskTag')),'then a backup problem');
      const backup=await st(p); ok(backup.type==='line','of the same type (number line)');
      await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      ok((await st(p)).id===backup.id,'pressing Enter on the backup does not skip it (the old BACKUP button is gone)'); continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['write','rider','line','readline','pick','write2'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(sawBoundaryRider,'boundary riders (exactly on the number) came to the gate');
  ok(ways.drag>=2 && ways.tap>=2 && ways.key>=2,`dragged (${ways.drag}), tapped (${ways.tap}) and used keys (${ways.key})`);
  ok(ways.flipped>=2,`rules written number-first (42 ≤ h) were accepted (${ways.flipped})`);
  ok(ways.tick>=1,`the number line post was set by tapping a number (${ways.tick}) and with arrow keys`);
  await p.screenshot({path:OUT+'/10_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__gate.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__gate.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__gate.G.meter===t,t0),'patience does not drain in practice');

  console.log('\n[5] Three angry crowds, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__gate.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'RIDE SHUT DOWN appears'); await p.screenshot({path:OUT+'/11_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).boilers===3,'all 3 patience back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/ride-gate/.test(fr.url()));
  await f.evaluate(()=>{ window.__gate.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
