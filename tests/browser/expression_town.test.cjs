const { chromium } = require('playwright'); const fs=require('fs');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/expression_town'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const TOWN3=BASE+'towns/topic-3-expression-town/';
const LIVE='https://script.google.com/macros/s/AKfycbynV4sv6ALkPOsLAViYpVFXDZoQoxZBVf8hlprt3jhfI5mY3kH5esSKlJos4PCv1mRn3w/exec';
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };

// ---- pretend sheet ----
const sheet={ students:{ K7M2QX:{open:Array(8).fill(false),full:false,progress:null}, TEACH2:{open:Array(8).fill(false),full:true,progress:null} }, results:[], posts:[], down:false };
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
async function mockSheet(ctx){
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await ctx.route('https://script.google.com/**',async r=>{
    const req=r.request();
    if(sheet.down) return r.abort('internetdisconnected');
    if(req.method()==='GET'){ const code=new URL(req.url()).searchParams.get('code'); const s=sheet.students[code];
      return json(r, s?{ok:true,open:s.open,full_access:s.full,progress:s.progress}:{ok:false,error:'bad_code'}); }
    const b=JSON.parse(req.postData()); sheet.posts.push(b); const s=sheet.students[b.student_code];
    if(!s) return json(r,{ok:false,error:'bad_code'});
    if(b.type==='save') s.progress=JSON.stringify(b.progress); else if(b.type==='result') sheet.results.push(b);
    return json(r,{ok:true});
  });
}
(async()=>{
  const b=await chromium.launch();

  console.log('\n[1] Live script, read-only check (only with LIVE=1; made-up code, nothing is written)');
  if (process.env.LIVE) { const ctx=await b.newContext(); const p=await ctx.newPage(); await p.goto(TOWN3,{waitUntil:'domcontentloaded'});
    const r=await p.evaluate(async(u)=>{ try{
      const g=await (await fetch(u+'?action=load&code=AAAAAA')).json();
      const q=await (await fetch(u,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type:'save',student_code:'AAAAAA',progress:{x:1}})})).json();
      return {g,q}; }catch(e){ return {err:String(e)}; } },LIVE);
    ok(r.g&&r.g.error==='bad_code','browser GET to the live script is readable (CORS ok): '+JSON.stringify(r.g||r));
    ok(r.q&&r.q.error==='bad_code','browser POST to the live script is readable and rejects an unknown code: '+JSON.stringify(r.q||r));
    await ctx.close(); }

  console.log('\n[2] Sign-in screen and wrong code');
  const ctx=await b.newContext({viewport:{width:1366,height:768}}); await mockSheet(ctx);
  const errs=[]; const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(TOWN3,{waitUntil:'load'}); await p.waitForTimeout(1500);
  await p.screenshot({path:OUT+'/1_login.png'});
  const html=await p.content();
  ok(!/passcode|PLAYER PIN|Quick test|7777|star6/i.test(html),'login page has no PIN, passcode, quick accounts or credentials');
  await p.fill('#codeInput','AAAAAA'); await p.click('#loginBtn'); await p.waitForTimeout(800);
  ok(/isn't in the system/.test(await p.textContent('#loginError')),'unknown code shows a friendly message');
  await p.fill('#codeInput','K7M2Q0'); await p.click('#loginBtn'); await p.waitForTimeout(500);
  ok(/6 letters and numbers/.test(await p.textContent('#loginError')),'malformed code shows how a code looks');

  console.log('\n[3] Sign in, play, save');
  await p.fill('#codeInput','k7m-2qx'); await p.click('#loginBtn'); await p.waitForTimeout(2500);
  ok(await p.isVisible('#worldScreen'),'valid code (typed lowercase with a dash) reaches the map');
  ok((await p.textContent('#hudPlayerCode')).trim()==='K7M2QX','HUD shows the student code');
  ok(!(await p.isVisible('#teacherBanner')),'a normal student does NOT see the teacher banner');
  await p.screenshot({path:OUT+'/2_map.png'});
  await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  await p.click('#embarkQuestBtn'); await p.waitForTimeout(1500);
  await p.evaluate(()=>window.postMessage({type:'CARTRIDGE_COMPLETE',payload:{score:9,total:10,bossDefeated:true}},'*'));
  await p.waitForTimeout(1500);
  ok(await p.isVisible('#victoryModal'),'finishing a stage shows the victory screen');
  await p.screenshot({path:OUT+'/3_victory.png'});
  ok(sheet.posts.some(x=>x.type==='save'),'progress was sent to the sheet');
  const res=sheet.results.at(-1)||{};
  ok(res.student_code==='K7M2QX'&&res.town==='topic-3'&&res.lesson==='3-1'&&res.score===9&&res.problems_attempted===10&&res.accuracy===90&&res.boss_defeated===true,'result row has code, town, lesson, score, accuracy, boss: '+JSON.stringify(res));
  ok(!JSON.stringify(sheet.posts).match(/passcode|password|"pin"/i),'nothing like a pin or passcode was sent');
  await p.click('#returnToMapBtn'); await p.waitForTimeout(600);
  await p.click('#myProgressBtn'); await p.waitForTimeout(600);
  await p.screenshot({path:OUT+'/4_progress.png'});
  const prog=await p.textContent('#progressModal');
  ok(/Code K7M2QX/.test(prog)&&/Saved\./.test(prog),'My Progress shows the code and "Saved"');
  await p.click('#closeProgressBtn');

  console.log('\n[4] Reload: remembered code signs in and progress comes back from the sheet');
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(2500);
  ok(await p.isVisible('#worldScreen'),'reload signs straight back in');
  await p.click('#myProgressBtn'); await p.waitForTimeout(500);
  ok(/BEST 9\/10|Best 9\/10/i.test(await p.textContent('#progressList')),'the saved score is back: Best 9/10');
  await p.click('#closeProgressBtn');

  console.log('\n[5] Offline: play on, nothing lost, it sends when the network returns');
  sheet.down=true; const savesBefore=sheet.posts.filter(x=>x.type==='save').length;
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const second=await p.isVisible('#questModal');
  if(second){ await p.click('#embarkQuestBtn'); await p.waitForTimeout(1200);
    await p.evaluate(()=>window.postMessage({type:'CARTRIDGE_COMPLETE',payload:{score:7,total:10,bossDefeated:true}},'*')); await p.waitForTimeout(1500);
    ok(await p.isVisible('#victoryModal'),'a stage can be finished while offline'); await p.click('#returnToMapBtn'); await p.waitForTimeout(500);
    await p.click('#myProgressBtn'); await p.waitForTimeout(500);
    ok(/Saved on this Chromebook/.test(await p.textContent('#progressSync')),'My Progress says it is saved on the Chromebook, waiting to send');
    await p.screenshot({path:OUT+'/5_offline.png'}); await p.click('#closeProgressBtn');
    sheet.down=false; await p.evaluate(()=>window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2500);
    ok(sheet.posts.filter(x=>x.type==='save').length>savesBefore,'after the network returns the waiting save was sent');
  } else console.log('  (skipped: the second stage was not open to enter from here)');
  sheet.down=false;

  console.log('\n[6] Teacher / preview code');
  await p.click('#switchUserBtn'); await p.waitForTimeout(500);
  ok(await p.isVisible('#loginScreen'),'EXIT returns to the sign-in screen');
  await p.fill('#codeInput','TEACH2'); await p.click('#loginBtn'); await p.waitForTimeout(2500);
  ok(await p.isVisible('#teacherBanner'),'a full-access code shows the TEACHER banner');
  await p.screenshot({path:OUT+'/6_teacher.png'});
  ok(sheet.students.TEACH2.progress===null,'just signing in as a teacher does not write progress');

  const over=await p.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  ok(over<=0,'no vertical scrolling on the map screen (overflow px: '+over+')');
  const real=errs.filter(e=>!/tailwind is not defined/.test(e));
  ok(real.length===0,'no page errors'+(real.length?': '+real.join(' | '):' (ignoring "tailwind is not defined", which comes from my local Tailwind stand-in)'));
  await b.close();
  console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e);process.exit(2);});
