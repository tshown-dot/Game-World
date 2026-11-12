// Log Flume (Grade 7, 4-3): every zone through the real controls, misconceptions, two misses, practice, fail and retry, town messages.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/log_flume'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/g7-topic-4-factor-falls/games/4-3-log-flume/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const shots=new Set(); let way=0; const ways={drag:0,button:0,scene:0,key:0};
// Reads the problem and its answer from the game (flume.js made it), inside the page.
const st=(p)=>p.evaluate(()=>{ const g=window.__flume.G, pr=g.problem; if(!pr) return null;
  const out={ id:pr.id, kind:pr.kind, type:pr.type, zone:g.zone, lives:g.lives, phase:g.phase, next:g.next, picked:[...g.picked] };
  const tot=(ch)=>Math.round(pr.terms.filter(t=>t.v===ch).reduce((s,t)=>s+t.c,0)*100)/100;
  if(pr.kind==='sort'){ out.channels=[...pr.channels]; out.want=pr.terms.map(t=>pr.channels.indexOf(t.v)); out.totals=pr.channels.map(ch=>String(tot(ch))); out.negs=pr.channels.map(ch=>pr.terms.some(t=>t.v===ch&&t.c<0)); }
  if(pr.kind==='boxes'){ out.want=Object.fromEntries(Object.entries(pr.want).map(([k,v])=>[k,k==='m'&&pr.mText?pr.mText:String(v)])); out.form=pr.form; }
  if(pr.kind==='select') out.cards=pr.cards.map((c,i)=>({ok:c.ok,i}));
  if(pr.kind==='test') Object.assign(out,{ va:String(pr.va), vb:String(pr.vb), eq:pr.eq });
  return out; });
