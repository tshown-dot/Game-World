// Twin Bridges (Grade 7, 4-2): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/twin_bridges'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/g7-topic-4-factor-falls/games/4-2-twin-bridges/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={click:0,key:0};
// Reads the problem and its answer from the game (bridges.js made it), inside the page.
const st=(p)=>p.evaluate(()=>{ const g=window.__bridges.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, kind:pr.kind, type:pr.type, zone:g.zone, lives:g.lives, tried:[...g.tried], picked:[...g.picked] };
  if(pr.kind==='test') Object.assign(out,{ va:String(pr.va), vb:String(pr.vb), eq:pr.eq });
  if(pr.options) out.options=pr.options.map((o,i)=>({ok:!!o.ok,key:o.key,i}));
  if(pr.kind==='boxes'){ out.want=Object.fromEntries(Object.entries(pr.want).map(([k,v])=>[k,String(v)])); out.form=pr.form; out.c=pr.c; }
  if(pr.kind==='select') out.cards=pr.cards.map((c,i)=>({ok:c.ok,key:c.key,i}));
  if(pr.kind==='num'){ out.val=String(pr.answer); out.traps=pr.traps.map(t=>({v:String(t.v),key:t.key})); }
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__bridges.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function fillBoxes(p,vals){ for(const [k,v] of Object.entries(vals)){ await p.fill('#b_'+k,v); } }
async function setCards(p,s,want){ const how=['click','key'][way++%2]; ways[how]++;
  for(const c of s.cards){ const on=(await st(p)).picked.includes(c.i); if(on!==want.includes(c.i)){ if(how==='click') await p.click(`[data-card="${c.i}"]`); else await p.keyboard.press(String(c.i+1)); } } }
async function act(p,s,wrong=false){
  if(s.kind==='test'){ await p.fill('#va',s.va); await p.fill('#vb',s.vb); const say=wrong?!s.eq:s.eq;
    if(way++%2){ ways.key++; return p.keyboard.press(say?'y':'n'); } ways.click++; return p.click(`[data-eq="${say?1:0}"]`); }
  if(s.kind==='choice'){ const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1)); }
  if(s.kind==='boxes'){ const v={...s.want}; if(wrong){ const k=Object.keys(v)[0]; v[k]=String(Number(v[k])+1); } await fillBoxes(p,v); return p.keyboard.press('Enter'); }
  if(s.kind==='select'){ const good=s.cards.filter(c=>c.ok).map(c=>c.i); await setCards(p,s,wrong?good.slice(1):good); return p.keyboard.press('Enter'); }
  await p.fill('#ans', wrong?(s.traps[0]?s.traps[0].v:String(Number(s.val)+1000)):s.val); return p.keyboard.press('Enter');
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__bridges.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__bridges.G.locked,null,{timeout:6000}); }
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
  let solved=0; const types=new Set(); let sawNotEq=false, sawSlip=false, sawSign=false, sawDecoy=false, sawMissed=false, sawWorked=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type);
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.kind==='test' && !sawSlip){ sawSlip=true;   // a wrong value on bridge 1
      await p.fill('#va',String(Number(s.va)+1)); await p.fill('#vb',s.vb); await p.click('[data-eq="1"]'); await p.waitForTimeout(400);
      ok(/Check bridge 1/.test(await fb(p)),'a wrong value is caught before the decision: '+(await fb(p)).slice(0,80));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='test' && !s.eq && !sawNotEq){ sawNotEq=true;   // says equivalent when the values differ
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/NOT equivalent/.test(await fb(p)) && (await p.$$('#scene .cracked')).length>=1,'calling different values "equivalent" is caught, and a bridge cracks');
      await p.screenshot({path:OUT+'/2b_cracked.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='boxes' && s.form==='distNeg' && !sawSign){ sawSign=true;   // right sizes, wrong signs
      await fillBoxes(p,{k:String(-Number(s.want.k)),m:s.want.m}); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/Check the signs/.test(await fb(p)),'a sign error when distributing a negative is caught: '+(await fb(p)).slice(0,80));
      await p.screenshot({path:OUT+'/4b_sign_error.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='select' && !sawDecoy){ sawDecoy=true;   // one decoy picked
      const good=s.cards.filter(c=>c.ok).map(c=>c.i), bad=s.cards.find(c=>!c.ok).i;
      await setCards(p,s,[...good,bad]); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/is not a twin/.test(await fb(p)),'picking a decoy is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/5b_decoy.png'});
      await unlocked(p); ok(!(await st(p)).picked.includes(bad),'the decoy is un-picked for the retry');
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='select' && !sawMissed){ sawMissed=true;   // one twin missing
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/more/.test(await fb(p)),'a missing twin is caught: '+(await fb(p)).slice(0,80));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='property' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/3b_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='property','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['test','lucky','property','build','select','maria','prove'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.click>=1 && ways.key>=1,`answered by clicking (${ways.click}) and keys (${ways.key})`);
  ok(sawNotEq && sawSign && sawDecoy && sawMissed,'the misconception checks ran');
  await p.screenshot({path:OUT+'/8_report.png'});
  const res=await p.evaluate(()=>window.__bridges.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Deciding with no values typed only nudges');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  await p.keyboard.press('y'); await p.waitForTimeout(300);
  ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')) && (await p.inputValue('#va'))==='','pressing Y with empty boxes only nudges (and types nothing)');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__bridges.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__bridges.G.meter===t,t0),'the river does not rise in practice');

  console.log('\n[5] Washed out, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__bridges.G.meter=99.5; }); await p.waitForTimeout(700); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/WASHED OUT/.test(await p.textContent('#fail')),'WASHED OUT appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 ropes back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/twin-bridges/.test(fr.url()));
  await f.evaluate(()=>{ window.__bridges.G.result={score:20,total:25,accuracy:80,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
