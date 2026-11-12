// Ranger Station (Grade 7, 4-1): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/ranger_station'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/g7-topic-4-factor-falls/games/4-1-ranger-station/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,tap:0,key:0};
// Reads the problem and its answer from the game (ranger.js made it), inside the page.
const st=(p)=>p.evaluate(()=>{ const g=window.__ranger.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, kind:pr.kind, type:pr.type, zone:g.zone, lives:g.lives, tried:[...g.tried], slots:{...g.slots}, sign:g.sign, two:pr.two };
  if(pr.kind==='num'){ out.val=String(pr.answer); out.traps=pr.traps.map(t=>({v:String(t.v),key:t.key})); }
  if(pr.options) out.options=pr.options.map((o,i)=>({ok:!!o.ok,key:o.key,i}));
  if(pr.kind==='build'){ out.chips=[...pr.chips]; out.a=pr.chips.indexOf(pr.two?pr.p1:pr.start); out.b=pr.chips.indexOf(pr.two?pr.p2:pr.rate); out.want=pr.sign; }
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__ranger.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function putChip(p,i,slot,how){
  const id=slot==='a'?'#slotA':'#slotB';
  if(how==='drag'){ const c=await (await p.$(`[data-chip="${i}"]`)).boundingBox(); const t=await (await p.$(id)).boundingBox();
    await p.mouse.move(c.x+c.width/2,c.y+c.height/2); await p.mouse.down(); await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:8});
    if(!shots.has('drag')){ shots.add('drag'); await p.screenshot({path:OUT+'/2b_dragging.png'}); }
    await p.mouse.up(); }
  else if(how==='tap'){ await p.click(`[data-chip="${i}"]`); const t=await (await p.$(id)).boundingBox(); await p.mouse.click(t.x+t.width/2,t.y+t.height/2); }
  else { await p.keyboard.press(String(i+1)); await p.keyboard.press(slot==='a'?'ArrowLeft':'ArrowRight'); }
}
async function act(p,s,wrong=false){
  if(s.kind==='num'){ await p.fill('#ans', wrong?(s.traps[0]?s.traps[0].v:String(Number(s.val)+1000)):s.val); return p.keyboard.press('Enter'); }
  if(s.kind==='choice'){ const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1)); }
  const how=['drag','tap','key'][way++%3]; ways[how]++;
  const now=await st(p); if(now.slots.a!==null || now.slots.b!==null) await p.click('#clearBtn');
  await putChip(p, wrong?s.b:s.a, 'a', how); await putChip(p, wrong?s.a:s.b, 'b', how);     // wrong = start and rate swapped
  if(!s.two){ if(how==='key') await p.keyboard.press(s.want==='+'?'+':'-'); else await p.click(`[data-sign="${s.want}"]`); }
  return p.keyboard.press('Enter');
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__ranger.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__ranger.G.locked,null,{timeout:6000}); }
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
  let solved=0; const types=new Set(); let sawSwap=false, sawDir=false, sawWorked=false, sawNeg=false, sawAmount=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type);
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='build' && !sawSwap){ sawSwap=true;   // start and rate swapped
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/Swapped/.test(await fb(p)),'swapping the start and the rate is caught: '+(await fb(p)).slice(0,90));
      ok((await p.$$('#scene .bar')).length===4,'the gauge shows what their expression does (4 bars)');
      await p.screenshot({path:OUT+'/2c_swapped.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='build' && s.want==='−' && !sawDir){ sawDir=true;   // adding when it shrinks
      await putChip(p,s.a,'a','tap'); await putChip(p,s.b,'b','tap'); await p.click('[data-sign="+"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/going DOWN/.test(await fb(p)),'adding when the amount shrinks is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/3b_wrong_direction.png'});
      await unlocked(p); await p.click('[data-sign="−"]'); await p.keyboard.press('Enter'); solved++; await changed(p,s); continue;
    }
    if(s.type==='eval' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/4b_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='eval','then a backup of the same type');
      continue;
    }
    if(s.type==='eval' && Number(s.val)<0 && !sawNeg){ sawNeg=true;   // dropped the negative sign
      await p.fill('#ans',String(-Number(s.val))); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/BELOW zero/.test(await fb(p)),'a dropped negative sign is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await p.fill('#ans','−'+String(-Number(s.val))); await p.keyboard.press('Enter'); solved++; await changed(p,s); continue;
    }
    if(s.type==='build2' && !sawAmount){ sawAmount=true;   // an amount used as a coefficient
      const amount=s.chips.findIndex((c,i)=>i!==s.a&&i!==s.b);
      await putChip(p,amount,'a','tap'); await putChip(p,s.b,'b','tap'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/amounts/.test(await fb(p)),'using an amount as a coefficient is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['build','evalStory','eval','build2','eval2','whenNegative'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.drag>=1 && ways.tap>=1 && ways.key>=1,`chips placed by dragging (${ways.drag}), tapping (${ways.tap}) and keys (${ways.key})`);
  ok(sawSwap && sawDir && sawAmount,'the misconception checks ran');
  await p.screenshot({path:OUT+'/8_report.png'});
  const res=await p.evaluate(()=>window.__ranger.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] An empty gauge only nudges');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')),'testing an empty gauge only nudges');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__ranger.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__ranger.G.meter===t,t0),'no storm in practice');

  console.log('\n[5] The storm hits, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__ranger.G.meter=99.5; }); await p.waitForTimeout(700); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/STORM HIT/.test(await p.textContent('#fail')),'THE STORM HIT appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 flares back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/ranger-station/.test(fr.url()));
  await f.evaluate(()=>{ window.__ranger.G.result={score:20,total:25,accuracy:80,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
