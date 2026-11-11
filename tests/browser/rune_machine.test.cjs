// Rune Machine (4-9): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/rune_machine'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-9-rune-machine/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={click:0,key:0};
// Reads the problem; works out the answer with the game's own module (rune.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./rune.js'); const g=window.__rune.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, type:pr.type, kind:pr.kind, zone:g.zone, lives:g.lives, tried:[...g.tried], form:g.form };
  const t=(v)=>m.fmt(v).replace('−','-');
  if(pr.type==='crack'){ out.rule={...pr.rule}; out.need=m.needs(pr.rule.form); out.vals=Object.fromEntries(out.need.map(k=>[k,t(pr.rule[k])])); out.text=m.ruleText(pr.rule,pr.X,pr.Y); }
  if(pr.type==='fill') out.vals=pr.blanks.map(i=>t(pr.rows[i].y));
  if(pr.type==='predict'){ out.val=t(pr.answer); out.backward=pr.backward; out.fwd=t(m.run(pr.rule,m.run(pr.rule,pr.answer))); }
  if(pr.type==='maya') out.options=pr.options.map((o,i)=>({ok:!!o.ok,row:o.row,i}));
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__rune.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
const SHAPES=['times','plus','line','down'];
async function shape(p,s,form){
  const how=['click','key'][way++%2]; ways[how]++;
  if(how==='click') return p.click(`[data-shape="${form}"]`);
  for(let k=0;k<8 && (await st(p)).form!==form;k++) await p.keyboard.press('ArrowDown');
}
async function act(p,s,wrong=false){
  if(s.type==='crack'){
    const form=wrong?'plus':s.rule.form;
    await shape(p,s,form);
    if(wrong){ await p.fill('#r_b',s.rule.form==='times'?String(s.rule.m):'999'); }
    else for(const k of s.need) await p.fill('#r_'+k,s.vals[k]);
    return p.keyboard.press('Enter');
  }
  if(s.type==='fill'){ for(let k=0;k<s.vals.length;k++) await p.fill('#f'+k, wrong&&k===0?String(Number(s.vals[0])+1):s.vals[k]); return p.keyboard.press('Enter'); }
  if(s.type==='predict'){ await p.fill('#pv', wrong?(s.backward?s.fwd:String(Number(s.val)+1)):s.val); return p.keyboard.press('Enter'); }
  const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1));
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__rune.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__rune.G.locked,null,{timeout:6000}); }
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');

  console.log('\n[2] The whole machine through the real controls');
  await p.keyboard.press('Enter'); await ready(p);
  let solved=0; const types=new Set(), kinds=new Set(); let sawAdd=false, sawWorked=false, sawMaya=false, sawBack=false, sawRows=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type); if(s.kind) kinds.add(s.kind);
    const name={crack:'2_crack',fill:'4_fill',predict:'5_predict',maya:'7_maya'}[s.type]+(s.zone===4?'_boss':'');
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.type==='crack' && s.rule.form==='times' && !sawAdd){ sawAdd=true; // y = x + 8 for y = 8x
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/TIMES/.test(await fb(p)),'"add" for a times rule is caught: '+(await fb(p)).slice(0,90));
      const lit=await p.$$eval('#scene .row-lit',e=>e.length); sawRows=lit===4; ok(sawRows,'the machine lights every row of the table ('+lit+')');
      await p.screenshot({path:OUT+'/3_rows_lit.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='predict' && s.backward && !sawBack && s.fwd!==s.val){ sawBack=true;
      await act(p,s,true); await p.waitForTimeout(400);
      ok(/forward/.test(await fb(p)),'working backward the wrong way is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='maya' && !sawMaya){ sawMaya=true;
      const none=s.options.find(o=>o.row===-1); await p.keyboard.press(String(none.i+1)); await p.waitForTimeout(400);
      ok(/EVERY row/.test(await fb(p)),'"Maya is right" is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.type==='fill' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/6_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='fill','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['crack','fill','predict','maya'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(['line','down','decimal'].every(x=>kinds.has(x)),'two-step, decreasing and decimal rules appeared: '+[...kinds].join(', '));
  ok(ways.click>=1 && ways.key>=1,`shapes picked by clicking (${ways.click}) and arrow keys (${ways.key})`);
  await p.screenshot({path:OUT+'/8_report.png'});
  ok(/Skills to sharpen/.test(await p.textContent('#report')),'the report lists skills to sharpen');
  const res=await p.evaluate(()=>window.__rune.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Empty boxes are a nudge, not a miss');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  const s0=await st(p); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/first|every box|number/i.test(await p.textContent('#helpLine')) && (await st(p)).lives===3 && !(await p.isVisible('#feedback')),'pressing Enter with nothing typed only nudges ('+s0.type+')');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__rune.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__rune.G.meter===t,t0),'the runes do not fade in practice');

  console.log('\n[5] Three torches out, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__rune.G.meter=99.5; }); await p.waitForTimeout(500); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/SEALED/.test(await p.textContent('#fail')),'MACHINE SEALED appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 torches back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/rune-machine/.test(fr.url()));
  await f.evaluate(()=>{ window.__rune.G.result={score:5,total:6,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
