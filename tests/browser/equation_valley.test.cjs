const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/equation_valley'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const ROOT=BASE+''; const TOWN=ROOT+'towns/topic-4-equation-valley/index.html';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const sheet={ students:{
  K7M2QX:{open:[false,false,false,true,false,false,false,false],full:false,progress:JSON.stringify({v:1,level:2,xp:10,coins:120,towns:{topic_3:{nodeRecords:{node_3_1:{cleared:true,stars:3}},unlockedNodes:['node_3_1','node_3_2']}}})},
  LKCKD2:{open:Array(8).fill(false),full:false,progress:null},
  TEACH2:{open:Array(8).fill(false),full:true,progress:null} }, posts:[] };
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',async r=>{ const q=r.request();
    if(q.method()==='GET'){ const s=sheet.students[new URL(q.url()).searchParams.get('code')]; return json(r,s?{ok:true,open:s.open,full_access:s.full,progress:s.progress}:{ok:false,error:'bad_code'}); }
    const bd=JSON.parse(q.postData()); sheet.posts.push(bd); const s=sheet.students[bd.student_code]; if(!s) return json(r,{ok:false,error:'bad_code'});
    if(bd.type==='save') s.progress=JSON.stringify(bd.progress); return json(r,{ok:true}); });
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });

  console.log('\n[1] Not signed in: the town sends you to the Super Map');
  await p.goto(TOWN); await p.waitForURL(ROOT_RE,{timeout:5000});
  ok(await p.isVisible('#loginScreen'),'opening Equation Valley without a code goes to the Super Map sign-in');

  console.log('\n[2] Super Map: Equation Valley opens with a teacher tick, then enter it');
  await p.fill('#codeInput','K7M2QX'); await p.click('#loginBtn'); await p.waitForTimeout(1500);
  ok((await p.textContent('#panelName'))==='Equation Valley' && !(await p.isDisabled('#enterBtn')),'the hero starts at Equation Valley, the furthest open town (teacher ticked town_4)');
  await p.screenshot({path:OUT+'/1_supermap_town4.png'});
  await p.keyboard.press('Enter'); await p.waitForURL(/topic-4-equation-valley/,{timeout:5000}); await p.waitForTimeout(1800);
  ok((await p.textContent('#hudCode')).trim()==='K7M2QX','the town is already signed in with the same code');
  ok((await p.textContent('#panelName'))==='Key Fitter','the hero starts at Key Fitter (4-1, the first building)');
  ok(await p.$$eval('.stage',s=>s.length)===11,'11 stops: lessons 4-1 to 4-10 and the boss');
  ok(await p.$$eval('.stage-wip',s=>s.length)===8,'8 are under construction');
  ok(await p.$$eval('.stage-locked',s=>s.length)===2,'Counterweight and Undo Machine wait their turn');
  await p.screenshot({path:OUT+'/2_valley.png'});

  console.log('\n[3] Walking and closed buildings');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1200);
  ok((await p.textContent('#panelName'))==='Counterweight' && await p.isDisabled('#enterBtn'),'Counterweight (4-2) is locked for now');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Locked/i.test(await p.textContent('#toast')),'pressing Enter there says to clear the building before it');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1200);
  ok((await p.textContent('#panelName'))==='Undo Machine' && await p.isDisabled('#enterBtn'),'Undo Machine (4-3) is built but locked for now');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1200);
  ok((await p.textContent('#panelName'))==='Gear Shift' && await p.isDisabled('#enterBtn'),'next stop (4-4) is under construction and cannot be entered');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/under construction/i.test(await p.textContent('#toast')),'pressing Enter there says it is under construction');
  for(let k=0;k<3;k++){ await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1200); }

  console.log('\n[4] Play Counterweight from the town');
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok(await p.isVisible('#briefModal') && /Understand Equations and Solutions/.test(await p.textContent('#briefModal')),'the briefing card shows the lesson');
  await p.screenshot({path:OUT+'/3_brief.png'});
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  const f=p.frames().find(fr=>/4-1-key-fitter/.test(fr.url()));
  ok(!!f && await f.isVisible('#briefing'),'the Key Fitter game opens inside the town');
  await p.screenshot({path:OUT+'/4_game_in_town.png'});
  await p.click('#harnessRetreatBtn'); await p.waitForTimeout(600);
  ok(await p.isHidden('#cartridgeHarnessModal'),'the town\'s BACK TO MAP bar closes the game');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('Enter'); await p.waitForTimeout(2000);
  const f2=p.frames().find(fr=>/4-1-key-fitter/.test(fr.url()));
  await f2.evaluate(()=>document.getElementById('exitBtn').click()); await p.waitForTimeout(600);
  ok(await p.isHidden('#cartridgeHarnessModal'),'the game\'s own EXIT also returns to the town map');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('Enter'); await p.waitForTimeout(2000);
  await p.evaluate(()=>window.postMessage({type:'CARTRIDGE_COMPLETE',payload:{score:17,total:20,accuracy:85,stars:2,bossDefeated:true,practiceMode:false}},'*'));
  await p.waitForTimeout(1500);
  ok(await p.isVisible('#victoryModal'),'finishing the game shows the victory screen');
  ok(/★★☆/.test(await p.textContent('#victoryStars')),'with the stars the game reported');
  ok(/Now open: Counterweight/.test(await p.textContent('#victoryOpen')),'the victory screen says Counterweight is now open');
  await p.screenshot({path:OUT+'/5_victory.png'});
  const saved=JSON.parse(sheet.students.K7M2QX.progress);
  ok(saved.towns.topic_4.nodeRecords.node_4_1.cleared===true,'progress saved to the sheet under Equation Valley');
  ok(saved.towns.topic_3.nodeRecords.node_3_1.stars===3,'Expression Town progress is untouched');
  const row=sheet.posts.filter(x=>x.type==='result').at(-1)||{};
  ok(row.town==='topic-4'&&row.lesson==='4-1'&&row.score===17&&row.problems_attempted===20&&row.accuracy===85&&row.boss_defeated===true,'a Results row: '+JSON.stringify(row));
  await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  ok((await p.textContent('#panelName'))==='Counterweight' && !(await p.isDisabled('#enterBtn')),'the hero walks to Counterweight, which is now open');
  await p.click('#myStarsBtn'); await p.waitForTimeout(400);
  ok(/Best 17\/20/.test(await p.textContent('#progressList')),'My Progress shows the new best score');
  await p.screenshot({path:OUT+'/6_progress.png'}); await p.keyboard.press('Escape');

  console.log('\n[5] Back to the Super Map, then a locked student');
  await p.click('#worldMapBtn'); await p.waitForURL(/index\.html\?from=topic_4/,{timeout:5000}); await p.waitForTimeout(1500);
  ok((await p.textContent('#panelName'))==='Equation Valley','back on the Super Map, standing outside Equation Valley');
  await p.click('#exitBtn'); await p.fill('#codeInput','LKCKD2'); await p.click('#loginBtn'); await p.waitForTimeout(1500);
  await p.goto(TOWN); await p.waitForTimeout(1800);
  ok(await p.isVisible('#lockedModal') && /Expression Town boss/.test(await p.textContent('#lockedModal')),'a student who has not beaten Expression Town sees a locked screen if they open the link directly');
  await p.screenshot({path:OUT+'/7_locked.png'});

  console.log('\n[6] Teacher code');
  await p.goto(ROOT); await p.waitForTimeout(800); await p.click('#exitBtn'); await p.fill('#codeInput','TEACH2'); await p.click('#loginBtn'); await p.waitForTimeout(1200);
  await p.goto(TOWN); await p.waitForTimeout(1800);
  ok(await p.isVisible('#teacherBanner') && await p.isHidden('#lockedModal'),'teacher code: TEACHER banner, town open');
  ok(await p.$$eval('.stage-wip',s=>s.length)===8,'teacher still cannot enter unbuilt buildings');
  ok(await p.$$eval('.stage-locked',s=>s.length)===0,'teacher can enter all three built buildings');

  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling (overflow px: '+over+')');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n')[0]);process.exit(2);});
