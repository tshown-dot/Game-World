// Trail Mapper (4-10): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/trail_mapper'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-10-trail-mapper/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={tap:0,key:0,click:0,arrow:0};
// Reads the problem; works out the answer with the game's own module (trail.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./trail.js'); const g=window.__trail.G, pr=g.problem; if(!pr) return null;
  const t=(v)=>m.fmt(v).replace('−','-');
  const out={ id:pr.id, type:pr.type, kind:pr.kind, zone:g.zone, lives:g.lives, tried:[...g.tried], form:g.form, pts:g.pts.map(q=>({...q})), cursor:{...g.cursor}, grid:pr.grid };
  out.rows=pr.rows.map(r=>({...r})); out.rule={...pr.rule}; out.need=m.needs(pr.rule.form||'times');
  if(pr.type==='rule') out.vals=Object.fromEntries(out.need.map(k=>[k,t(pr.rule[k])]));
  if(pr.type==='read'||pr.type==='goal'){ out.val=t(pr.answer); out.backward=pr.backward; if(pr.ask) out.given=t(pr.backward?pr.ask.y:pr.ask.x); }
  if(pr.type==='goal') out.down=String(Math.floor(pr.exact)), out.exactInt=Number.isInteger(pr.exact);
  if(pr.options) out.options=pr.options.map((o,i)=>({ok:!!o.ok,key:o.key,i}));
  if(pr.type==='offpoint') out.bad=pr.bad;
  if(pr.type==='odd') out.odd=pr.odd;
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__trail.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
const screenAt=(p,x,y)=>p.evaluate(([x,y])=>{ const g=window.__trail.G.problem.grid, svg=document.getElementById('scene'); const pt=svg.createSVGPoint(); pt.x=80+x/g.xStep*40; pt.y=430-y/g.yStep*40; const s=pt.matrixTransform(svg.getScreenCTM()); return {x:s.x,y:s.y}; },[x,y]);
async function plotPoint(p,q){
  const how=['tap','key'][way++%2]; ways[how]++;
  if(how==='tap'){ const s=await screenAt(p,q.x,q.y); await p.mouse.click(s.x,s.y); return; }
  const s=await st(p); const ti=Math.round(q.x/s.grid.xStep), tj=Math.round(q.y/s.grid.yStep);
  for(let k=s.cursor.i;k<ti;k++) await p.keyboard.press('ArrowRight'); for(let k=s.cursor.i;k>ti;k--) await p.keyboard.press('ArrowLeft');
  for(let k=s.cursor.j;k<tj;k++) await p.keyboard.press('ArrowUp'); for(let k=s.cursor.j;k>tj;k--) await p.keyboard.press('ArrowDown');
  await p.keyboard.press(' ');
}
async function act(p,s,wrong=false){
  if(s.type==='plot'){
    if((await st(p)).pts.length) await p.click('#clearPts');
    for(let k=0;k<s.rows.length;k++){ const r=s.rows[k]; await plotPoint(p, wrong&&k===0?{x:r.x,y:Math.min(r.y+s.grid.yStep,s.grid.yMax)===r.y?r.y-s.grid.yStep:Math.min(r.y+s.grid.yStep,s.grid.yMax)}:r); }
    return p.keyboard.press('Enter');
  }
  if(s.type==='rule'){
    const form=wrong?'plus':s.rule.form; const how=['click','arrow'][way++%2]; ways[how]++;
    if(how==='click') await p.click(`[data-shape="${form}"]`); else for(let k=0;k<8 && (await st(p)).form!==form;k++) await p.keyboard.press('ArrowDown');
    if(wrong) await p.fill('#r_b', s.rule.form==='times'?String(s.rule.m):'99'); else for(const k of s.need) await p.fill('#r_'+k,s.vals[k]);
    return p.keyboard.press('Enter');
  }
  if(s.type==='read'||s.type==='goal'){ await p.fill('#ans', wrong?(s.type==='goal'?s.down:s.given):s.val); return p.keyboard.press('Enter'); }
  if(s.type==='odd'){ const ws=['rule','table','map']; const w=wrong?ws.find(x=>x!==s.odd&&!s.tried.includes(x)):s.odd; return p.keyboard.press(String(ws.indexOf(w)+1)); }
  if(s.type==='offpoint'){ const i=wrong?[0,1,2,3].find(i=>i!==s.bad&&!s.tried.includes(i)):s.bad; return p.click(`[data-choice="${i}"]`); }
  const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1));
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__trail.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__trail.G.locked,null,{timeout:6000}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(); let sawSwap=false, sawWorked=false, sawAxis=false, sawAdd=false, sawRound=false, sawMary=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type);
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='plot' && !sawSwap){ sawSwap=true; // plot one point backwards: (y, x)
      const r=s.rows.find(r=>r.y<=s.grid.xMax && r.x<=s.grid.yMax && r.x!==r.y && r.y%s.grid.xStep===0 && r.x%s.grid.yStep===0);
      if(r){ await plotPoint(p,{x:r.y,y:r.x}); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
        ok(/backwards/.test(await fb(p)),'a point plotted backwards is caught: '+(await fb(p)).slice(0,90));
        await p.screenshot({path:OUT+'/2b_backwards.png'}); await unlocked(p); }
      else sawSwap=false;
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='read' && !sawAxis && s.given!==s.val){ sawAxis=true;
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/axis/.test(await fb(p)),'reading the wrong axis is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='rule' && s.rule.form==='times' && !sawAdd){ sawAdd=true;
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/TIMES/.test(await fb(p)) && (await p.$$('#scene .guess')).length===1,'"plus" for a times trail is caught, and their rule is drawn on the map');
      await p.screenshot({path:OUT+'/4b_guess_line.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='mary' && !sawMary){ sawMary=true;
      const o=s.options.find(o=>o.key==='mary_multiply'); await p.keyboard.press(String(o.i+1)); await p.waitForTimeout(400);
      ok(/Mary/.test(await fb(p)),'choosing Mary\'s equation is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='goal' && !sawRound && !s.exactInt){ sawRound=true;
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/round UP/.test(await fb(p)),'rounding down on an "at least" goal is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='odd' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/5b_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='odd','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['plot','read','meaning','rule','odd','offpoint','mary','goal'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.tap>=1 && ways.key>=1,`points plotted by tapping (${ways.tap}) and the keyboard cursor (${ways.key})`);
  ok(sawSwap && sawAxis && sawAdd,'the misconception checks ran');
  await p.screenshot({path:OUT+'/8_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__trail.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Hover shows where you are; tapping a point again removes it');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  let s0=await st(p); const r0=s0.rows[0]; const at=await screenAt(p,r0.x,r0.y);
  await p.mouse.move(at.x,at.y); await p.waitForTimeout(150);
  ok((await p.textContent('#hover')).includes(`(${r0.x}, `),'hovering the map shows the coordinates');
  await p.mouse.click(at.x,at.y); await p.waitForTimeout(100); const n1=(await st(p)).pts.length;
  await p.mouse.click(at.x,at.y); await p.waitForTimeout(100); const n2=(await st(p)).pts.length;
  ok(n1===1 && n2===0,'tap to plot, tap again to remove');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')),'checking with no points only nudges');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__trail.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__trail.G.meter===t,t0),'no rockslide in practice');

  console.log('\n[5] Three canteens dry, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__trail.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/LOST/.test(await p.textContent('#fail')),'LOST IN THE CANYON appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 canteens back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/trail-mapper/.test(fr.url()));
  await f.evaluate(()=>{ window.__trail.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
