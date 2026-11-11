// Station Mode: no sign-in, everything open, nothing saved to the sheet (shared/station.js).
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/stations'; require('fs').mkdirSync(OUT,{recursive:true});
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const sheetCalls=[];
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
const vis=(p,sel)=>p.evaluate((s)=>{ const e=document.querySelector(s); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0; },sel).catch(()=>false);
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1366,height:768}, permissions:['clipboard-read','clipboard-write']});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',r=>{ sheetCalls.push(r.request().method()+' '+r.request().url()); return json(r,{ok:true,open:Array(8).fill(false),full_access:false,progress:null}); });
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));

  console.log('\n[1] The teacher page');
  await p.goto(BASE+'stations.html'); await p.waitForSelector('[data-copy]');
  const links=await p.$$eval('input[id^="u"]',els=>els.map(e=>e.value));
  ok(links.length===3,'one link for the whole world and one per built town ('+links.length+')');
  ok(links[0].endsWith('index.html?station') && links.some(l=>/topic-3-expression-town\/index\.html\?station$/.test(l)) && links.some(l=>/topic-4-equation-valley\/index\.html\?station$/.test(l)),'the links are right');
  await p.click('[data-copy="1"]'); await p.waitForTimeout(200);
  ok(/COPIED/.test(await p.textContent('[data-copy="1"]')) && (await p.evaluate(()=>navigator.clipboard.readText()))===links[1],'COPY puts the link on the clipboard');
  await p.screenshot({path:OUT+'/1_teacher_page.png'});

  console.log('\n[2] Whole-world station: no sign-in, every town open');
  await p.goto(links[0]); await p.waitForTimeout(800);
  ok(await vis(p,'#worldScreen') && !(await vis(p,'#loginScreen')),'the Super Map opens with no sign-in');
  ok(/STATION: ALL OPEN/.test(await p.textContent('#teacherBanner')) && await vis(p,'#teacherBanner'),'the STATION banner shows');
  ok((await p.textContent('#hudCode')).trim()==='STATION','no student code is used');
  ok(!(await p.isDisabled('#enterBtn')),'the town under the hero is open');
  await p.screenshot({path:OUT+'/2_world_station.png'});
  await p.goto(BASE+'towns/topic-4-equation-valley/index.html'); await p.waitForTimeout(1500);
  ok(!(await vis(p,'#loginScreen')) && await vis(p,'#worldMapBtn'),'walking into Equation Valley: still no sign-in, and the world map sign is there');
  ok((await p.$$eval('.stage-locked',s=>s.length))===0 && (await p.$$eval('.stage',s=>s.length))>0,'every built building is open');
  ok(/STATION/.test(await p.textContent('#teacherBanner')),'STATION banner in the town');
  await p.screenshot({path:OUT+'/3_valley_in_station.png'});

  console.log('\n[3] Playing a game at a station saves nothing to the sheet');
  await p.keyboard.press('Enter'); await p.waitForTimeout(500); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  const f=p.frames().find(fr=>/games\//.test(fr.url()));
  ok(Boolean(f),'a building opens its game');
  if(f){ await f.evaluate(()=>window.parent.postMessage({type:'CARTRIDGE_COMPLETE',payload:{score:5,total:6,accuracy:83,stars:2,bossDefeated:false,practiceMode:false}},'*')); await p.waitForTimeout(1500); }
  const store=await p.evaluate(()=>({ session: sessionStorage.getItem('gw_station_progress'), local: Object.keys(localStorage).filter(k=>/STATION/.test(k)) }));
  ok(store.session && /topic_4/.test(store.session),'the stars are kept in this tab');
  ok(store.local.length===0,'nothing is kept on the Chromebook after the tab closes');
  ok(sheetCalls.length===0,'not one request to the Google Sheet ('+sheetCalls.length+')');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  console.log('\n[4] Town-only station (Expression Town): stays in the town');
  const p2=await ctx.newPage(); p2.on('pageerror',e=>errs.push(e.message));
  await p2.goto(links.find(l=>/topic-3/.test(l))); await p2.waitForTimeout(2500);
  ok(!(await vis(p2,'#loginScreen')) && await vis(p2,'#townMap'),'Expression Town opens with no sign-in');
  ok(!(await vis(p2,'#worldMapBtn')),'the world map sign is hidden');
  ok(/STATION/.test(await p2.textContent('#teacherBanner')) && await vis(p2,'#teacherBanner'),'the STATION banner shows');
  await p2.screenshot({path:OUT+'/4_expression_town_station.png'});
  await p2.click('#exitBtn'); await p2.waitForTimeout(2500);
  ok(/topic-3-expression-town/.test(p2.url()) && !(await vis(p2,'#loginScreen')),'EXIT starts the town again, still no sign-in');
  await p2.goto(BASE+'index.html'); await p2.waitForTimeout(2000);
  ok(/topic-3-expression-town/.test(p2.url()),'trying the Super Map in this tab goes back to the town');
  ok(sheetCalls.length===0,'still no requests to the sheet');

  console.log('\n[5] Town-only station (Equation Valley)');
  const p3=await ctx.newPage(); p3.on('pageerror',e=>errs.push(e.message));
  await p3.goto(links.find(l=>/topic-4/.test(l))); await p3.waitForTimeout(1500);
  ok(!(await vis(p3,'#worldMapBtn')) && (await p3.$$eval('.stage-locked',s=>s.length))===0,'no world map sign, every building open');
  await p3.click('#exitBtn'); await p3.waitForTimeout(1500);
  ok(/topic-4-equation-valley/.test(p3.url()),'EXIT stays in Equation Valley');

  console.log('\n[6] Back to normal');
  await p3.goto(BASE+'index.html?station=off'); await p3.waitForTimeout(800);
  ok(await vis(p3,'#loginScreen'),'?station=off brings back normal sign-in in that tab');
  const p4=await ctx.newPage(); await p4.goto(BASE+'index.html'); await p4.waitForTimeout(800);
  ok(await vis(p4,'#loginScreen'),'a new tab without ?station signs in normally');
  await p4.fill('#codeInput','STATION'); await p4.click('#loginBtn'); await p4.waitForTimeout(800);
  ok(await vis(p4,'#loginScreen') && await vis(p4,'#loginError'),'typing STATION as a code does nothing outside a station');

  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
