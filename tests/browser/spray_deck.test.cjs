// Spray Deck (Grade 7, 4-4): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/spray_deck'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/g7-topic-4-factor-falls/games/4-4-spray-deck/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set();
// Reads the problem and its answer from the game (deck.js made it), inside the page.
const st=(p)=>p.evaluate(()=>{ const g=window.__deck.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, kind:pr.kind, type:pr.type, level:pr.level, zone:g.zone, lives:g.lives, phase:g.phase, tried:[...g.tried], picked:[...g.picked] };
  if(pr.kind==='deck'){ out.areas=[...pr.expanded,...(pr.tail?[pr.tail]:[])].map(t=>String(t.c)); out.inside=pr.inside.map(t=>String(t.c)); out.a=pr.a; out.tail=!!pr.tail; out.tailWrong=pr.tail?String(Math.round(pr.a*pr.tail.c*100)/100):null;
    out.needsSimplify=pr.needsSimplify; out.simple=pr.simple.map(t=>[t.v||'k',String(t.c)]); }
  if(pr.options) out.options=pr.options.map((o,i)=>({ok:!!o.ok,key:o.key,i}));
  if(pr.kind==='select') out.cards=pr.cards.map((c,i)=>({ok:c.ok,i}));
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__deck.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function typeAreas(p,vals){ for(let i=0;i<vals.length;i++) await p.fill(`#s${i}`,vals[i]); await p.keyboard.press('Enter'); }
async function typeSimple(p,s,wrong){ for(const [k,v] of s.simple) await p.fill(`#m_${k}`, wrong?String(Number(v)+50):v); await p.keyboard.press('Enter'); }
async function act(p,s,wrong=false){
  if(s.kind==='deck'){
    if(s.phase==='expand'){ const v=[...s.areas]; if(wrong&&!s.needsSimplify) v[0]=String(Number(v[0])+50); await typeAreas(p,v); if(!s.needsSimplify) return; await p.waitForFunction(()=>window.__deck.G.phase==='simplify'); }
    return typeSimple(p,await st(p),wrong);
  }
  if(s.kind==='choice'){ const o=s.options.find(o=>wrong?(!o.ok&&!s.tried.includes(o.i)):o.ok); return p.keyboard.press(String(o.i+1)); }
  const good=s.cards.filter(c=>c.ok).map(c=>c.i), want=wrong?good.slice(1):good;
  for(const c of s.cards){ const on=(await st(p)).picked.includes(c.i); if(on!==want.includes(c.i)) await p.click(`[data-card="${c.i}"]`); } return p.keyboard.press('Enter');
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__deck.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__deck.G.locked,null,{timeout:6000}); }
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
  let solved=0; const types=new Set(), levels=new Set(); let sawFirst=false, sawSign=false, sawTail=false, sawWorked=false, sawTwoStep=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type); if(s.level) levels.add(s.level);
    const name=`${s.zone+2}_${s.level||s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.kind==='deck' && !sawFirst){ sawFirst=true;   // the second section not multiplied
      const v=[...s.areas]; v[1]=s.inside[1]; await typeAreas(p,v); await p.waitForTimeout(400);
      ok(/EVERY section/.test(await fb(p)),'an un-multiplied section is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/2b_first_term_only.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='deck' && s.a<0 && !sawSign){ sawSign=true;   // right size, wrong sign under a negative width
      const v=[...s.areas]; v[1]=String(-Number(v[1])); await typeAreas(p,v); await p.waitForTimeout(400);
      ok(/Check the sign|EVERY section/.test(await fb(p)) && (await p.textContent('#scene')).includes('COLD DECK'),'a sign error on a cold (negative) deck is caught: '+(await fb(p)).slice(0,90));
      await p.screenshot({path:OUT+'/4b_sign_error.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='deck' && s.tail && !sawTail){ sawTail=true;   // multiplying the term outside the parentheses
      const v=[...s.areas]; v[v.length-1]=s.tailWrong; await typeAreas(p,v); await p.waitForTimeout(400);
      ok(/OUTSIDE the parentheses/.test(await fb(p)),'expanding the term outside the parentheses is caught: '+(await fb(p)).slice(0,90));
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='deck' && s.needsSimplify && !sawTwoStep){ sawTwoStep=true;   // expand, then simplify
      await typeAreas(p,s.areas); await p.waitForFunction(()=>window.__deck.G.phase==='simplify');
      ok((await p.$$('#scene .laid')).length===s.inside.length && await p.isVisible('#m_'+s.simple[0][0]),'after expanding, the planks are laid and the simplify boxes appear');
      await p.screenshot({path:OUT+'/3b_simplify_step.png'});
      await typeSimple(p,await st(p),false); solved++; await changed(p,s); continue;
    }
    if(s.type==='varOut' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/5b_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='varOut','then a backup of the same type');
      continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['deck','varOut','gardener','select'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(['int2','three','neg','dec','dec3','tail','frac','bread'].every(x=>levels.has(x)),'every kind of deck appeared: '+[...levels].join(', '));
  ok(sawFirst && sawSign && sawTail && sawTwoStep,'the misconception checks ran');
  await p.screenshot({path:OUT+'/8_report.png'});
  const res=await p.evaluate(()=>window.__deck.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Empty sections only nudge; the deck shows what is typed');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')),'pressing Enter with empty sections only nudges');
  await p.fill('#s0','-12'); await p.waitForTimeout(100);
  ok((await p.textContent('#scene')).includes('−12'),'a typed area appears on its section of the deck');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__deck.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__deck.G.meter===t,t0),'no mist in practice');

  console.log('\n[5] Lost in the mist, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__deck.G.meter=99.5; }); await p.waitForTimeout(700); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/LOST IN THE MIST/.test(await p.textContent('#fail')),'LOST IN THE MIST appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 planks back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/spray-deck/.test(fr.url()));
  await f.evaluate(()=>{ window.__deck.G.result={score:20,total:24,accuracy:83,stars:2,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
