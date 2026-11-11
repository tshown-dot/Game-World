const { chromium } = require('playwright'); const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/super_map'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const ROOT=BASE+'';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const sheet={ students:{ K7M2QX:{open:Array(8).fill(false),full:false,progress:null}, TEACH2:{open:Array(8).fill(false),full:true,progress:null} }, posts:[] };
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',async r=>{ const q=r.request();
    if(q.method()==='GET'){ const s=sheet.students[new URL(q.url()).searchParams.get('code')]; return json(r,s?{ok:true,open:s.open,full_access:s.full,progress:s.progress}:{ok:false,error:'bad_code'}); }
    const bd=JSON.parse(q.postData()); sheet.posts.push(bd); const s=sheet.students[bd.student_code]; if(!s) return json(r,{ok:false,error:'bad_code'});
    if(bd.type==='save') s.progress=JSON.stringify(bd.progress); return json(r,{ok:true}); });
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error' && !/fonts|tailwind/.test(m.text())) errs.push('console: '+m.text()); });

  console.log('\n[1] Super Map sign-in');
  await p.goto(ROOT,{waitUntil:'load'}); await p.waitForTimeout(1500);
  await p.screenshot({path:OUT+'/1_signin.png'});
  ok(await p.isVisible('#loginScreen'),'sign-in screen shows first');
  await p.fill('#codeInput','AAAAAA'); await p.click('#loginBtn'); await p.waitForTimeout(700);
  ok(/isn't in the system/.test(await p.textContent('#loginError')),'unknown code is refused with a friendly message');
  await p.fill('#codeInput','k7m2qx'); await p.click('#loginBtn'); await p.waitForTimeout(1500);
  ok(await p.isVisible('#worldScreen'),'valid code reaches the Super Map');
  ok(!(await p.isVisible('#teacherBanner')),'normal student: no teacher banner');
  ok((await p.textContent('#panelName'))==='Expression Town','hero starts at Expression Town');
  ok(!(await p.isDisabled('#enterBtn')),'Expression Town can be entered');
  await p.screenshot({path:OUT+'/2_map.png'});

  console.log('\n[2] Walking and closed towns');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1600);
  ok((await p.textContent('#panelName'))==='Equation Valley','arrow key walks to Town 4 (Equation Valley)');
  ok(await p.isDisabled('#enterBtn'),'Town 4 is locked for a new student');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Expression Town boss/i.test(await p.textContent('#toast')),'pressing Enter there says to beat the Expression Town boss');
  await p.screenshot({path:OUT+'/3_town4.png'});
  await p.click('#prevBtn'); await p.waitForTimeout(1600);
  ok((await p.textContent('#panelName'))==='Expression Town','the ◀ button walks back');

  console.log('\n[3] My Stars on the Super Map');
  await p.click('#myStarsBtn'); await p.waitForTimeout(500);
  const rows=await p.$$eval('#progressList .progress-row',r=>r.length);
  ok(rows===8,'My Progress lists all 8 towns');
  await p.screenshot({path:OUT+'/4_progress.png'});
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  console.log('\n[4] Into the town and back');
  await p.keyboard.press('Enter'); await p.waitForURL(/topic-3-expression-town/,{timeout:5000}); await p.waitForTimeout(2500);
  ok(await p.isVisible('#worldScreen') && !(await p.isVisible('#loginScreen')),'Expression Town opens already signed in (no second code entry)');
  ok((await p.textContent('#hudPlayerCode')).trim()==='K7M2QX','the town shows the same code');
  ok(/world map/.test(await p.textContent('#worldSelectBtn')),'the town sign now says "world map"');
  await p.screenshot({path:OUT+'/5_in_town.png'});
  await p.click('#worldSelectBtn'); await p.waitForURL(/index\.html\?from=topic_3/,{timeout:5000}); await p.waitForTimeout(1500);
  ok(await p.isVisible('#worldScreen'),'the sign leads back to the Super Map, still signed in');
  ok((await p.textContent('#panelName'))==='Expression Town','the hero stands outside Expression Town');

  console.log('\n[5] Sign out and teacher code');
  await p.click('#exitBtn'); await p.waitForTimeout(500);
  ok(await p.isVisible('#loginScreen'),'EXIT returns to the sign-in screen');
  ok((await p.evaluate(()=>localStorage.getItem('gw_active_code')))===null,'the code is forgotten on this device');
  await p.fill('#codeInput','TEACH2'); await p.click('#loginBtn'); await p.waitForTimeout(1500);
  ok(await p.isVisible('#teacherBanner'),'teacher code shows the TEACHER banner');
  await p.keyboard.press('Enter'); await p.waitForURL(/topic-3-expression-town/,{timeout:5000}); await p.waitForTimeout(2500);
  await p.click('#switchUserBtn'); await p.waitForURL(ROOT_RE,{timeout:5000}); await p.waitForTimeout(1000);
  ok(await p.isVisible('#loginScreen'),'EXIT inside the town signs out to the Super Map sign-in');

  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling (overflow px: '+over+')');
  const real=errs.filter(e=>!/tailwind is not defined/.test(e));
  ok(real.length===0,'no page errors'+(real.length?': '+real.join(' | '):''));
  ok(!sheet.posts.length,'browsing the map wrote nothing to the sheet');
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e);process.exit(2);});
