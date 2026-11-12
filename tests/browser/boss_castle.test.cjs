// Boss Castle (Topic 3 boss): every part through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/boss_castle'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-3-expression-town/games/3-boss-castle/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={click:0,key:0};
// Reads the problem; works out the answer with the game's own module (castle.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./castle.js'); const g=window.__castle.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, kind:pr.kind, type:pr.type, zone:g.zone, lives:g.lives, tried:[...g.tried], form:g.form, vals:{...g.vals} };
  if(pr.kind==='num'){ out.val=m.fmt(pr.answer).replace(/,/g,'').replace('−','-'); out.traps=pr.traps.map(t=>({v:String(t.v),key:t.key})); }
  if(pr.options) out.options=pr.options.map((o,i)=>({ok:!!o.ok,key:o.key,i}));
  if(pr.kind==='boxes') out.want=Object.fromEntries(Object.entries(pr.want).map(([k,v])=>[k,String(v)]));
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__castle.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function act(p,s,wrong=false){
  if(s.kind==='num'){ await p.fill('#ans', wrong?(s.traps[0]?s.traps[0].v:String(Number(s.val)+1000)):s.val); return p.keyboard.press('Enter'); }
  if(s.kind==='choice'){ const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1)); }
  const keys=Object.keys(s.want); const how=['tab','click'][way++%2]; ways[how==='tab'?'key':'click']++;
  for(let k=0;k<keys.length;k++){ const v=wrong&&k===0?String(Number(s.want[keys[0]])+1):s.want[keys[k]];
    if(how==='click'||k===0) await p.click('#b_'+keys[k]); else await p.keyboard.press('Tab');
    await p.keyboard.press('Control+A'); await p.keyboard.type(v); }      // the game keeps old numbers after a miss
  return p.keyboard.press('Enter');
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__castle.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__castle.G.locked,null,{timeout:6000}); }
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(8).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the boss briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 castle parts can be the start');

  console.log('\n[2] The whole fight through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(), kinds=new Set(); let sawSame=false, sawWorked=false, sawCircle=false, sawRule=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type); kinds.add(s.kind);
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='order' && !sawSame && s.traps.length){ sawSame=true; // a classic order-of-operations slip
      await p.fill('#ans',s.traps[0].v); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/first|BEFORE|LEFT TO RIGHT|only/.test(await fb(p)),'an order-of-operations slip is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/3b_punch.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='power' && !sawCircle && s.traps.some(t=>t.key==='base_times_exponent')){ sawCircle=true;   // 4³ = 12
      await p.fill('#ans', s.traps.find(t=>t.key==='base_times_exponent').v); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/is NOT/.test(await fb(p)),'base × exponent is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='distribute' && !sawRule){ sawRule=true;   // 4(2x + 3) = 8x + 3
      await p.click('#b_m'); await p.keyboard.type(s.want.m); await p.keyboard.press('Tab'); await p.keyboard.type(String((await p.evaluate(()=>window.__castle.G.problem.c))));
      await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      ok(/BOTH terms/.test(await fb(p)),'multiplying only the first term is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/6b_distribute_wrong.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='gcf' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/4b_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='gcf','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`broke all 5 parts of the castle (${solved} answers)`);
  ok(['num','choice','boxes'].every(x=>kinds.has(x)),'every answer kind appeared: '+[...kinds].join(', '));
  ok(['power','writePower','gcfOrLcm','gcf','lcm','order','writeExpr','evaluate','distribute','factor','combine','dilemma1','dilemma2'].every(x=>types.has(x)),'every lesson\'s problem type appeared');
  ok(ways.click>=1 && ways.key>=1,`boxes filled by clicking (${ways.click}) and Tab (${ways.key})`);
  await p.screenshot({path:OUT+'/8_report.png'});
  const res=await p.evaluate(()=>window.__castle.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result: Colossus defeated in a timed run, '+res.total+' problems');

  console.log('\n[3] Typed answers: a fraction works, an empty box only nudges');
  await p.goto(URL,{waitUntil:'load'}); await p.click('[data-zone="2"]').catch(()=>{}); await p.keyboard.press('Enter'); await ready(p);
  const s3=await st(p);
  if(s3.kind==='num'){ await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')),'pressing Enter with nothing typed only nudges'); }

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__castle.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__castle.G.meter===t,t0),'the hammer does not rise in practice');

  console.log('\n[5] Knocked out, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__castle.G.meter=99.5; }); await p.waitForTimeout(700); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/KNOCKED OUT/.test(await p.textContent('#fail')),'KNOCKED OUT appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 hearts back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/boss-castle/.test(fr.url()));
  await f.evaluate(()=>{ window.__castle.G.result={score:20,total:25,accuracy:80,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
