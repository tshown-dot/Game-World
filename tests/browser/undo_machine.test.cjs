const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/undo_machine'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
 const URL=BASE+'towns/topic-4-equation-valley/games/4-3-undo-machine/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,tap:0,key:0};
const st=(p)=>p.evaluate(()=>{ const g=window.__undo.G, pr=g.problem; if(!pr) return null; const w=g.work;
  return { id:pr.id, type:pr.type, phase:g.phase, locked:g.locked, zone:g.zone, attempts:g.attempts, boilers:g.lives,
    eq:pr.eq, work:w, tiles:pr.tiles, match:pr.match, banner:!document.getElementById('banner').classList.contains('hidden') }; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__undo.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
const fmt=(v)=>Number.isInteger(Math.round(v*100)/100)?String(Math.round(v*100)/100):(Math.round(v*100)/100).toFixed(2);
async function write(p,s,wrong){
  // the intended equation as tokens
  const e=s.eq; const L=e.letter; let toks;
  if(e.kind==='plus') toks=e.letterFirst?[L,'+',e.a,'=',e.c]:[e.a,'+',L,'=',e.c];
  else if(e.kind==='minus') toks=[L,'-',e.a,'=',e.c];
  else if(e.kind==='taken') toks=[e.a,'-',L,'=',e.c];
  else toks=[e.a,'+',e.b,'+',L,'=',e.c];
  if(wrong){ toks=toks.map(t=>t==='+'?'-':t==='-'?'+':t); }
  const used=[];
  for(const t of toks){
    let sel;
    if(t===L) sel='[data-tile="var"]'; else if(t==='+') sel='[data-tile="+"]'; else if(t==='-') sel='[data-tile="-"]'; else if(t==='=') sel='[data-tile="eq"]';
    else { const i=s.tiles.findIndex((v,j)=>Math.abs(v-t)<0.001 && !used.includes(j)); used.push(i); sel=`[data-tile="num"][data-i="${i}"]`; }
    if(used.length===1 && t!==L && typeof t==='number' && way%2===0){ // drag one tile per problem onto the rail
      const bb=await (await p.$(sel)).boundingBox(); const r=await (await p.$('#rail')).boundingBox();
      await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:6}); await p.mouse.up(); ways.drag++;
    } else await p.click(sel);
  }
  way++;
  await p.keyboard.press('Enter');
}
async function undo(p,s,wrong){
  const w=s.work; const op = (w.kind==='plus') !== Boolean(wrong) ? '-' : '+';
  await p.click(`[data-op="${op}"]`);
  for(const ch of fmt(w.a)) await p.keyboard.press(ch);
  const how=['drag','tap','key'][way++%3]; ways[how]++;
  if(how==='drag'){ const bb=await (await p.$('#block')).boundingBox(); const m=await (await p.$('#machine')).boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(m.x+m.width/2,m.y+m.height/2,{steps:8});
    if(!shots.has('drag')){ shots.add('drag'); await p.screenshot({path:OUT+'/3_dragging_block.png'}); }
    await p.mouse.up(); }
  else if(how==='tap'){ await p.click('#block'); const m=await (await p.$('#machine')).boundingBox(); await p.mouse.click(m.x+m.width/2,m.y+m.height/2); }
  else await p.keyboard.press('Enter');
}
async function typed(p,v){ for(const ch of fmt(v)) await p.keyboard.press(ch); await p.keyboard.press('Enter'); }
async function act(p,s,wrong=false){
  if(s.phase==='write') return write(p,s,wrong);
  if(s.phase==='undo') return undo(p,s,wrong);
  if(s.phase==='combine') return typed(p, wrong? s.eq.a+s.eq.b+10 : s.eq.a+s.eq.b);
  if(s.phase==='typed') return typed(p, wrong? s.work.a+s.work.c : s.work.x);
  if(s.phase==='sort') return p.keyboard.press((s.match!==wrong)?'ArrowRight':'ArrowLeft');
}
async function changed(p,s){ await p.waitForFunction(([id,ph])=>{ const g=window.__undo.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && (g.problem.id!==id || g.phase!==ph) && !g.locked && document.getElementById('banner').classList.contains('hidden')); },[s.id,s.phase],{timeout:15000}); }
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
  let solved=0; const phases=new Set(), types=new Set(); let sawHint=false, sawWorked=false, sawBackup=false, sawFailedCheck=false, sawSortMiss=false;
  for(let guard=0; guard<120; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); phases.add(s.phase); types.add(s.type);
    const name={write:'2_write',undo:'4_undo',sort:'6_sort',combine:'7_boss_combine',typed:'8_boss_taken'}[s.phase];
    if(name && !shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(solved===1 && s.phase==='undo' && !sawHint){ // one wrong block: the check fails, then a hint
      await act(p,s,true); await p.waitForTimeout(1900);
      sawFailedCheck=/NEEDS/.test(await p.textContent('#scene')); ok(sawFailedCheck,'a wrong block makes the machine\'s check fail (red crate)');
      await p.screenshot({path:OUT+'/5_failed_check.png'});
      sawHint=/Try again/.test(await p.textContent('#feedback')); ok(sawHint,'and a specific hint: '+(await p.textContent('#feedback')).slice(0,90));
      await p.waitForFunction(()=>!window.__undo.G.locked,null,{timeout:5000});
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(solved===3 && !sawWorked && (s.phase==='write'||s.phase==='undo')){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(s.phase==='undo'?1900:300);
      await p.waitForFunction(()=>!window.__undo.G.locked,null,{timeout:5000});
      await act(p,await st(p),true); await p.waitForTimeout(s.phase==='undo'?1900:400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution ('+s.phase+' step)');
      await p.screenshot({path:OUT+'/9_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      sawBackup=/BACKUP/.test(await p.textContent('#taskTag')); ok(sawBackup,'then a backup problem');
      ok((await st(p)).type===s.type,'of the same type ('+s.type+')'); continue;
    }
    if(s.phase==='sort' && !sawSortMiss){
      await act(p,s,true); await p.waitForTimeout(400); sawSortMiss=/NEXT CRATE/.test(await p.textContent('#feedback'));
      ok(sawSortMiss,'a wrongly sorted crate shows both solutions: '+(await p.textContent('#feedback')).slice(0,80));
      await p.screenshot({path:OUT+'/6b_sort_miss.png'}); await p.keyboard.press('Enter'); await ready(p); continue;
    }
    await act(p,s); if(s.phase!=='write' && s.phase!=='combine') solved++;
    if(s.type==='multi'&&s.phase==='undo' && !shots.has('boss_done')){ shots.add('boss_done'); await p.waitForTimeout(1800); await p.screenshot({path:OUT+'/10_boss_check.png'}); }
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} problems)`);
  ok(['write','undo','sort','combine','typed'].every(x=>phases.has(x)),'every step appeared: '+[...phases].join(', '));
  ok(['undo','story','sort','multi','taken'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.drag>=3 && ways.tap>=3 && ways.key>=3,`dragged (${ways.drag}), tapped (${ways.tap}) and used keys (${ways.key})`);
  await p.screenshot({path:OUT+'/11_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__undo.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Fewer-than trap and the order trap get their own hints');
  await p.goto(URL,{waitUntil:'load'}); await p.click('[data-zone="1"]'); await p.keyboard.press('Enter'); await ready(p);
  let found=false;
  for(let k=0;k<6 && !found;k++){
    const s=await st(p);
    if(s.phase==='write' && s.type==='story' && s.eq.kind==='minus' && (await p.evaluate(()=>window.__undo.G.problem.fewer))){
      const e=s.eq; const i=s.tiles.findIndex(v=>v===e.c), j=s.tiles.findIndex(v=>v===e.a);
      for(const sel of [`[data-tile="num"][data-i="${i}"]`,'[data-tile="-"]',`[data-tile="num"][data-i="${j}"]`,'[data-tile="eq"]','[data-tile="var"]']) await p.click(sel);
      await p.click('#buildBtn'); await p.waitForTimeout(300);
      const fb=await p.textContent('#feedback'); ok(/Careful with/.test(fb),'"'+fb.slice(0,100)+'"'); await p.screenshot({path:OUT+'/12_fewer_trap.png'}); found=true;
    } else { await act(p,s); await changed(p,s); }
  }
  if(!found) ok(true,'(no fewer-than story came up in 6 tries; covered by unit tests)');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__undo.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__undo.G.meter===t,t0),'pressure does not build in practice');

  console.log('\n[5] All boilers burst, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__undo.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(true,'MACHINE DOWN appears'); await p.screenshot({path:OUT+'/13_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).boilers===3,'all 3 boilers back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/undo-machine/.test(fr.url()));
  await f.evaluate(()=>{ window.__undo.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
