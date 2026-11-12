// Food Truck (4-5, the action game): every zone through the real controls (calling tickets on the rail, picking tools,
// the register, building a ticket, the cook's slip), each kind of mistake and what it costs, the hint card, practice,
// fail and retry, town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/food_truck'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-5-food-truck/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
// What the game is showing, with the answers worked out by the game's own math module (truck.js), inside the page.
const st=(p)=>p.evaluate(async()=>{ const m=await import('./truck.js'); const f=window.__truck, W=f.W, G=f.G, r=W.round||{}, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  const out={ zone:G.zone, lives:G.lives, meter:G.meter, good:G.good, bad:G.bad, score:G.score, phase:W.phase, ri:W.ri, n:W.rounds.length, type:r.type, frozen:W.frozen, tries:W.tries,
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), callout:vis('callout'), banner:vis('banner'), mistakes:{...G.mistakes}, width:document.getElementById('play').clientWidth };
  if(r.eq) Object.assign(out,{ eq:m.eqText(r.eq), kind:r.eq.kind, style:r.eq.style, letter:r.eq.letter, x:m.show(r.eq.x,r.eq.style), xFrac:`${r.eq.x.n}/${r.eq.x.d}`, xPlus:m.show(m.add(r.eq.x,m.fr(1)),'fraction'), story:r.story||null });
  if(r.type==='sort') out.items=W.items.map(i=>({ n:i.n, x:i.x, state:i.state, ans:m.moreOrLess(i.p.eq), kind:i.p.eq.kind }));
  if(r.type==='tool') out.tools=r.tools.map(t=>{ const u=m.unwind(r.eq,t.op,t.n); return { text:t.text, correct:u.correct, key:u.key }; });
  if(r.type==='build') out.tiles=r.tiles.map(t=>t.id);
  if(r.type==='critique') out.wrong=r.wrong;
  return out; });
const speed=(p,x)=>p.evaluate((v)=>{ window.__truck.W.speed=v; },x);
const PH=['sort','tool','ring','build','critique'];
async function ready(p){ await p.waitForFunction((PH)=>{ const W=window.__truck.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (PH.includes(W.phase) && hid('banner')); },PH,{timeout:30000}); }
async function nextRound(p,s){ await p.waitForFunction(([z,r,PH])=>{ const f=window.__truck, W=f.W, hid=(id)=>document.getElementById(id).classList.contains('hidden');
  return !hid('report') || ((f.G.zone!==z || W.ri!==r) && PH.includes(W.phase) && hid('banner')); },[s.zone,s.ri,PH],{timeout:60000}); }
