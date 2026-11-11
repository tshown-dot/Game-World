const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/counterweight'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const URL=BASE+'towns/topic-4-equation-valley/games/4-2-counterweight/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set();
async function current(p){ return p.evaluate(()=>{ const g=window.__counterweight.G; const pr=g.problem; return pr && { id:pr.id, type:pr.type, sab:pr.sabotage, ans:pr.answer, moves:pr.moves, eq:pr.equivalent, mistake:pr.mistake, zone:g.zone, locked:g.locked, crates:g.lives }; }); }
async function waitNew(p, oldId){ await p.waitForFunction((o)=>{ const g=window.__counterweight.G; return g.problem && g.problem.id!==o && !g.locked && document.getElementById('banner').classList.contains('hidden'); }, oldId, {timeout:15000}); }
let way=0; const ways={drag:0,tap:0,key:0};
async function build(p, op, n){ await p.click(`[data-op="${op}"]`); for(const d of String(n)) await p.click(`[data-digit="${d}"]`); }
async function dropOn(p, side, how){
  how = how || ['drag','tap','key'][way++%3]; ways[how]++;
  const pan = await p.$eval(side==='left'?'#panL':'#panR', e=>{ const r=e.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; });
  if(how==='drag'){ const bb=await (await p.$('#block')).boundingBox(); await p.mouse.move(bb.x+bb.width/2, bb.y+bb.height/2); await p.mouse.down(); await p.mouse.move(pan.x, pan.y, {steps:8}); await p.mouse.up(); }
  else if(how==='tap'){ await p.click('#block'); await p.mouse.click(pan.x, pan.y); }
  else await p.keyboard.press(side==='left'?'ArrowLeft':'ArrowRight');
}
async function doMove(p, op, n, side){ await build(p, op, n); await dropOn(p, side); }
async function answer(p, c, {wrong=false}={}){
  const opp={'+':'-','-':'+','×':'÷','÷':'×'};
  const other=(s)=>s==='left'?'right':'left';
  if(c.type==='rebalance'){ wrong ? await doMove(p, c.sab.op, c.sab.n, c.sab.side) : await doMove(p, c.sab.op, c.sab.n, other(c.sab.side)); }
  else if(c.type==='isolate'||c.type==='partial'){ const op = wrong ? (c.ans.op==='÷'?'×':'+') : c.ans.op; await doMove(p, op, c.ans.n, 'left'); await dropOn(p, 'right'); }
  else if(c.type==='chain'){ const [a,b]=wrong?[c.moves[1],c.moves[0]]:c.moves; await doMove(p,a.op,a.n,'right'); await doMove(p,b.op,b.n,'right'); }
  else if(c.type==='property'){ const names=['Addition','Subtraction','Multiplication','Division']; const i=names.findIndex(n=>c.ans.startsWith(n)); await p.click(`[data-choice="${wrong?(i+1)%4:i}"]`); }
  else { // inspect / critique
    if(wrong){ await p.click(`[data-stamp="${c.eq?'0':'1'}"]`); return; }
    await p.click(`[data-stamp="${c.eq?'1':'0'}"]`);
    if(!c.eq){ await p.waitForSelector('[data-mistake]'); await p.click(`[data-mistake="${c.mistake}"]`); }
  }
}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(800);
  ok(await p.isVisible('#briefing'),'the game opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'students can choose any of the 5 starting zones');

  console.log('\n[2] Full mission, through the real buttons');
  await p.keyboard.press('Enter'); await waitNew(p, null);
  let solved=0, sawWrong=0, sawBackup=false, sawWorked=false, lastZone=-1, prevId=null; const types=new Set();
  for(let guard=0; guard<60; guard++){
    const c=await current(p);
    if(c.zone!==lastZone){ lastZone=c.zone; }
    types.add(c.type);
    const shotName={rebalance:'2_rebalance',isolate:'3_isolate',property:'4_property',inspect:'5_inspect',chain:'6_boss_chain'}[c.type];
    if(shotName && !shots.has(shotName)){ shots.add(shotName); await p.screenshot({path:`${OUT}/${shotName}.png`}); }
    if(solved===1){ // one wrong try: feedback shows, then answer
      await answer(p,c,{wrong:true}); await p.waitForTimeout(400);
      ok(await p.isVisible('#feedback') && /Try again/.test(await p.textContent('#feedback')),'a wrong move shows a specific hint and "Try again"');
      sawWrong++; await p.screenshot({path:OUT+'/7_wrong_feedback.png'});
      await p.waitForTimeout(1300);
    }
    if(solved===3){ // two wrong tries: worked solution + backup
      await answer(p,c,{wrong:true}); await p.waitForTimeout(1400);
      const c2=await current(p); await answer(p,c2,{wrong:true}); await p.waitForTimeout(500);
      sawWorked = await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the full worked solution');
      await p.screenshot({path:OUT+'/8_worked_solution.png'});
      await p.click('#fbBtn'); await p.waitForTimeout(300);
      sawBackup = /BACKUP/.test(await p.textContent('#taskTag')); ok(sawBackup,'then a backup problem of the same type');
      ok((await current(p)).type===c.type,'the backup is the same kind of problem');
      await p.waitForFunction(()=>{ const g=window.__counterweight.G; return !g.intro && !g.locked; },null,{timeout:8000});
      const c3=await current(p); prevId=c3.id; await answer(p,c3); solved++;
      if(await p.isVisible('#report')) break;
      await waitNew(p, prevId); continue;
    }
    prevId=c.id; await answer(p,c); solved++;
    await p.waitForTimeout(200);
    if(await p.isVisible('#report')) break;
    try { await waitNew(p, prevId); } catch(e){ if(await p.isVisible('#report')) break; throw e; }
    if(await p.isVisible('#report')) break;
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} problems solved)`);
  ok(['rebalance','isolate','property','inspect','partial','chain','critique'].every(t=>types.has(t)),'every problem type appeared: '+[...types].join(', '));
  await p.screenshot({path:OUT+'/9_report.png'});
  ok(ways.drag>3 && ways.tap>3 && ways.key>3,`blocks were placed by dragging (${ways.drag}), tapping (${ways.tap}) and arrow keys (${ways.key})`);
  const rep=await p.textContent('#report');
  ok(/FIRST TRY/.test(rep) && /Skills to sharpen/.test(rep),'the report shows first-try score and skills to sharpen');
  const res=await p.evaluate(()=>window.__counterweight.G.result);
  ok(res && res.bossDefeated===true && res.practiceMode===false && res.total>=18,'result for the town: boss beaten, not practice, '+res.total+' problems');

  console.log('\n[3] Practice mode');
  await p.click('#againBtn'); await p.click('#practiceBtn'); await waitNew(p,null);
  ok(await p.isVisible('#practiceTag') && !(await p.isVisible('#meterBox .meter')) ,'practice shows a PRACTICE tag and hides the tilt meter');
  const t0=await p.evaluate(()=>window.__counterweight.G.meter); await p.waitForTimeout(2500);
  ok(await p.evaluate((t)=>window.__counterweight.G.meter===t,t0),'the tilt meter does not move in practice');

  console.log('\n[4] Losing all the cargo, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await waitNew(p,null);
  for(let k=0;k<3;k++){ await p.evaluate(()=>{ window.__counterweight.G.meter=99; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000});
  ok(true,'when the tilt meter fills 3 times, CARGO LOST appears'); await p.screenshot({path:OUT+'/10_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await waitNew(p,null);
  ok(Date.now()-before<2000,'retry is back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await current(p)).crates===3,'retry restores all 3 crates');

  console.log('\n[5] Inside a town building (iframe): finishing reports to the town');
  const host=await ctx.newPage();
  await host.goto(BASE+'index.html'); 
  await host.setContent(`<iframe id="f" src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500);
  const msgs=await host.evaluate(()=>window.msgs.map(m=>m.type));
  ok(msgs.includes('CARTRIDGE_READY'),'the game says READY to the town');
  const f=host.frames().find(fr=>/counterweight/.test(fr.url()));
  await f.evaluate(()=>{ const g=window.__counterweight.G; g.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; });
  await f.evaluate(()=>document.getElementById('townBtn').click()); await host.waitForTimeout(300);
  const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.score===5 && done.payload.bossDefeated===true,'BACK TO TOWN sends the result to the town');

  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 (overflow px: '+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
