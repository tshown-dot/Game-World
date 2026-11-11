const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/key_fitter'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const URL=BASE+'towns/topic-4-equation-valley/games/4-1-key-fitter/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set();
const cur=(p)=>p.evaluate(()=>{ const g=window.__keyfitter.G; const pr=g.problem; if(!pr) return null; return { id:pr.id, type:pr.type, noKey:pr.noKey, answer:pr.answer, keys:pr.keys&&pr.keys.map(k=>k.value), locks:pr.locks&&pr.locks.map(l=>({id:l.id,opens:l.opens})), value:pr.value, zone:g.zone, story:!!pr.story, chances:g.lives, tried:[...g.tried] }; });
async function waitNew(p, old){ await p.waitForFunction((o)=>{ const g=window.__keyfitter.G; return g.problem && g.problem.id!==o && !g.locked && document.getElementById('banner').classList.contains('hidden'); }, old, {timeout:15000}); }
async function answer(p,c,{wrong=false}={}){
  if(c.type==='lock'){
    if(wrong){ const i=c.keys.findIndex((v,j)=>v!==c.answer && !c.tried.includes(j)); await p.click(`[data-kb="${i}"]`); return; }
    if(c.noKey) await p.click('#noneBtn'); else await p.click(`[data-kb="${c.keys.indexOf(c.answer)}"]`);
  } else if(c.type==='master'){
    for(const l of c.locks){ const isOn=await p.$eval(`[data-tog="${l.id}"]`,b=>b.classList.contains('on')); const want=wrong?!l.opens:l.opens; if(isOn!==want) await p.click(`[data-tog="${l.id}"]`); }
    await p.click('#checkBtn');
  } else {
    await p.click('[data-fop="+"]'); await p.fill('#fa','5'); await p.dispatchEvent('#fa','input'); await p.fill('#fc', String(wrong? c.value+6 : c.value+5)); await p.dispatchEvent('#fc','input'); await p.click('#forgeBtn');
  }
}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  console.log('\n[1] Briefing'); await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(800);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  console.log('\n[2] Full mission through the real buttons');
  await p.keyboard.press('Enter'); await waitNew(p,null);
  let solved=0; const types=new Set(); let sawNoKey=false, sawWorked=false;
  for(let guard=0; guard<60; guard++){
    const c=await cur(p); types.add(c.story?'word':c.type); if(c.noKey) sawNoKey=true;
    const name=c.type==='lock'?(c.noKey?'4_nokey':c.story?'6_word':c.zone===2?'3_money':'2_lock'):c.type==='master'?'5_master':'7_forge';
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(solved===1 && c.type==='lock'){
      await answer(p,c,{wrong:true}); await p.waitForTimeout(700);
      const fb=await p.textContent('#feedback'); ok(/≠|NO KEY FITS|DOES fit/.test(fb) && /Try again/.test(fb),'a wrong key shows the substitution and a hint');
      await p.screenshot({path:OUT+'/8_wrong.png'}); await p.waitForTimeout(1500);
    }
    if(solved===2 && c.type==='lock'){
      await answer(p,c,{wrong:true}); await p.waitForTimeout(1900);
      const c2=await cur(p); await answer(p,c2,{wrong:true}); await p.waitForTimeout(800);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show every key substituted (worked solution)');
      await p.screenshot({path:OUT+'/9_worked.png'});
      await p.click('#fbBtn'); await p.waitForTimeout(300);
      ok(/BACKUP/.test(await p.textContent('#taskTag')),'then a backup lock');
      const c3=await cur(p); await answer(p,c3); solved++; await waitNew(p,c3.id); continue;
    }
    await answer(p,c); solved++; await p.waitForTimeout(250);
    if(await p.isVisible('#report')) break;
    try{ await waitNew(p,c.id); }catch(e){ if(await p.isVisible('#report')) break; throw e; }
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} problems)`);
  ok(['lock','master','forge','word'].every(t=>types.has(t)),'every problem type appeared: '+[...types].join(', '));
  ok(sawNoKey,'a NO KEY FITS lock appeared and was solved with the button');
  await p.screenshot({path:OUT+'/10_report.png'});
  const res=await p.evaluate(()=>window.__keyfitter.G.result);
  ok(res && res.bossDefeated && res.total>=19 && res.practiceMode===false,'result for the town: '+JSON.stringify(res));
  console.log('\n[3] Practice: no alarm'); await p.click('#againBtn'); await p.click('#practiceBtn'); await waitNew(p,null);
  const a0=await p.evaluate(()=>window.__keyfitter.G.meter); await p.waitForTimeout(2000);
  ok(await p.isVisible('#practiceTag') && await p.evaluate(a=>window.__keyfitter.G.meter===a,a0),'practice hides and freezes the alarm');
  console.log('\n[4] Caught three times, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await waitNew(p,null);
  for(let k=0;k<3;k++){ await p.evaluate(()=>{ window.__keyfitter.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'CAUGHT appears after 3 guards'); await p.screenshot({path:OUT+'/11_caught.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await waitNew(p,null); ok(Date.now()-t0<2000,`retry under 2 seconds (${Date.now()-t0} ms)`);
  console.log('\n[5] Inside a town (iframe)');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`); await host.waitForTimeout(1500);
  ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/key-fitter/.test(fr.url()));
  await f.evaluate(()=>{ window.__keyfitter.G.result={score:15,total:19,accuracy:79,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); }); await host.waitForTimeout(300);
  const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE')); ok(done && done.payload.score===15,'BACK TO TOWN sends the result');
  ok(await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight)<=0,'no vertical scrolling');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n')[0]);process.exit(2);});