// Close the hint card if one opened, then the message.
async function carryOn(p){ if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
async function frozen(p){ await p.waitForFunction(()=>window.__truck.W.frozen,null,{timeout:30000}); }
const used={ callKey:0, callTap:0, toolKey:0, toolTap:0, ringType:0, ringPad:0, buildKeys:0, buildTap:0, lineKey:0, lineTap:0 };
const onRail=(i,w)=>i.state==='roll' && i.x<=w-290 && i.x>120;
async function callIt(p,i,say){
  if((used.callKey+used.callTap)%2===0){ used.callKey++; await p.keyboard.press(say==='more'?'ArrowUp':'ArrowDown'); }
  else { used.callTap++; await p.evaluate(([n,say])=>window.__truck.W.items[n].el.querySelector(`[data-say="${say}"]`).click(),[i.n,say]); }
}
/** Play a rail: call every ticket right as it becomes the front one. */
async function playRail(p){ const done=new Set();
  for(let guard=0;guard<2000;guard++){ const s=await st(p); if(s.phase!=='sort'||s.frozen||s.report) break;
    const t=s.items.find(i=>onRail(i,s.width)&&!done.has(i.n)); if(!t){ await p.waitForTimeout(30); continue; } done.add(t.n); await callIt(p,t,t.ans); } }
const WAYS={ plus:['a','+','L','c'], minus:['L','-','a','c'], times:['a','×','L','c'] };
const OPKEY={ '+':'+', '-':'-', '×':'*', '÷':'/' };
async function build(p,s,[first,op,second,third],how){
  // tiles fill the spaces left to right, so place them in order
  for(const id of [first,second,third]){ if(how==='keys') await p.keyboard.press(String(s.tiles.indexOf(id)+1)); else await p.click(`[data-tile="${id}"]`); }
  if(how==='keys') await p.keyboard.type(OPKEY[op]); else await p.click(`[data-op="${op}"]`);
}
async function typeAnswer(p,text,how){
  await p.fill('#reg','');
  if(how==='pad'){ for(const ch of text) await p.click(`.pad [data-k="${ch}"]`); } else await p.keyboard.type(text);
}
/** Play one round correctly. */
async function playRound(p,s){
  if(s.type==='sort') return playRail(p);
  if(s.type==='tool'){ const i=s.tools.findIndex(t=>t.correct); if(used.toolKey<=used.toolTap){ used.toolKey++; await p.keyboard.press(String(i+1)); } else { used.toolTap++; await p.click(`[data-tool="${i}"]`); } return; }
  if(s.type==='ring'){ const pad=used.ringPad<used.ringType; if(pad) used.ringPad++; else used.ringType++; await typeAnswer(p,s.x,pad?'pad':'type'); if(pad) await p.click('#goBtn'); else await p.keyboard.press('Enter'); return; }
  if(s.type==='build'){ const keys=used.buildKeys<=used.buildTap; if(keys) used.buildKeys++; else used.buildTap++; await build(p,s,WAYS[s.kind],keys?'keys':'tap'); if(keys) await p.keyboard.press('Enter'); else await p.click('#goBtn'); return; }
  if(used.lineKey<=used.lineTap){ used.lineKey++; await p.keyboard.press(String(s.wrong)); } else { used.lineTap++; await p.click(`[data-line="${s.wrong}"]`); }
  await frozen(p); await p.keyboard.press('Enter');
}
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function open(p,{zone=0,practice=false,fast=5}={}){
  await p.goto(URL,{waitUntil:'load'});
  if(zone) await p.click(`[data-zone="${zone}"]`);
  if(practice) await p.click('#practiceBtn'); else await p.keyboard.press('Enter');
  await speed(p,fast); await ready(p);
}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(16).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 zones can be the start');
  ok(!(await p.$('.panel')),'no question panel: the whole screen is the game');

  console.log('\n[2] Every zone through the real controls');
  await p.keyboard.press('Enter'); await speed(p,5); await ready(p);
  let rounds=0; const types=new Set(), styles=new Set(), shots=new Set();
  for(let guard=0;guard<50;guard++){
    const s=await st(p); if(s.report) break;
    types.add(s.type); if(s.style) styles.add(s.style);
    const name=`${s.zone+2}_${s.type}`;
    if(!shots.has(name)){ shots.add(name); if(s.type==='sort'){ await speed(p,1); await p.waitForTimeout(9000); await p.screenshot({path:`${OUT}/${name}.png`}); await speed(p,5); } else await p.screenshot({path:`${OUT}/${name}.png`}); }
    await playRound(p,await st(p)); rounds++;
    if(!shots.has(name+'_done') && s.type!=='sort' && s.type!=='critique'){ shots.add(name+'_done'); await p.waitForTimeout(120); await p.screenshot({path:`${OUT}/${name}_done.png`}); }
    await nextRound(p,s);
  }
  await p.waitForSelector('#report:not(.hidden)',{timeout:10000});
  const end=await st(p); const res=await p.evaluate(()=>window.__truck.G.result);
  ok(true,`finished all 5 zones (${rounds} rounds)`);
  ok(['sort','tool','ring','build','critique'].every(t=>types.has(t)),'every move appeared: '+[...types].join(', '));
  ok(['decimal','fraction','money'].every(x=>styles.has(x)),'decimals, fractions and money: '+[...styles].join(', '));
  ok(used.callKey>=3&&used.callTap>=3,`tickets called with the arrow keys (${used.callKey}) and by tapping (${used.callTap})`);
  ok(used.toolKey>=2&&used.toolTap>=2,`tools picked by number key (${used.toolKey}) and by tapping (${used.toolTap})`);
  ok(used.ringType>=2&&used.ringPad>=2,`answers typed (${used.ringType}) and punched on the register keys (${used.ringPad})`);
  ok(used.buildKeys>=1&&used.buildTap>=1&&used.lineKey>=1&&used.lineTap>=1,'tickets built and cook\'s lines tapped both ways');
  ok(end.bad===0 && end.lives===3,'right every time means no mistakes and no line ('+end.good+' right)');
  ok(res && res.bossDefeated && !res.practiceMode && res.total>=38 && res.stars===3,'result for the town: boss beaten, '+res.total+' decisions, '+res.stars+' stars');
  await p.screenshot({path:OUT+'/8_report.png'});

  console.log('\n[3] The rail: a wrong call, and tickets that got away');
  await open(p); let s=await st(p), t=null;
  for(let guard=0;guard<800&&!t;guard++){ s=await st(p); t=s.items.find(i=>onRail(i,s.width)); if(!t) await p.waitForTimeout(30); }
  await p.keyboard.press(t.ans==='more'?'ArrowDown':'ArrowUp'); await frozen(p); s=await st(p); let msg=await p.textContent('#calloutText');
  ok(s.bad===1 && s.meter===25 && new RegExp('which is '+t.ans.toUpperCase()+' than').test(msg),'a wrong call shows the real value and why: '+msg.slice(0,120));
  ok((await p.$$('#play .tk.bad')).length===1 && /=/.test(await p.textContent('#play .tk.bad .tk-ans')),'the ticket shows what the letter was: '+await p.textContent('#play .tk.bad .tk-ans')); await p.screenshot({path:OUT+'/3_wrong_call.png'});
  await p.keyboard.press('Enter');
  let away=0; for(let guard=0;guard<30;guard++){ await p.waitForFunction(()=>{ const W=window.__truck.W, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return W.frozen || !hid('hint') || !hid('fail'); },null,{timeout:60000});
    if(await p.isVisible('#hint')||await p.isVisible('#fail')) break; msg=await p.textContent('#calloutText'); if(/got away/.test(msg)) away++; await p.keyboard.press('Enter'); }
  ok(away>=1 && /That ticket got away\. \w = /.test(msg),'a ticket that rolls out uncalled is explained: '+msg.slice(0,90));
  ok(await p.isVisible('#hint') && /bigger or smaller/.test(await p.textContent('#hintText')),'the same mistake twice opens the hint card'); await p.screenshot({path:OUT+'/3b_hint.png'});

  console.log('\n[4] Which undo: the wrong tool, then the reciprocal');
  await open(p,{zone:1}); s=await st(p); ok(s.type==='tool' && s.zone===1 && s.tools.length===4,'started at zone 2: '+s.eq+'  tools: '+s.tools.map(x=>x.text).join('  '));
  let w=s.tools.findIndex(x=>x.key==='did_not_undo'); await p.keyboard.press(String(w+1)); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && /won't undo it/.test(msg),'doing the same thing again is explained: '+msg.slice(0,110));
  ok(/still not alone/.test(await p.textContent('#bLines')),'and the ticket shows the letter is still not alone: '+(await p.textContent('#bLines')).slice(0,70)); await p.screenshot({path:OUT+'/4_wrong_tool.png'});
  await p.keyboard.press('Enter'); ok(await p.isDisabled(`[data-tool="${w}"]`),'that tool is put away');
  const w2=s.tools.findIndex((x,i)=>!x.correct&&i!==w); await p.click(`[data-tool="${w2}"]`); await frozen(p);
  ok(/SEE THE UNDO/.test(await p.textContent('#resumeBtn')),'two misses: the game shows the undo'); await carryOn(p); await p.waitForTimeout(150);
  ok(/Check: .* ✓/.test(await p.textContent('#bLines')) && (await st(p)).bad===2,'the ticket unwinds with a check: '+(await p.textContent('#bLines')).slice(-40));
  await open(p,{zone:2}); let flip=null;
  for(let guard=0;guard<8&&!flip;guard++){ const now=await st(p); if(now.tools.filter(x=>x.correct).length===2) flip=now; else { await playRound(p,now); await nextRound(p,now); } }
  ok(!!flip && flip.style==='fraction','a fraction ticket offers two right tools: '+flip.eq+'  tools: '+flip.tools.map(x=>x.text).join('  '));
  await speed(p,1); await p.click(`[data-tool="${flip.tools.findIndex(x=>x.correct&&x.text.startsWith('×'))}"]`); await p.waitForTimeout(200); msg=await p.textContent('#bLines');
  ok(/= 1, so \w is alone|leaves \w alone/.test(msg) && (await st(p)).bad===0,'multiplying by the reciprocal shows why it works: '+msg.slice(0,90)); await p.screenshot({path:OUT+'/5_reciprocal.png'});

  console.log('\n[5] Ring it up: the register checks the answer');
  await open(p,{zone:3}); s=await st(p); ok(s.type==='ring' && await p.isVisible('#reg'),'started at zone 4: '+s.eq);
  await p.keyboard.press('Enter'); ok(/Punch in a number/.test(await p.textContent('#note')) && (await st(p)).bad===0,'an empty register only nudges');
  await typeAnswer(p,s.xPlus,'type'); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && /The register checked it: .*, not /.test(msg),'a wrong amount is run back through the ticket: '+msg.slice(0,110)); await p.screenshot({path:OUT+'/6_register_wrong.png'});
  await p.keyboard.press('Enter'); await typeAnswer(p,s.xFrac,'pad'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(/Check: .* ✓/.test(await p.textContent('#bLines')) && (await st(p)).bad===1,'an equal form is accepted ('+s.xFrac+' for '+s.x+')'); await nextRound(p,s);
  s=await st(p); await typeAnswer(p,s.xPlus,'type'); await p.keyboard.press('Enter'); await frozen(p); await carryOn(p);
  await typeAnswer(p,s.xPlus,'type'); await p.keyboard.press('Enter'); await frozen(p); if(await p.isVisible('#hint')) await p.keyboard.press('Enter'); msg=await p.textContent('#calloutText');
  ok(msg.includes('The answer: '+s.letter+' = '+s.x),'two misses show the answer: '+msg.slice(-40));

  console.log('\n[6] Lunch Rush: write the ticket, and the cook\'s slip');
  await open(p,{zone:4}); s=await st(p); ok(s.type==='build' && await p.isVisible('#bossBar') && s.story.length>30,'the customer\'s order: '+s.story.slice(0,80));
  await p.keyboard.press('Enter'); ok(/Fill every space/.test(await p.textContent('#note')) && (await st(p)).bad===0,'an unfinished ticket only nudges');
  const wrongOp=s.kind==='times'?'+':'×'; await build(p,s,[WAYS[s.kind][0],wrongOp,WAYS[s.kind][2],WAYS[s.kind][3]],'tap'); await p.keyboard.press('Enter'); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===1 && /it needs/.test(msg),'the wrong kind of operation is explained: '+msg.slice(0,100)); await p.screenshot({path:OUT+'/7_wrong_ticket.png'});
  await p.keyboard.press('Enter'); ok((await p.$$('#play .slot.full')).length===0,'TRY AGAIN clears the ticket');
  const other={ plus:['c','-','a','L'], minus:['c','+','a','L'], times:['c','÷','a','L'] }[s.kind];
  await build(p,s,other,'keys'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok(/matches the order/.test(await p.textContent('#bLines')) && (await st(p)).bad===1,'another true way of writing it is accepted ('+other.join(' ')+')'); await nextRound(p,s);
  let ringS=await st(p); ok(ringS.type==='ring' && ringS.story===s.story,'then that ticket is rung up, with the order still showing'); await playRound(p,ringS); await nextRound(p,ringS);
  s=await st(p); await playRound(p,s); await nextRound(p,s);
  s=await st(p); ok(s.type==='critique' && (await p.$$('.cook-line')).length===2,'the new cook\'s ticket'); await p.screenshot({path:OUT+'/7b_cook.png'});
  await p.click(`[data-line="${s.wrong===1?2:1}"]`); await frozen(p); msg=await p.textContent('#calloutText');
  ok((await st(p)).bad===2 && (await p.$$('.cook-line.wrong')).length===1 && /so \w = |= /.test(msg),'tapping the wrong line shows where the slip really was: '+msg.slice(0,110));

  console.log('\n[7] Practice mode');
  await open(p,{practice:true,fast:1}); ok(await p.isVisible('#practiceTag'),'PRACTICE tag shows');
  const xa=(await st(p)).items[0].x; await p.waitForTimeout(1000); const moved=xa-(await st(p)).items[0].x;
  ok(moved>35 && moved<80,'the rail runs slower in practice ('+Math.round(moved)+' px in a second)');
  await speed(p,5); t=null; for(let guard=0;guard<800&&!t;guard++){ s=await st(p); t=s.items.find(i=>onRail(i,s.width)); if(!t) await p.waitForTimeout(30); }
  await p.keyboard.press(t.ans==='more'?'ArrowDown':'ArrowUp'); await frozen(p); s=await st(p); ok(s.meter===0 && s.lives===3 && s.bad===1,'a mistake is explained but the line does not grow');

  console.log('\n[8] Truck closed, then a fast retry');
  await open(p); await p.evaluate(()=>{ const G=window.__truck.G; G.lives=1; G.meter=90; });
  t=null; for(let guard=0;guard<800&&!t;guard++){ s=await st(p); t=s.items.find(i=>onRail(i,s.width)); if(!t) await p.waitForTimeout(30); }
  await p.keyboard.press(t.ans==='more'?'ArrowDown':'ArrowUp'); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/TRUCK CLOSED/.test(await p.textContent('#fail')) && !(await p.isVisible('#callout')),'TRUCK CLOSED! appears'); await p.screenshot({path:OUT+'/9_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await ready(p);
  ok(Date.now()-t0<2000,'back in play in under 2 seconds ('+(Date.now()-t0)+' ms)');
  s=await st(p); ok(s.lives===3 && s.meter===0 && s.items.length>=6,'all 3 chances back and a fresh rail');

  console.log('\n[9] Help pauses the rail');
  await speed(p,1); await p.waitForTimeout(800); await p.keyboard.press('h'); const h1=(await st(p)).items.map(i=>i.x).join(); await p.waitForTimeout(500);
  ok(await p.isVisible('#briefing') && h1===(await st(p)).items.map(i=>i.x).join(),'H opens the help and the rail stops');
  await p.keyboard.press('h'); await p.waitForTimeout(400); ok(h1!==(await st(p)).items.map(i=>i.x).join(),'closing help starts it again');

  console.log('\n[10] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const f=host.frames().find(fr=>/food-truck/.test(fr.url()));
  await f.evaluate(()=>{ window.__truck.G.result={score:40,total:44,accuracy:91,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
