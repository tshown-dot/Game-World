const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/force_field'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-7-force-field/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={zapKey:0,zapTap:0,tick:0,keys:0,decimalLine:0,fractions:0};
const SWAP={'<':'≤','≤':'<','>':'≥','≥':'>'};
// Reads the problem; works out answers with the game's own math module (field.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./field.js'); const g=window.__field.G, pr=g.problem; if(!pr) return null;
  const r=pr.rule||pr.rules[0]; const line=m.lineFor(r);
  return { id:pr.id, type:pr.type, zone:g.zone, locked:g.locked, boilers:g.lives, rule:r, gift:!!pr.gift, whole:!!pr.whole, tiles:pr.tiles,
    step:line.step, at:g.line.at, solutions: pr.values ? pr.values.map((v)=>m.passesAll(pr.rules,v)) : null,
    examples: pr.type==='name3' ? m.workedSolution(pr)[1].replace(/^For example: /,'').replace(/\.$/,'').split('; ') : null,
    options:pr.options&&pr.options.map((o,i)=>({ok:!!o.ok,i})), tried:[...g.tried] }; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__field.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function graph(p,s,wrong){
  const r=s.rule; if(s.step<1) ways.decimalLine++;
  if(way%2===0){ ways.tick++; const bb=await (await p.$(`[data-tick="${r.n}"] path`)).boundingBox(); await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2); }
  else { ways.keys++; const n=Math.round((r.n-s.at)/s.step); for(let k=0;k<Math.abs(n);k++) await p.keyboard.press(n>0?'ArrowRight':'ArrowLeft'); }
  way++;
  const closed=(r.sym==='≥'||r.sym==='≤')!==wrong;
  await p.click(`[data-closed="${closed?1:0}"]`);
  await p.keyboard.press(r.sym==='>'||r.sym==='≥'?'>':'<');
  await p.keyboard.press('Enter');
}
async function meteors(p,s,wrong){
  await p.waitForTimeout(400);
  const targets=s.solutions.map((good,i)=>good!==(wrong&&i===s.solutions.indexOf(false))?i:-1).filter(i=>i>=0 && (s.solutions[i] || wrong));
  for(const i of targets){
    if(way++%2===0){ ways.zapKey++; await p.keyboard.press(String(i+1)); }
    else { ways.zapTap++; const bb=await (await p.$(`#m${i}`)).boundingBox(); await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2); }
    if(!shots.has('3_zapping')){ shots.add('3_zapping'); await p.screenshot({path:OUT+'/3_zapping.png'}); }
  }
  await p.evaluate(()=>{ const s=window.__field.G.shower; if(s) s.t+=30000; });   // test speed-up: let the rest land now
}
async function name3(p,s,wrong){
  const vals=[...s.examples];
  if(wrong){ vals[0]=String(s.rule.sym==='<'||s.rule.sym==='>' ? s.rule.n : (s.rule.sym==='≥' ? s.rule.n-1 : s.rule.n+1)); }
  else if(!s.whole && way%2===0){ vals[2]= (s.rule.sym==='>'||s.rule.sym==='≥') ? `${Math.floor(s.rule.n)+20} 1/2` : '1/4'; ways.fractions++; }
  way++;
  for(let i=0;i<3;i++){ await p.fill(`#v${i+1}`, vals[i]); }
  await p.keyboard.press('Enter');
}
async function read(p,s,wrong){
  const r=s.rule; const sym=wrong?SWAP[r.sym]:r.sym;
  const i=s.tiles.findIndex(v=>Math.abs(v-r.n)<1e-9);
  await p.click('[data-tile="var"]');
  await p.click(`[data-tile="sym"][data-v="${sym}"]`);
  await p.click(`[data-tile="num"][data-i="${i}"]`);
  await p.keyboard.press('Enter');
}
async function act(p,s,wrong=false){
  if(s.type==='graph') return graph(p,s,wrong);
  if(s.type==='meteor') return meteors(p,s,wrong);
  if(s.type==='name3') return name3(p,s,wrong);
  if(s.type==='read') return read(p,s,wrong);
  const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1));
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__field.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:20000}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] Full mission through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(); let sawHint=false, sawWorked=false, sawShowerMiss=false, sawName3Miss=false;
  for(let guard=0; guard<80; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type+(s.gift?'_gift':''));
    const name={graph:'2_graph',meteor:'4_meteors',name3:'6_name3',read:'7_read',pick:'8_pick'}[s.type];
    if(name && !shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='graph' && s.step<1 && !shots.has('2b_tenths')){ shots.add('2b_tenths'); await p.screenshot({path:OUT+'/2b_tenths_line.png'}); }
    if(s.type==='graph' && !sawHint){ // one wrong shield: a specific hint
      await act(p,s,true); await p.waitForTimeout(400);
      const fb=await p.textContent('#feedback'); sawHint=/Try again/.test(fb); ok(sawHint,'a wrong shield gets a specific hint: '+fb.slice(0,90));
      await p.waitForFunction(()=>!window.__field.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='meteor' && !sawShowerMiss){ // zap a wrong meteor: explained, then the same shower again
      await act(p,s,true); await p.waitForTimeout(600);
      const fb=await p.textContent('#feedback'); sawShowerMiss=/meteor/.test(fb); ok(sawShowerMiss,'a wrong zap is explained: '+fb.slice(0,90));
      await p.screenshot({path:OUT+'/5_shower_miss.png'});
      await p.waitForFunction(()=>!window.__field.G.locked,null,{timeout:6000});
      ok((await st(p)).id===s.id,'and the same shower comes again');
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='name3' && !sawName3Miss){ sawName3Miss=true; // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await p.waitForFunction(()=>!window.__field.G.locked,null,{timeout:5000});
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/9_worked.png'});
      await p.click('#fbBtn'); await ready(p);
      const backup=await st(p);
      ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='name3','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['graph','meteor','name3','read','pick','read_gift'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.zapKey>=2 && ways.zapTap>=2,`meteors zapped with keys (${ways.zapKey}) and taps (${ways.zapTap})`);
  ok(ways.tick>=1 && ways.keys>=1 && ways.decimalLine>=1,`shield edge set by tapping (${ways.tick}) and keys (${ways.keys}), including tenths lines (${ways.decimalLine})`);
  ok(ways.fractions>=1,`a mixed number or fraction was accepted as a solution (${ways.fractions})`);
  await p.screenshot({path:OUT+'/10_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__field.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__field.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__field.G.meter===t,t0),'power does not drain in practice');

  console.log('\n[5] Three blackouts, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__field.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'OUTPOST DARK appears'); await p.screenshot({path:OUT+'/11_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).boilers===3,'all 3 power cells back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/force-field/.test(fr.url()));
  await f.evaluate(()=>{ window.__field.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
