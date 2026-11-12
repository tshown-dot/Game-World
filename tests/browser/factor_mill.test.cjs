// Factor Mill (Grade 7, 4-5): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/factor_mill'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/g7-topic-4-factor-falls/games/4-5-factor-mill/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={click:0,key:0};
// Reads the problem and its answer from the game (mill.js made it), inside the page.
const st=(p)=>p.evaluate(()=>{ const g=window.__mill.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, kind:pr.kind, type:pr.type, level:pr.level, zone:g.zone, lives:g.lives, phase:g.phase, tried:[...g.tried], picked:[...g.picked] };
  if(pr.kind==='factor'){ out.wheels=[...pr.wheels]; out.right=pr.wheels.indexOf(pr.factor); out.inside=pr.inside.map(t=>String(t.c)); out.terms=pr.terms.map(t=>String(t.c)); out.negative=pr.negative; out.factor=pr.factor;
    const div=(w)=>pr.terms.every(t=>t.c%w===0);
    out.small=pr.wheels.findIndex(w=>w!==pr.factor && div(w) && !(pr.negative&&w>0)); out.some=pr.wheels.findIndex(w=>!div(w)); out.pos=pr.wheels.findIndex(w=>pr.negative && w>0 && div(w)); }
  if(pr.options) out.options=pr.options.map((o,i)=>({ok:!!o.ok,key:o.key,i}));
  if(pr.kind==='select') out.cards=pr.cards.map((c,i)=>({ok:c.ok,i}));
  if(pr.kind==='num'){ out.val=String(pr.answer); out.traps=pr.traps.map(t=>({v:String(t.v),key:t.key})); }
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__mill.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function wheel(p,i){ if(way++%2){ ways.key++; await p.keyboard.press(String(i+1)); } else { ways.click++; await p.click(`[data-wheel="${i}"]`); } }
async function typeInside(p,vals){ for(let i=0;i<vals.length;i++) await p.fill(`#s${i}`,vals[i]); await p.keyboard.press('Enter'); }
async function act(p,s,wrong=false){
  if(s.kind==='factor'){
    if(s.phase==='wheel'){ await wheel(p,s.right); await p.waitForFunction(()=>window.__mill.G.phase==='inside'); }
    const v=[...s.inside]; if(wrong) v[0]=String(Number(v[0])+50); return typeInside(p,v);
  }
  if(s.kind==='choice'){ const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1)); }
  if(s.kind==='select'){ const good=s.cards.filter(c=>c.ok).map(c=>c.i), want=wrong?good.slice(1):good;
    for(const c of s.cards){ const on=(await st(p)).picked.includes(c.i); if(on!==want.includes(c.i)) await p.click(`[data-card="${c.i}"]`); } return p.keyboard.press('Enter'); }
  await p.fill('#ans', wrong?(s.traps[0]?s.traps[0].v:'1'):s.val); return p.keyboard.press('Enter');
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__mill.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__mill.G.locked,null,{timeout:6000}); }
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(16).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(), levels=new Set(); let sawSome=false, sawSmall=false, sawPos=false, sawDivide=false, sawSign=false, sawWorked=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type); if(s.level) levels.add(s.level);
    const name=`${s.zone+2}_${s.level||s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.kind==='factor' && s.some>=0 && !sawSome){ sawSome=true;   // a factor of only some terms
      await wheel(p,s.some); await p.waitForTimeout(400);
      ok(/EVERY term/.test(await fb(p)),'a factor that does not divide every term is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); ok(await p.isDisabled(`[data-wheel="${s.some}"]`),'that wheel is greyed out for the retry');
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='factor' && s.small>=0 && !sawSmall){ sawSmall=true;   // common, but not the greatest
      await wheel(p,s.small); await p.waitForTimeout(400);
      ok(/bigger wheel fits/.test(await fb(p)),'a common factor that is not the greatest gets its own hint: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/3b_not_greatest.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='factor' && s.pos>=0 && !sawPos){ sawPos=true;   // the positive GCF when a negative one is asked for
      await wheel(p,s.pos); await p.waitForTimeout(400);
      ok(/NEGATIVE/.test(await fb(p)),'the positive factor is caught when a negative one is asked for: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='factor' && s.negative && s.phase==='wheel' && !sawSign){ sawSign=true;   // right wheel, wrong sign inside (on a different problem)
      await wheel(p,s.right); await p.waitForFunction(()=>window.__mill.G.phase==='inside');
      const flip=[...s.inside]; flip[0]=String(-Number(flip[0])); await typeInside(p,flip); await p.waitForTimeout(400);
      ok(/Check the sign/.test(await fb(p)),'a sign error inside the parentheses is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/4b_sign_error.png'});
      await unlocked(p); await typeInside(p,s.inside); solved++; await changed(p,s); continue;
    }
    if(s.kind==='factor' && s.phase==='wheel' && !sawDivide){ sawDivide=true;   // a term left undivided
      await wheel(p,s.right); await p.waitForFunction(()=>window.__mill.G.phase==='inside');
      const v=[...s.inside]; v[1]=s.terms[1]; await typeInside(p,v); await p.waitForTimeout(400);
      ok(/not divided/.test(await fb(p)),'a term that was not divided is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/2b_forgot_to_divide.png'});
      await unlocked(p); await typeInside(p,s.inside); solved++; await changed(p,s); continue;
    }
    if(s.type==='fully' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='fully','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['factor','select','fully','susan','friend','ryan','kits'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(['two','multi','negpos','negneg','three','partial','threeneg'].every(x=>levels.has(x)),'every kind of factoring appeared: '+[...levels].join(', '));
  ok(ways.click>=1 && ways.key>=1,`wheels picked by clicking (${ways.click}) and keys (${ways.key})`);
  ok(sawSome && sawSmall && sawPos && sawDivide,'the misconception checks ran');
  await p.screenshot({path:OUT+'/8_report.png'});
  const res=await p.evaluate(()=>window.__mill.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Empty boxes only nudge');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  const s3=await st(p); await p.click(`[data-wheel="${s3.right}"]`); await p.waitForFunction(()=>window.__mill.G.phase==='inside');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')),'pressing Enter with empty boxes only nudges');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__mill.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__mill.G.meter===t,t0),'no wear in practice');

  console.log('\n[5] The mill stops, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__mill.G.meter=99.5; }); await p.waitForTimeout(700); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/MILL STOPPED/.test(await p.textContent('#fail')),'THE MILL STOPPED appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 gears back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/factor-mill/.test(fr.url()));
  await f.evaluate(()=>{ window.__mill.G.result={score:20,total:24,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