async function ready(p){ await p.waitForFunction(()=>{ const g=window.__flume.G; return g.problem && !g.locked && document.getElementById('banner').classList.contains('hidden'); },null,{timeout:15000}); }
async function sendLog(p,k){
  const how=['drag','button','scene','key'][way++%4]; ways[how]++;
  if(how==='drag'){ const c=await (await p.$('#logBtn')).boundingBox(); const t=await (await p.$(`#ch${k}`)).boundingBox();
    await p.mouse.move(c.x+c.width/2,c.y+c.height/2); await p.mouse.down(); await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:8});
    if(!shots.has('drag')){ shots.add('drag'); await p.screenshot({path:OUT+'/2b_dragging.png'}); }
    await p.mouse.up(); }
  else if(how==='button') await p.click(`[data-send="${k}"]`);
  else if(how==='scene'){ const t=await (await p.$(`#ch${k}`)).boundingBox(); await p.mouse.click(t.x+t.width-30,t.y+t.height-12); }
  else await p.keyboard.press(String(k+1));
}
async function sortAll(p){ for(let guard=0;guard<12;guard++){ const s=await st(p); if(s.kind!=='sort'||s.phase!=='sort') break; await sendLog(p,s.want[s.next]); await p.waitForTimeout(60); } }
async function typeTotals(p,s,vals){ for(let k=0;k<s.channels.length;k++) await p.fill(`#t${k}`,vals[k]); await p.keyboard.press('Enter'); }
async function act(p,s,wrong=false){
  if(s.kind==='sort'){ await sortAll(p); const now=await st(p); const v=[...now.totals]; if(wrong) v[0]=String(Number(v[0])+50); return typeTotals(p,now,v); }
  if(s.kind==='boxes'){ const v={...s.want}; if(wrong) v.k=String(Number(v.k)+50); for(const [k,x] of Object.entries(v)) await p.fill('#b_'+k,x); return p.keyboard.press('Enter'); }
  if(s.kind==='select'){ const good=s.cards.filter(c=>c.ok).map(c=>c.i), want=wrong?good.slice(1):good;
    for(const c of s.cards){ const on=(await st(p)).picked.includes(c.i); if(on!==want.includes(c.i)) await p.keyboard.press(String(c.i+1)); } return p.keyboard.press('Enter'); }
  await p.fill('#va',s.va); await p.fill('#vb',s.vb); return p.keyboard.press((wrong?!s.eq:s.eq)?'y':'n');
}
async function changed(p,s){ await p.waitForFunction((id)=>{ const g=window.__flume.G; return !document.getElementById('report').classList.contains('hidden') || (g.problem && g.problem.id!==id && !g.locked && document.getElementById('banner').classList.contains('hidden')); },s.id,{timeout:15000}); }
const fb=(p)=>p.textContent('#feedback');
async function unlocked(p){ await p.waitForFunction(()=>!window.__flume.G.locked,null,{timeout:6000}); }
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
  let solved=0; const types=new Set(); let sawJam=false, sawSign=false, sawWorked=false, sawFrac=false;
  for(let guard=0; guard<90; guard++){
    if(await p.isVisible('#report')) break;
    const s=await st(p); types.add(s.type);
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); await p.screenshot({path:`${OUT}/${name}.png`}); }
    if(s.kind==='sort' && !sawJam){ sawJam=true;   // the first log into the wrong channel
      const wrongCh=(s.want[0]+1)%s.channels.length;
      await p.keyboard.press(String(wrongCh+1)); await p.waitForTimeout(400);
      ok(/like term|plain number|cannot be combined|different variables/.test(await fb(p)),'a log in the wrong channel is explained: '+(await fb(p)).slice(0,90));
      ok((await st(p)).next===0 && (await p.$$('#scene .jammed')).length===1,'the log stays in the flume and the channel shows a jam');
      await p.screenshot({path:OUT+'/2c_jam.png'});
      await unlocked(p); await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    if(s.kind==='sort' && !sawSign){ const k=s.negs.findIndex((n,i)=>n && Number(s.totals[i])!==0);
      if(k>=0){ sawSign=true;   // right size, wrong sign on one channel
        await sortAll(p); const now=await st(p); const v=[...now.totals]; v[k]=String(-Number(v[k])); await typeTotals(p,now,v); await p.waitForTimeout(400);
        ok(/sign|NEGATIVE/.test(await fb(p)),'a wrong sign on a channel total is caught: '+(await fb(p)).slice(0,90));
        await p.screenshot({path:OUT+'/2d_totals_wrong.png'});
        await unlocked(p); await typeTotals(p,now,now.totals); solved++; await changed(p,s); continue; }
    }
    if(s.type==='quick' && !sawWorked){ // two misses: worked solution + backup
      await act(p,s,true); await p.waitForTimeout(300); await unlocked(p);
      await act(p,await st(p),true); await p.waitForTimeout(400);
      sawWorked=await p.isVisible('#feedback .steps'); ok(sawWorked,'two misses show the worked solution');
      await p.screenshot({path:OUT+'/4b_worked.png'});
      await p.keyboard.press('Enter'); await ready(p);
      const backup=await st(p); ok(/BACKUP/.test(await p.textContent('#taskTag')) && backup.type==='quick','then a backup of the same type');
      continue;
    }
    if(s.type==='fraction' && !sawFrac){ sawFrac=true;   // a rounded decimal instead of the exact fraction
      const [n,d]=s.want.m.split('/').map(Number); const dec=(n/d).toFixed(2);
      if(Number(dec)!==n/d){ await p.fill('#b_m',dec); await p.fill('#b_k',s.want.k); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
        ok(/exact fraction/.test(await fb(p)),'a rounded decimal for a fraction is caught: '+(await fb(p)).slice(0,90)); await unlocked(p); }
      await act(p,await st(p)); solved++; await changed(p,s); continue;
    }
    await act(p,s); solved++;
    await changed(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:8000});
  ok(true,`finished all 5 zones (${solved} answers)`);
  ok(['sort','quick','select','fraction','perimeter','orderTest'].every(x=>types.has(x)),'every problem type appeared: '+[...types].join(', '));
  ok(ways.drag>=1 && ways.button>=1 && ways.scene>=1 && ways.key>=1,`logs sent by dragging (${ways.drag}), buttons (${ways.button}), tapping a channel (${ways.scene}) and keys (${ways.key})`);
  ok(sawJam && sawSign,'the misconception checks ran');
  await p.screenshot({path:OUT+'/8_report.png'});
  const res=await p.evaluate(()=>window.__flume.G.result);
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=20,'result for the town: boss beaten, '+res.total+' problems');

  console.log('\n[3] Empty totals only nudge');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  await sortAll(p); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await st(p)).lives===3 && !(await p.isVisible('#feedback')),'pressing Enter with no totals typed only nudges');

  console.log('\n[4] Practice mode');
  await p.goto(URL,{waitUntil:'load'}); await p.click('#practiceBtn'); await ready(p);
  ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const t0=await p.evaluate(()=>window.__flume.G.meter); await p.waitForTimeout(2000);
  ok(await p.evaluate((t)=>window.__flume.G.meter===t,t0),'the flume does not back up in practice');

  console.log('\n[5] Flume blocked, then a fast retry');
  await p.goto(URL,{waitUntil:'load'}); await p.keyboard.press('Enter'); await ready(p);
  for(let k=0;k<3;k++){ await p.waitForFunction(()=>document.getElementById('banner').classList.contains('hidden')); await p.evaluate(()=>{ window.__flume.G.meter=99.5; }); await p.waitForTimeout(700); }
  await p.waitForSelector('#fail:not(.hidden)',{timeout:5000}); ok(/FLUME BLOCKED/.test(await p.textContent('#fail')),'FLUME BLOCKED appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const before=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-before<2000,'back in play in under 2 seconds ('+(Date.now()-before)+' ms)');
  ok((await st(p)).lives===3,'all 3 poles back');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/log-flume/.test(fr.url()));
  await f.evaluate(()=>{ window.__flume.G.result={score:20,total:22,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
