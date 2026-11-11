const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/gear_shift'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
 const URL=BASE+'towns/topic-4-equation-valley/games/4-4-gear-shift/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,tap:0,key:0};
const st=(p)=>p.evaluate(()=>{ const g=window.__gears.G, pr=g.problem; if(!pr) return null;
  return { id:pr.id, type:pr.type, calc:pr.calc, phase:g.phase, locked:g.locked, zone:g.zone, attempts:g.attempts, boilers:g.lives,
    eq:pr.eq, work:g.work, pending:g.pending, tiles:pr.tiles, options:pr.options }; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__gears.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
const apply=(v,op,n)=>op==='+'?v+n:op==='-'?v-n:op==='×'?v*n:v/n;
async function write(p,s,wrong){
  const e=s.eq, L='VAR', k=e.k, c=e.c; let toks;
  if(s.phase==='writeX') toks = wrong ? [c,'×',k,'=',L] : e.kind==='times' ? [k,'×',L,'=',c] : [k,'×',c,'=',L];
  else if(s.phase==='writeD') toks = wrong ? [k,'÷',c,'=',L] : e.kind==='times' ? [c,'÷',k,'=',L] : [L,'÷',k,'=',c];
  else toks = wrong ? [L,'×',2,'=',c] : [L,'÷',2,'=',c];
  const used=[]; let dragged=false;
  for(const t of toks){
    let sel;
    if(t===L) sel='[data-tile="var"]'; else if(t==='×'||t==='÷') sel=`[data-tile="${t}"]`; else if(t==='=') sel='[data-tile="eq"]';
    else { const i=s.tiles.findIndex((v,j)=>v===t && !used.includes(j)); used.push(i); sel=`[data-tile="num"][data-i="${i}"]`; }
    if(!dragged && typeof t==='number' && way%2===0){ dragged=true;
      const bb=await (await p.$(sel)).boundingBox(); const r=await (await p.$('#rail')).boundingBox();
      await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:6}); await p.mouse.up(); ways.drag++;
    } else await p.click(sel);
  }
  way++;
  await p.keyboard.press('Enter');
}
function rightGear(w){ return w.kind==='times'?['÷',w.k]:w.kind==='div'?['×',w.k]:['-',w.b]; }
function wrongGear(w){ return w.kind==='times'?['×',w.k]:w.kind==='div'?['÷',w.k]:['÷',w.k]; }
async function gear(p,s,wrong){
  const [op,n]=wrong?wrongGear(s.work):rightGear(s.work);
  await p.keyboard.press({'×':'*','÷':'/','+':'+','-':'-'}[op]);
  for(const ch of String(n)) await p.keyboard.press(ch);
  const how=['drag','tap','key'][way++%3]; ways[how]++;
  if(how==='drag'){ const bb=await (await p.$('#block')).boundingBox(); const m=await (await p.$('#gearbox')).boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(m.x+m.width/2,m.y+m.height/2,{steps:8});
    if(!shots.has('drag')){ shots.add('drag'); await p.screenshot({path:OUT+'/3_dragging_gear.png'}); }
    await p.mouse.up(); }
  else if(how==='tap'){ await p.click('#block'); const m=await (await p.$('#gearbox')).boundingBox(); await p.mouse.click(m.x+m.width/2,m.y+m.height/2); }
  else await p.keyboard.press('Enter');
}
let commas=0;
let tcount=0;
async function typed(p,v){ const t=v>=1000?v.toLocaleString('en-US'):String(v); tcount++; if(t.includes(',')) commas++; for(const ch of t) await p.keyboard.press(ch); await p.keyboard.press('Enter'); }
async function act(p,s,wrong=false){
  if(s.phase.startsWith('write')) return write(p,s,wrong);
  if(s.phase==='gear') return gear(p,s,wrong);
  if(s.phase==='calc'){ const v=apply(s.work.c,s.pending.op,s.pending.n); return typed(p, wrong? v+1 : v); }
  if(s.phase==='combine') return typed(p, wrong? s.work.m*2 : s.work.m/2);
  if(s.phase==='pick'){ const i=s.options.findIndex(o=>wrong?!o.ok:o.ok); return p.keyboard.press(String(i+1)); }
}
async function changed(p,s){ await p.waitForFunction(([id,ph])=>{ const g=window.__gears.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && (g.problem.id!==id || g.phase!==ph) && !g.locked && document.getElementById('banner').classList.contains('hidden')); },[s.id,s.phase],{timeout:15000}); }
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
  let solved=0; const phases=new Set(), types=new Set(); let sawHint=false, sawWorked=false, sawPickMiss=false, sawTwoStep=false;
  for(let guard=0; guard<150; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); phases.add(s.phase); types.add(s.type);
    const name={writeX:'2_two_ways',gear:'4_gear',calc:'5_calc',pick:'7_pick',combine:'8_boss_triangle'}[s.phase];
    if(name && !shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='twostep' && s.phase==='gear' && s.work.kind==='times' && !sawTwoStep){ sawTwoStep=true; await p.screenshot({path:OUT+'/9_boss_twostep_step2.png'}); }
    if(solved===1 && s.phase==='gear' && !s.calc && !sawHint){ // one wrong gear: the check fails, then a hint
      await act(p,s,true); await p.waitForTimeout(1900);
      ok(/NEEDS/.test(await p.textContent('#scene')),'a wrong gear makes the gearbox check fail (red wheel)');
      await p.screenshot({path:OUT+'/6_failed_check.png'});
      sawHint=/Try again/.test(await p.textContent('#feedback')); ok(sawHint,'and a specific hint: '+(await p.textContent('#feedback')).slice(0,90));
      await p.waitForFunction(()=>!window.__gears.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(solved===3 && !sawWorked && (s.phase.startsWith('write')||s.phase==='gear')){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(s.phase==='gear'?1900:300);
      await p.waitForFunction(()=>!window.__gears.G.locked,null,{timeout:5000});
      await act(p,await st(p),true); await p.waitForTimeout(s.phase==='gear'?1900:400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution ('+s.phase+' step)');
      await p.screenshot({path:OUT+'/10_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      ok(/BACKUP/.test(await p.textContent('#taskTag')),'then a backup problem');
      ok((await st(p)).type===s.type,'of the same type ('+s.type+')'); continue;
    }
    if(s.phase==='pick' && !sawPickMiss){
      await act(p,s,true); await p.waitForTimeout(400); sawPickMiss=/NEXT/.test(await p.textContent('#feedback'));
      ok(sawPickMiss,'a wrong pick explains the right one: '+(await p.textContent('#feedback')).slice(0,80));
      await p.keyboard.press('Enter'); await ready(p); continue;
    }
    if(s.phase==='calc' && s.zone===2 && !shots.has('calc_wrong')){ shots.add('calc_wrong'); // a slip in working it out
      await act(p,s,true); await p.waitForTimeout(300);
      ok(/Try again/.test(await p.textContent('#feedback')),'a wrong typed answer gets a hint: '+(await p.textContent('#feedback')).slice(0,80));
      await p.waitForFunction(()=>!window.__gears.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    await act(p,s); if(!s.phase.startsWith('write') && s.phase!=='combine' && !(s.phase==='gear' && (s.calc||s.work.kind==='twostep'))) solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['writeX','writeD','write','gear','calc','pick','combine'].every(x=>phases.has(x)),'every step appeared: '+[...phases].join(', '));
  ok(['gear','twoways','pick','write','half','twostep'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(sawTwoStep,'a two-step trip went on to its second gear');
  ok(ways.drag>=3 && ways.tap>=3 && ways.key>=3,`dragged (${ways.drag}), tapped (${ways.tap}) and used keys (${ways.key})`);
  if(commas>0) ok(true,'answers typed with commas were accepted ('+commas+')');
  else console.log('  (no answer of 1,000 or more came up this run; typing commas is covered by the math tests)');
  await p.screenshot({path:OUT+'/11_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__gears.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__gears.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__gears.G.meter===t,t0),'pressure does not build in practice');

  console.log('\n[5] All boilers burst, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__gears.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'GEARBOX JAMMED appears'); await p.screenshot({path:OUT+'/13_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).boilers===3,'all 3 spare gears back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/gear-shift/.test(fr.url()));
  await f.evaluate(()=>{ window.__gears.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
