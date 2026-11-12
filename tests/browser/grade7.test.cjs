// The Grade 7 Isles: hidden from regular students, opened by a teacher tick, reached by the sail sign.
// The sheet is a stand-in: nothing is ever sent to the real sheet.
const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/grade7'; require('fs').mkdirSync(OUT,{recursive:true});
const FALLS=BASE+'towns/g7-topic-4-factor-falls/index.html';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const g7=(n)=>{ const o=Array(16).fill(false); o[8+n-1]=true; return o; };
const sheet={ students:{
  K7M2QX:{open:Array(16).fill(false),full:false,progress:null},                 // a regular 6th grader
  ACCE27:{open:g7(4),full:false,progress:null},                                  // accelerated: teacher ticked g7_town_4
  ACCE28:{open:g7(4),full:false,progress:null},                                  // ticked too, but never plays
  RDSV34:{open:Array(8).fill(false),full:false,progress:null},                   // the sheet script before its update: 8 flags
  TEACH2:{open:Array(16).fill(false),full:true,progress:null} }, posts:[] };
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
const vis=(p,sel)=>p.evaluate((s)=>{ const e=document.querySelector(s); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display!=='none' && e.getBoundingClientRect().width>0; },sel).catch(()=>false);
async function signIn(p,code){
  await p.goto(BASE+'index.html'); await p.evaluate(()=>{ localStorage.removeItem('gw_active_code'); localStorage.removeItem('gw_map_grade'); });
  await p.goto(BASE+'index.html'); await p.waitForSelector('#codeInput',{state:'visible'});
  await p.fill('#codeInput',code); await p.click('#loginBtn'); await p.waitForSelector('#worldScreen:not(.hidden)',{timeout:8000}); await p.waitForTimeout(500);
}
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',async r=>{ const q=r.request();
    if(q.method()==='GET'){ const s=sheet.students[new URL(q.url()).searchParams.get('code')]; return json(r,s?{ok:true,open:s.open,full_access:s.full,progress:s.progress}:{ok:false,error:'bad_code'}); }
    const bd=JSON.parse(q.postData()); sheet.posts.push(bd); const s=sheet.students[bd.student_code]; if(s&&bd.type==='save') s.progress=JSON.stringify(bd.progress); return json(r,{ok:true}); });
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] A regular 6th grader never sees Grade 7');
  await signIn(p,'K7M2QX');
  ok(!(await vis(p,'#sailBtn')),'no sail sign on the Super Map');
  ok((await p.textContent('#signTop'))==='6TH GRADE MATH' && (await p.textContent('#panelName'))==='Expression Town','the Grade 6 map, as before');
  await p.keyboard.press('g'); await p.waitForTimeout(300);
  ok((await p.textContent('#signTop'))==='6TH GRADE MATH','the G key does nothing for them');
  await p.click('#myStarsBtn'); await p.waitForTimeout(300);
  ok(await p.$$eval('.progress-row',r=>r.length)===8 && !/GRADE 7/.test(await p.textContent('#progressList')),'My Progress lists only the 8 Grade 6 towns');
  await p.keyboard.press('Escape');
  await p.goto(FALLS); await p.waitForTimeout(1800);
  ok(await vis(p,'#lockedModal') && /Ask your teacher/.test(await p.textContent('#lockedModal')),'opening the Factor Falls link directly shows "Ask your teacher to open this town"');
  await p.screenshot({path:OUT+'/1_locked.png'});

  console.log('\n[2] The sheet script before its update (8 flags): Grade 7 simply stays closed');
  await signIn(p,'RDSV34');
  ok(!(await vis(p,'#sailBtn')) && (await p.textContent('#panelName'))==='Expression Town','no sail sign, Grade 6 works as before');

  console.log('\n[3] An accelerated student (teacher ticked g7_town_4)');
  await signIn(p,'ACCE27');
  ok(await vis(p,'#sailBtn') && /GRADE 7 ISLES/.test(await p.textContent('#sailBtn')),'the sail sign shows: SAIL TO THE GRADE 7 ISLES');
  ok((await p.textContent('#panelName'))==='Expression Town','they still start on the Grade 6 map');
  await p.screenshot({path:OUT+'/2_sail_sign.png'});
  await p.click('#sailBtn'); await p.waitForTimeout(700);
  ok((await p.textContent('#signTop'))==='7TH GRADE MATH' && /GRADE 6/.test(await p.textContent('#sailBtn')),'sailing switches to the Grade 7 map; the sign now sails back');
  ok((await p.textContent('#panelName'))==='Factor Falls' && !(await p.isDisabled('#enterBtn')),'the hero stands at Factor Falls, open');
  ok(await p.$$eval('#mapSvg .region-soon',r=>r.length)===7,'the other 7 Grade 7 towns are coming soon');
  await p.screenshot({path:OUT+'/3_grade7_isles.png'});
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500);
  ok(/Grade 7 Town 5/.test(await p.textContent('#panelName')) && await p.isDisabled('#enterBtn'),'walking works on the Grade 7 map; Town 5 cannot be entered');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1500);
  await p.click('#myStarsBtn'); await p.waitForTimeout(300);
  ok(await p.$$eval('.progress-row',r=>r.length)===16 && /GRADE 7 ISLES/.test(await p.textContent('#progressList')),'My Progress lists Grade 6 and the Grade 7 Isles');
  await p.keyboard.press('Escape');

  console.log('\n[4] Into Factor Falls and back');
  await p.keyboard.press('Enter'); await p.waitForURL(/g7-topic-4-factor-falls/,{timeout:5000}); await p.waitForTimeout(1800);
  ok((await p.textContent('#hudCode')).trim()==='ACCE27' && !(await vis(p,'#lockedModal')),'Factor Falls opens, signed in with the same code');
  ok(/GRADE 7 · TOWN 4/.test(await p.textContent('#worldMapBtn')),'the town sign says GRADE 7 · TOWN 4');
  ok(await p.$$eval('.stage',s=>s.length)===9 && await p.$$eval('.stage-wip',s=>s.length)===8,'9 stops (lessons 4-1 to 4-8 and the boss); 8 are still under construction');
  ok((await p.textContent('#panelName'))==='Ranger Station' && !(await p.isDisabled('#enterBtn')),'Ranger Station (4-1) is open');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  ok(p.frames().some(fr=>/4-1-ranger-station/.test(fr.url())),'the Ranger Station game opens inside the town');
  await p.evaluate(()=>window.postMessage({type:'CARTRIDGE_COMPLETE',payload:{score:22,total:25,stars:2,bossDefeated:true,practiceMode:false}},'*')); await p.waitForTimeout(1500);
  const g7row=sheet.posts.filter(x=>x.type==='result').at(-1)||{};
  ok(g7row.town==='g7-topic-4' && g7row.lesson==='4-1' && g7row.score===22,'the Results row says town g7-topic-4, lesson 4-1: '+JSON.stringify(g7row));
  ok(JSON.parse(sheet.students.ACCE27.progress).towns.g7_topic_4.nodeRecords.node_g7_4_1.cleared===true,'progress is saved under g7_topic_4');
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  await p.screenshot({path:OUT+'/4_factor_falls.png'});
  await p.click('#worldMapBtn'); await p.waitForURL(/index\.html\?from=g7_topic_4/,{timeout:5000}); await p.waitForTimeout(1200);
  ok((await p.textContent('#signTop'))==='7TH GRADE MATH' && (await p.textContent('#panelName'))==='Factor Falls','the world map sign returns to the Grade 7 map, outside Factor Falls');
  await p.keyboard.press('g'); await p.waitForTimeout(600);
  ok((await p.textContent('#signTop'))==='6TH GRADE MATH' && (await p.textContent('#panelName'))==='Expression Town','G (or the sail sign) sails back to Grade 6');
  await p.reload(); await p.waitForSelector('#worldScreen:not(.hidden)'); await p.waitForTimeout(600);
  ok((await p.textContent('#signTop'))==='6TH GRADE MATH','the Chromebook remembers which map the student was on');

  console.log('\n[5] The teacher un-ticks the box');
  sheet.students.ACCE27.open=Array(16).fill(false);
  await p.reload(); await p.waitForSelector('#worldScreen:not(.hidden)'); await p.waitForTimeout(2500);
  ok(await vis(p,'#sailBtn'),'a student who already PLAYED Factor Falls keeps it (a town already played never locks again)');
  await signIn(p,'ACCE28'); await p.click('#sailBtn'); await p.waitForTimeout(600);
  ok((await p.textContent('#signTop'))==='7TH GRADE MATH','a second ticked student sails to Grade 7');
  sheet.students.ACCE28.open=Array(16).fill(false);
  await p.reload(); await p.waitForSelector('#worldScreen:not(.hidden)'); await p.waitForTimeout(2500);
  ok((await p.textContent('#signTop'))==='6TH GRADE MATH' && !(await vis(p,'#sailBtn')),'un-ticked before playing: the map goes back to Grade 6 and the sail sign is gone');

  console.log('\n[6] A teacher (full access) code can preview Grade 7');
  await signIn(p,'TEACH2');
  ok(await vis(p,'#sailBtn') && await vis(p,'#teacherBanner'),'teacher code: TEACHER banner and the sail sign');
  await p.click('#sailBtn'); await p.waitForTimeout(700);
  ok((await p.textContent('#panelName'))==='Factor Falls' && !(await p.isDisabled('#enterBtn')),'Factor Falls is open for the teacher');

  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling (overflow px: '+over+')');
  console.log('\n[7] Stations');
  await p.goto(BASE+'stations.html'); await p.waitForSelector('[data-copy]');
  ok((await p.content()).includes('g7-topic-4-factor-falls/index.html?station') && /GRADE 7 TOWN 4: FACTOR FALLS/.test(await p.textContent('#links')),'the stations page lists Factor Falls as a Grade 7 town');

  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  ok(sheet.posts.every(x=>x.student_code==='ACCE27'),'only the student who played wrote to the (stand-in) sheet');
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,6).join(' | '));process.exit(2);});
