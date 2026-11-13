// Golem Fort (Topic 4 boss, the gauntlet): pick a weapon for each part, play a REAL weapon game (Gear Shift) through
// its own controls inside the fort, a weapon that breaks, putting a weapon down, hearts, practice, fail and retry,
// the report, town messages, no scroll, no errors.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/golem_fort'; require('fs').mkdirSync(OUT,{recursive:true});
const URL=BASE+'towns/topic-4-equation-valley/games/4-boss-golem-fort/index.html?test';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const st=(p)=>p.evaluate(()=>{ const f=window.__fort, W=f.W, G=f.G, vis=(id)=>!document.getElementById(id).classList.contains('hidden');
  return { zone:G.zone, lives:G.lives, good:G.good, bad:G.bad, score:G.score, practice:G.practice, phase:W.phase, part:W.part, broken:W.broken, used:[...W.used], weapon:W.weapon?W.weapon.lesson:null,
    cards:[...document.querySelectorAll('.wcard')].map(c=>c.querySelector('.wname').textContent), frame:!!document.getElementById('weaponFrame'), frameSrc:(document.getElementById('weaponFrame')||{}).src||'',
    strength:document.getElementById('strengthFill').style.width, brokenParts:document.querySelectorAll('#golemArt .broken').length, target:document.querySelectorAll('#golemArt .target').length,
    hint:vis('hint'), report:vis('report'), fail:vis('fail'), banner:vis('banner'), mistakes:{...G.mistakes}, result:G.result,
    sign:document.getElementById('signText').textContent, small:document.getElementById('signSmall').textContent, line:document.getElementById('fline').textContent }; });
async function choosing(p,part){ await p.waitForFunction((n)=>{ const f=window.__fort, hid=(id)=>document.getElementById(id).classList.contains('hidden'); return !hid('report') || (f.W.phase==='choose' && (n===null||f.W.part===n) && hid('banner')); },part??null,{timeout:30000}); }
/** The weapon game's own page, inside the fort. Waits until its shell is ready. */
async function weapon(p){ await p.waitForSelector('#weaponFrame',{timeout:10000}); const h=await p.$('#weaponFrame'); const f=await h.contentFrame();
  await f.waitForFunction(()=>window.__weapon && document.getElementById('briefing'),null,{timeout:20000}); return f; }
