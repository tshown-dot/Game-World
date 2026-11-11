// Expression Town (Topic 3) on the shared town engine: sign-in from the Super Map, the map and its roads, a game,
// the victory screen, saving, an older save, offline play, the teacher code and the Boss Castle practice rule.
// The sheet is a stand-in: nothing is ever sent to the real sheet.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/expression_town'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const TOWN=BASE+'towns/topic-3-expression-town/index.html';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };

// ---- pretend sheet ----
const OLD_SAVE={v:1,level:4,xp:30,coins:300,towns:{topic_3:{
  unlockedNodes:['node_3_1','node_3_2','node_3_3','node_3_4','node_3_5'],                       // from when LCM was "3-4"
  nodeRecords:{node_3_1:{cleared:true,stars:3},node_3_2:{cleared:true,stars:2},node_3_4:{cleared:true,stars:2,bestScore:8,total:10}}}}};
const sheet={ students:{
  K7M2QX:{open:Array(8).fill(false),full:false,progress:null},
  RDSV34:{open:Array(8).fill(false),full:false,progress:JSON.stringify(OLD_SAVE)},
  TEACH2:{open:Array(8).fill(false),full:true,progress:null} }, posts:[], down:false };
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
const vis=(p,sel)=>p.evaluate((s)=>{ const e=document.querySelector(s); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0; },sel).catch(()=>false);
async function signIn(p,code){
  await p.goto(BASE+'index.html'); await p.evaluate(()=>localStorage.removeItem('gw_active_code'));     // signed out
  await p.goto(BASE+'index.html'); await p.waitForSelector('#codeInput',{state:'visible'});
  await p.fill('#codeInput',code); await p.click('#loginBtn'); await p.waitForSelector('#worldScreen:not(.hidden)',{timeout:8000});
  await p.goto(TOWN); await p.waitForTimeout(1800);
}
const finish=(p,payload)=>p.evaluate((pl)=>window.postMessage({type:'CARTRIDGE_COMPLETE',payload:pl},'*'),payload);
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',async r=>{ const q=r.request();
    if(sheet.down) return r.abort('internetdisconnected');
    if(q.method()==='GET'){ const s=sheet.students[new URL(q.url()).searchParams.get('code')]; return json(r,s?{ok:true,open:s.open,full_access:s.full,progress:s.progress}:{ok:false,error:'bad_code'}); }
    const bd=JSON.parse(q.postData()); sheet.posts.push(bd); const s=sheet.students[bd.student_code]; if(!s) return json(r,{ok:false,error:'bad_code'});
    if(bd.type==='save') s.progress=JSON.stringify(bd.progress); return json(r,{ok:true}); });
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errs.push(m.text()); });   // the offline step causes that one on purpose

  console.log('\n[1] Not signed in: the town sends you to the Super Map sign-in');
  await p.goto(TOWN); await p.waitForURL(ROOT_RE,{timeout:5000}); await p.waitForTimeout(400);
  ok(await vis(p,'#loginScreen'),'opening Expression Town without a code goes to the Super Map sign-in');
  ok(!/passcode|PLAYER PIN|7777|star6/i.test(await p.content()),'no PIN, passcode or test accounts on the page');

  console.log('\n[2] A new student: the map, the roads and 3-1');
  await signIn(p,'K7M2QX');
  ok((await p.textContent('#hudCode')).trim()==='K7M2QX','the town is signed in with the Super Map code');
  ok(await p.$$eval('.stage',s=>s.length)===9,'9 stops: 3-1, 3-2 GCF, 3-2 LCM, 3-3 to 3-7 and the Boss Castle');
  ok((await p.textContent('#panelName'))==='Power Plant' && !(await p.isDisabled('#enterBtn')),'the hero starts at Power Plant (3-1), open');
  ok(await p.$$eval('.stage-locked',s=>s.length)===8,'the other 8 wait their turn');
  ok(!(await vis(p,'#teacherBanner')),'a normal student sees no TEACHER banner');
  ok(await p.$$eval('#townMap path[stroke-linejoin="round"]',e=>e.length)>=8,'the roads are drawn');
  await p.screenshot({path:OUT+'/1_map.png'});
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500);
  ok((await p.textContent('#panelName'))==='Town Bank Vault' && await p.isDisabled('#enterBtn'),'walking right: Town Bank Vault (3-2) is locked for now');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1500);

  console.log('\n[3] Play 3-1 inside the town, win, save');
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok(await vis(p,'#briefModal') && /Exponents/.test(await p.textContent('#briefModal')),'the briefing card shows the lesson');
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  ok(p.frames().some(fr=>/cartridges\/exponents/.test(fr.url())),'the Power Plant game (unchanged) opens inside the town');
  await p.screenshot({path:OUT+'/2_game_in_town.png'});
  await finish(p,{score:9,total:10,bossDefeated:true,practiceMode:false}); await p.waitForTimeout(1500);
  ok(await vis(p,'#victoryModal') && /Now open: Town Bank Vault/.test(await p.textContent('#victoryOpen')),'victory screen: Town Bank Vault is now open');
  await p.screenshot({path:OUT+'/3_victory.png'});
  const saved=JSON.parse(sheet.students.K7M2QX.progress);
  ok(saved.towns.topic_3.nodeRecords.node_3_1.cleared===true,'progress saved to the sheet under Expression Town');
  const row=sheet.posts.filter(x=>x.type==='result').at(-1)||{};
  ok(row.student_code==='K7M2QX'&&row.town==='topic-3'&&row.lesson==='3-1'&&row.score===9&&row.accuracy===90,'a Results row: '+JSON.stringify(row));
  ok(!JSON.stringify(sheet.posts).match(/passcode|password|"pin"/i),'nothing like a pin or passcode was sent');
  await p.keyboard.press('Enter'); await p.waitForTimeout(2200);
  ok((await p.textContent('#panelName'))==='Town Bank Vault' && !(await p.isDisabled('#enterBtn')),'the hero walks to Town Bank Vault, now open');
  await p.click('#myStarsBtn'); await p.waitForTimeout(400);
  ok(/Best 9\/10/.test(await p.textContent('#progressList')) && /Saved\./.test(await p.textContent('#progressSync')),'My Progress: Best 9/10 and "Saved."');
  await p.screenshot({path:OUT+'/4_progress.png'}); await p.keyboard.press('Escape');

  console.log('\n[4] Offline: play on, it sends when the network is back');
  sheet.down=true; const savesBefore=sheet.posts.filter(x=>x.type==='save').length;
  await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  await finish(p,{score:7,total:10,practiceMode:false}); await p.waitForTimeout(1500);
  ok(await vis(p,'#victoryModal'),'a game can be finished while offline'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('#victoryBack').catch(()=>{}); await p.waitForTimeout(300);
  await p.click('#myStarsBtn'); await p.waitForTimeout(400);
  ok(/Saved on this Chromebook/.test(await p.textContent('#progressSync')),'My Progress says it is saved on the Chromebook, waiting to send');
  await p.keyboard.press('Escape');
  sheet.down=false; await p.evaluate(()=>window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2500);
  ok(sheet.posts.filter(x=>x.type==='save').length>savesBefore,'after the network returns the waiting save was sent');

  console.log('\n[5] An older save (LCM used to be "3-4") keeps everything it had');
  await signIn(p,'RDSV34');
  const states=await p.$$eval('.stage',s=>s.map(e=>[...e.classList].find(c=>/^stage-(open|locked|wip)$/.test(c))));
  ok(JSON.stringify(states.slice(0,6))===JSON.stringify(Array(6).fill('stage-open')),'3-1 to 3-5 are open, LCM included: '+states.join(','));
  ok(states[6]==='stage-locked' && states[8]==='stage-locked','nothing past what the student reached');
  await p.click('#myStarsBtn'); await p.waitForTimeout(400);
  ok(/Best 8\/10/.test(await p.textContent('#progressList')),'the old LCM score shows under the LCM stage');
  await p.keyboard.press('Escape');
  await p.screenshot({path:OUT+'/5_old_save.png'});

  console.log('\n[6] Teacher code, and the Boss Castle practice rule');
  await signIn(p,'TEACH2');
  ok(await vis(p,'#teacherBanner') && await p.$$eval('.stage-locked',s=>s.length)===0,'teacher code: TEACHER banner, every building open');
  ok(sheet.students.TEACH2.progress===null,'just signing in as a teacher writes nothing');
  for(let k=0;k<8;k++){ await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1300); }
  ok((await p.textContent('#panelName'))==='Boss Castle','the hero walks the whole road to the Boss Castle');
  await p.screenshot({path:OUT+'/6_boss_castle.png'});
  await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  await finish(p,{score:9,total:10,bossDefeated:true,practiceMode:true}); await p.waitForTimeout(1500);
  const t=JSON.parse(sheet.students.TEACH2.progress);
  ok(t.towns.topic_3.nodeRecords.node_apex.practiceOnly===true,'a practice clear of the Boss Castle is saved as practice only');

  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling (overflow px: '+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
