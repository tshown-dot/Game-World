const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/cause_effect_lab'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-8-cause-effect-lab/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,tap:0,key:0};
// Reads the problem; works out the answer with the game's own module (lab.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./lab.js'); const g=window.__lab.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, type:pr.type, zone:g.zone, locked:g.locked, boilers:g.lives, tried:[...g.tried], picked:[...g.picked] };
  if(pr.type==='wire'){ out.cause=pr.cards.findIndex(c=>c.role==='cause'); out.effect=pr.cards.findIndex(c=>c.role==='effect'); }
  if(pr.type==='build'){ const x=m.buildablePairs(pr)[0]; out.cause=pr.cards.findIndex(c=>c.name===x.cause.name); out.effect=pr.cards.findIndex(c=>c.name===x.effect.name); }
  if(pr.type==='hunt') out.yes=pr.cards.map((c,i)=>c.affects?i:-1).filter(i=>i>=0);
  if(pr.type==='dial') out.dir=pr.pair.dir;
  if(pr.type==='time') out.time=pr.situation.time;
  if(pr.type==='pick') out.options=pr.options.map((o,i)=>({ok:!!o.ok,i}));
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__lab.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function wire(p,s,wrong){
  const dial=wrong?s.effect:s.cause, meter=wrong?s.cause:s.effect;
  const how=['drag','tap','key'][way++%3]; ways[how]++;
  for(const [i,slot] of [[dial,'dialSlot'],[meter,'meterSlot']]){
    if(how==='drag'){ const bb=await (await p.$(`[data-card="${i}"]`)).boundingBox(); const t=await (await p.$(`#${slot}`)).boundingBox();
      await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:8});
      if(!shots.has('drag')){ shots.add('drag'); await p.screenshot({path:OUT+'/3_dragging_card.png'}); }
      await p.mouse.up(); }
    else if(how==='tap'){ await p.click(`[data-card="${i}"]`); const t=await (await p.$(`#${slot}`)).boundingBox(); await p.mouse.click(t.x+t.width/2,t.y+40); }
    else { await p.keyboard.press(String(i+1)); await p.keyboard.press(slot==='dialSlot'?'ArrowLeft':'ArrowRight'); }
  }
  await p.keyboard.press('Enter');
}
async function act(p,s,wrong=false){
  if(s.type==='wire'||s.type==='build') return wire(p,s,wrong);
  if(s.type==='hunt'){ const want=new Set(wrong?[0,1,2,3,4,5]:s.yes); for(let i=0;i<6;i++) if(want.has(i)!==s.picked.includes(i)) await p.keyboard.press(String(i+1)); return p.keyboard.press('Enter'); }
  if(s.type==='dial'){ const a=wrong?(s.dir==='up'?'down':'up'):s.dir; return p.keyboard.press({up:'ArrowUp',down:'ArrowDown',same:' '}[a]); }
  if(s.type==='time'){ const a=wrong?(s.time==='cause'?'effect':'cause'):s.time; return p.keyboard.press(a==='cause'?'ArrowLeft':'ArrowRight'); }
  const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1));
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__lab.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] Full lab through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(); let sawHint=false, sawWorked=false, sawMoreIsMore=false;
  for(let guard=0; guard<80; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type);
    const name={wire:'2_wire',hunt:'4_hunt',dial:'5_dial',time:'6_time',pick:'7_critique',build:'8_build'}[s.type];
    if(name && !shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='wire' && !sawHint){ // wired backwards: a hint
      await act(p,s,true); await p.waitForTimeout(400);
      const fb=await p.textContent('#feedback'); sawHint=/Backwards/.test(fb); ok(sawHint,'wiring it backwards gets a hint: '+fb.slice(0,90));
      await p.screenshot({path:OUT+'/2b_backwards.png'});
      await p.waitForFunction(()=>!window.__lab.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='dial' && s.dir==='down' && !sawMoreIsMore){ sawMoreIsMore=true;
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/always/.test(await p.textContent('#feedback')),'"more is always more" is caught: '+(await p.textContent('#feedback')).slice(0,90));
      await p.waitForFunction(()=>!window.__lab.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='hunt' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await p.waitForFunction(()=>!window.__lab.G.locked,null,{timeout:5000});
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/9_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='hunt','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['wire','hunt','dial','time','pick','build'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.drag>=1 && ways.tap>=1 && ways.key>=1,`cards placed by dragging (${ways.drag}), tapping (${ways.tap}) and keys (${ways.key})`);
  await p.screenshot({path:OUT+'/10_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__lab.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__lab.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__lab.G.meter===t,t0),'power does not run down in practice');

  console.log('\n[5] Three blown fuses, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__lab.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'LAB SHUT DOWN appears'); await p.screenshot({path:OUT+'/11_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).boilers===3,'all 3 fuses back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/cause-effect-lab/.test(fr.url()));
  await f.evaluate(()=>{ window.__lab.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