/** Open a weapon by its key or by tapping its card. */
let taps=0, keys=0;
async function pick(p,i){ if(keys<=taps){ keys++; await p.keyboard.press(String(i+1)); } else { taps++; await p.click(`[data-weapon="${i}"]`); } return weapon(p); }
/** End the weapon's zone the quick way (the same call the game makes when its zone is cleared, or its lives run out). */
async function finish(f,won,good=5,bad=0){ await f.click('#startBtn'); await f.waitForFunction(()=>window.__weapon.G.playing); await f.evaluate(([w,g,b])=>{ const W=window.__weapon; W.G.good=g; W.G.bad=b; W.finish(w); },[won,good,bad]); }
/** Really play Gear Shift's boss zone through its own controls (arrow keys and Enter). */
async function playGearShift(p,f){
  await f.click('#startBtn'); await f.evaluate(()=>{ window.__gears.W.speed=5; });
  const gs=()=>f.evaluate(()=>{ const W=window.__gears.W, r=W.round||{}; return { phase:W.phase, ri:W.ri, n:W.rounds.length, v:W.v, x:r.x, unknown:r.unknown, testsLeft:W.testsLeft, done:!!window.__gears.G.result, banner:!document.getElementById('banner').classList.contains('hidden') }; });
  const waitSet=()=>f.waitForFunction(()=>window.__gears.G.result || (window.__gears.W.phase==='set' && document.getElementById('banner').classList.contains('hidden')),null,{timeout:30000});
  let rounds=0;
  for(let g=0;g<12;g++){ await waitSet(); let s=await gs(); if(s.done) break;
    await f.evaluate(()=>{ window.__gears.W.speed=0; });
    if(s.testsLeft>0){ await f.evaluate(()=>{ window.__gears.W.speed=5; }); await p.keyboard.press('Enter'); await f.waitForFunction(()=>window.__gears.W.testsLeft===0 && window.__gears.W.phase==='set'); await f.evaluate(()=>{ window.__gears.W.speed=0; }); s=await gs(); }
    const d=s.x-s.v, key=d<0?'ArrowLeft':'ArrowRight', jump=s.unknown==='flag'?10:5, n=Math.abs(d);
    for(let i=0;i<Math.floor(n/jump);i++) await p.keyboard.press('Shift+'+key); for(let i=0;i<n%jump;i++) await p.keyboard.press(key);
    const ri=s.ri; await f.evaluate(()=>{ window.__gears.W.speed=5; }); await p.keyboard.press('Enter'); rounds++;
    await f.waitForFunction((r)=>window.__gears.G.result || window.__gears.W.ri!==r,ri,{timeout:30000}); }
  return rounds;
}
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function open(p,{zone=0,practice=false}={}){
  await p.goto(URL,{waitUntil:'load'});
  if(zone) await p.click(`[data-zone="${zone}"]`);
  if(practice) await p.click('#practiceBtn'); else await p.keyboard.press('Enter');
  await choosing(p,zone);
}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>json(r,{ok:true,open:Array(16).fill(false),full_access:false,progress:null}));
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Briefing');
  await p.goto(URL,{waitUntil:'load'}); await p.waitForTimeout(600);
  ok(await p.isVisible('#briefing'),'opens on the mission briefing'); await p.screenshot({path:OUT+'/1_briefing.png'});
  ok((await p.$$('.zone-btn')).length===5,'any of the 5 golem parts can be the start');
  ok(!(await p.$('.panel')) && !(await p.$('input')),'no question panel and nothing to type');

  console.log('\n[2] The whole gauntlet');
  await p.keyboard.press('Enter'); await choosing(p,0); let s=await st(p);
  ok(s.cards.join()==='Key Fitter,Counterweight' && s.strength==='100%' && s.target===1 && /THE FEET/.test(s.sign),'the feet glow, and two weapons are offered: '+s.cards.join(' or ')); await p.screenshot({path:OUT+'/2_choose.png'});
  let f=await pick(p,1); s=await st(p);
  ok(s.phase==='weapon' && /4-2-counterweight\/index\.html\?fort=4&test$/.test(s.frameSrc),'choosing a weapon opens that lesson\'s game in fort mode: '+s.frameSrc.split('/games/')[1]);
  ok(await f.isVisible('#briefing') && !(await f.isVisible('#zoneButtons')) && !(await f.isVisible('#practiceBtn')) && await f.isVisible('#startBtn'),'the weapon shows its own briefing, with no zone choice and no practice button'); await p.screenshot({path:OUT+'/2b_weapon_briefing.png'});
  await f.click('#startBtn'); await f.waitForFunction(()=>window.__weapon.G.playing && document.getElementById('banner').classList.contains('hidden'),null,{timeout:10000});
  const wz=await f.evaluate(()=>({ zone:window.__weapon.G.zone, name:document.getElementById('zoneName').textContent, boss:!document.getElementById('bossBar').classList.contains('hidden') }));
  ok(wz.zone===4 && wz.boss,'and starts straight in its boss zone: '+wz.name); await p.screenshot({path:OUT+'/2c_weapon.png'});
  await f.evaluate(()=>{ const W=window.__weapon; W.G.good=6; W.G.bad=1; W.finish(true); });
  ok(/WEAPON CHARGED/.test(await f.textContent('#banner')) && !(await f.isVisible('#report')),'clearing the zone shows WEAPON CHARGED, not the weapon\'s own report');
  await choosing(p,1); s=await st(p);
  ok(s.good===6 && s.bad===1 && s.score===60 && s.lives===3 && s.brokenParts===1 && s.strength==='80%' && !s.frame && s.used.join()==='4-2','back at the fort: the feet are broken, strength 80%, and the weapon\'s 6 right and 1 wrong are counted'); await p.screenshot({path:OUT+'/2d_feet_broken.png'});
  ok(s.cards.join()==='Undo Machine,Gear Shift' && /THE ARMS/.test(s.sign),'next the arms: '+s.cards.join(' or '));
  f=await pick(p,1); const gearRounds=await playGearShift(p,f); await choosing(p,2); s=await st(p);
  ok(gearRounds>=5 && s.brokenParts===2 && s.good>=11 && s.bad===1 && s.used.join()==='4-2,4-4','Gear Shift really played through its own controls ('+gearRounds+' rounds): the arms are broken, '+s.good+' right in all');
  ok(s.cards.join()==='Food Truck','the shoulders have one weapon');
  f=await pick(p,0); await finish(f,true,5,0); await choosing(p,3);
  f=await pick(p,0); ok(/4-6-ride-gate/.test((await st(p)).frameSrc),'the shield: Ride Gate'); await finish(f,true,6,2); await choosing(p,4); s=await st(p);
  ok(s.cards.length===3 && /THE CORE/.test(s.sign) && s.strength==='20%','the core has three weapons, and the golem is down to 20%'); await p.screenshot({path:OUT+'/2e_core.png'});
  f=await pick(p,2); ok(/4-10-trail-mapper/.test((await st(p)).frameSrc),'the core: Trail Mapper'); await finish(f,true,5,0);
  await p.waitForSelector('#report:not(.hidden)',{timeout:20000}); s=await st(p);
  ok(s.result && s.result.bossDefeated && !s.result.practiceMode && s.result.total===s.good+s.bad && s.result.total>=30 && s.bad===3 && s.strength==='0%' && s.brokenParts===5,'the golem falls: '+s.result.total+' decisions across five weapons, '+s.result.stars+' stars'); await p.screenshot({path:OUT+'/3_report.png'});
  ok(keys>=2&&taps>=2,`weapons chosen by key (${keys}) and by tapping (${taps})`);

  console.log('\n[3] A weapon that breaks');
  await open(p); f=await pick(p,0); await finish(f,false,2,5);
  ok(/WEAPON BROKEN/.test(await f.textContent('#banner')),'losing all three lives inside a weapon shows WEAPON BROKEN');
  await choosing(p,0); s=await st(p);
  ok(s.lives===2 && s.mistakes.weapon_lost===1 && s.good===2 && s.bad===6 && s.brokenParts===0 && s.strength==='100%' && /broke before/.test(s.line),'the golem takes a heart, the part stands, and the student chooses again: '+s.line); await p.screenshot({path:OUT+'/4_broken_weapon.png'});
  f=await pick(p,1); await finish(f,false,0,5); await p.waitForFunction(()=>!document.getElementById('hint').classList.contains('hidden'),null,{timeout:10000});
  ok(/different weapon/.test(await p.textContent('#hintText')) && (await st(p)).lives===1,'a second broken weapon opens the fort tip'); await p.keyboard.press('Enter'); await choosing(p,0);
  f=await pick(p,0); await finish(f,false,0,5); await p.waitForSelector('#fail:not(.hidden)',{timeout:20000});
  ok(/THE GOLEM STANDS/.test(await p.textContent('#fail')) && !(await st(p)).frame,'three broken weapons: THE GOLEM STANDS'); await p.screenshot({path:OUT+'/5_fail.png'});
  const t0=Date.now(); await p.keyboard.press('Enter'); await choosing(p,0);
  ok(Date.now()-t0<2000,'back at the weapon choice in under 2 seconds ('+(Date.now()-t0)+' ms)');
  ok((await st(p)).lives===3,'all 3 hearts back');

  console.log('\n[4] Putting a weapon down');
  const before=await st(p); f=await pick(p,0); await f.click('#startBtn'); await f.waitForFunction(()=>window.__weapon.G.playing && document.getElementById('banner').classList.contains('hidden'),null,{timeout:10000}); await f.click('#exitBtn'); await choosing(p,0); s=await st(p);
  ok(!s.frame && s.lives===3 && s.bad===before.bad && s.good===before.good && /Choose again/.test(s.line) && s.cards.length===2,'EXIT inside a weapon comes back to the fort and costs nothing');

  console.log('\n[5] Starting at a later part, and practice');
  await open(p,{zone:3,practice:true}); s=await st(p);
  ok(s.part===3 && s.brokenParts===3 && s.strength==='40%' && await p.isVisible('#practiceTag'),'started at the shield in practice: the earlier parts are already down');
  f=await pick(p,1); ok(/4-7-force-field\/index\.html\?fort=4&practice=1&test$/.test((await st(p)).frameSrc),'practice is passed on to the weapon');
  await f.click('#startBtn'); await f.waitForFunction(()=>window.__weapon.G.playing); ok(await f.evaluate(()=>window.__weapon.G.practice===true) && await f.isVisible('#practiceTag'),'and the weapon runs in practice mode');
  await f.evaluate(()=>window.__weapon.finish(false)); await choosing(p,3); ok((await st(p)).lives===3,'a broken weapon costs no heart in practice');
  f=await pick(p,0); await finish(f,true,4,0); await choosing(p,4); f=await pick(p,0); await finish(f,true,4,0); await p.waitForSelector('#report:not(.hidden)',{timeout:20000});
  ok((await st(p)).result.practiceMode===true,'the fort\'s result is marked as practice (so it does not defeat the boss)');

  console.log('\n[6] Inside the town');
  const host=await ctx.newPage(); await host.goto(BASE+'index.html');
  await host.setContent(`<iframe src="${URL}" style="width:1366px;height:768px;border:0"></iframe><script>window.msgs=[];addEventListener('message',e=>msgs.push(e.data));</script>`);
  await host.waitForTimeout(1500); ok((await host.evaluate(()=>window.msgs.map(m=>m.type))).includes('CARTRIDGE_READY'),'says READY to the town');
  const fr=host.frames().find(x=>/golem-fort/.test(x.url()));
  await fr.click('#startBtn'); await fr.waitForFunction(()=>window.__fort.W.phase==='choose' && document.getElementById('banner').classList.contains('hidden'));
  await fr.click('[data-weapon="0"]'); await fr.waitForSelector('#weaponFrame'); const inner=await (await fr.$('#weaponFrame')).contentFrame(); await inner.waitForFunction(()=>window.__weapon);
  await inner.click('#startBtn'); await inner.waitForFunction(()=>window.__weapon.G.playing); await inner.evaluate(()=>window.__weapon.finish(true));
  await fr.waitForFunction(()=>window.__fort.W.part===1 && window.__fort.W.phase==='choose',null,{timeout:20000});
  const types=await host.evaluate(()=>window.msgs.map(m=>m.type));
  ok(!types.includes('FORT_WEAPON_DONE') && !types.includes('CARTRIDGE_COMPLETE') && types.filter(x=>x==='CARTRIDGE_READY').length===1,'a weapon\'s messages stop at the fort: the town hears nothing until the fort is done ('+types.join(', ')+')');
  await fr.evaluate(()=>{ window.__fort.G.result={score:27,total:30,accuracy:90,stars:3,bossDefeated:true,practiceMode:false}; document.getElementById('townBtn').click(); });
  await host.waitForTimeout(300); const done=await host.evaluate(()=>window.msgs.find(m=>m.type==='CARTRIDGE_COMPLETE'));
  ok(done && done.payload.bossDefeated===true,'BACK TO TOWN sends the fort\'s result');
  const over=await p.evaluate(()=>Math.max(document.documentElement.scrollHeight-window.innerHeight,document.documentElement.scrollWidth-window.innerWidth));
  ok(over<=0,'no scrolling at 1366x768 ('+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
