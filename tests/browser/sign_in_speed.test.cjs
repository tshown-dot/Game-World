const { chromium } = require('playwright');
const BASE=process.env.BASE||'http://localhost:3112/';
const OUT=(process.env.OUT||require('path').join(__dirname,'screenshots'))+'/sign_in_speed'; require('fs').mkdirSync(OUT,{recursive:true});
const ROOT_RE=new RegExp('^'+BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(index\\.html)?(\\?.*)?$');
const SITE=BASE; const DELAY=3000;
let checks=0, fails=0; const ok=(c,m)=>{ checks++; if(!c){fails++; console.log('  FAIL:',m);} else console.log('  ok:',m); };
const sheet={ K7M2QX:{open:Array(8).fill(false), full:false, progress:null} };
const json=(r,o)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:768}});
  await ctx.route('https://script.google.com/**',async r=>{ await new Promise(z=>setTimeout(z,DELAY)); const q=r.request();
    if(q.method()==='GET'){ const s=sheet[new URL(q.url()).searchParams.get('code')]; return json(r, s?{ok:true,open:s.open,full_access:s.full,progress:s.progress}:{ok:false,error:'bad_code'}); }
    const bd=JSON.parse(q.postData()); if(sheet[bd.student_code]&&bd.type==='save') sheet[bd.student_code].progress=JSON.stringify(bd.progress); return json(r,{ok:true}); });
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const vis=(sel)=>p.evaluate((s)=>{ const e=document.querySelector(s); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display!=='none'; }, sel).catch(()=>false);

  console.log('\n[1] First sign-in on this Chromebook (has to wait for the sheet)');
  await p.goto(SITE); await p.fill('#codeInput','k7m2qx'); await p.click('#loginBtn'); await p.waitForTimeout(500);
  ok(/SIGNING IN/.test(await p.textContent('#loginBtn')),'the button says SIGNING IN… while it waits');
  await p.screenshot({path:OUT+'/signing_in.png'});
  await p.waitForSelector('#worldScreen:not(.hidden)',{timeout:10000}); ok(true,'then the map opens');

  for (const [name, town, sel] of [['Expression Town','towns/topic-3-expression-town/','#worldMapBtn'],['Equation Valley','towns/topic-4-equation-valley/','#worldMapBtn']]) {
    console.log(`\n[2] Into ${name} and back out`);
    if (name==='Equation Valley') sheet.K7M2QX.full=true;    // so Town 4 is open for this code
    if (name==='Equation Valley') { await p.goto(SITE); await p.waitForSelector('#worldScreen:not(.hidden)'); await p.waitForTimeout(DELAY+800); }
    const t0=Date.now(); await p.goto(SITE+town);
    await p.waitForFunction((s)=>{ const e=document.querySelector(s); return e && e.getBoundingClientRect().width>0 && !document.querySelector('#loginScreen:not(.hidden)'); }, sel, {timeout:10000});
    ok(Date.now()-t0<DELAY, `${name} opens before the 3-second sheet answers (${Date.now()-t0} ms)`);
    await p.click(sel); await p.waitForURL(/from=/);
    const t1=Date.now(); let sawLogin=false;
    for(let i=0;i<40;i++){ if(await vis('#loginScreen')) sawLogin=true; if(await vis('#worldScreen') && i>4) break; await p.waitForTimeout(25); }
    await p.waitForSelector('#worldScreen:not(.hidden)',{timeout:1500}).catch(()=>{});
    ok(await vis('#worldScreen'), `back on the Super Map in ${Date.now()-t1} ms`);
    ok(!sawLogin, 'the sign-in screen never appeared on the way back');
    await p.screenshot({path:OUT+'/back_from_'+town.split('/')[1]+'.png'});
  }

  console.log('\n[3] A teacher tick arrives in the background');
  sheet.K7M2QX.full=false; sheet.K7M2QX.open[3]=false;
  await p.goto(SITE); await p.waitForTimeout(DELAY+800);   // device copy now: no Town 4 access (not full)
  sheet.K7M2QX.open[3]=true;
  await p.goto(SITE+'?from=topic_3'); await p.waitForSelector('#worldScreen:not(.hidden)');
  const before=await p.evaluate(()=>document.getElementById('enterBtn').textContent);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(DELAY+1200);
  const after=await p.evaluate(()=>document.getElementById('enterBtn').textContent);
  ok(/ENTER TOWN/.test(after),'after the sheet answers, Town 4 is open on the map (button: '+after.trim()+')');

  console.log('\n[4] EXIT still signs out, and a wrong code is still rejected');
  await p.click('#exitBtn'); await p.waitForTimeout(200);
  ok(await vis('#loginScreen') && !(await p.evaluate(()=>localStorage.getItem('gw_active_code'))),'EXIT shows sign-in and forgets the code');
  await p.reload(); await p.waitForTimeout(500); ok(await vis('#loginScreen'),'after EXIT, reloading stays on sign-in');
  await p.fill('#codeInput','ABCDEF'); await p.click('#loginBtn'); await p.waitForSelector('#loginError:not(.hidden)',{timeout:8000});
  ok(/isn't in the system/.test(await p.textContent('#loginError')),'an unknown code is rejected');

  console.log('\n[5] A code the teacher removed is signed out after the background check');
  await p.fill('#codeInput','K7M2QX'); await p.click('#loginBtn'); await p.waitForSelector('#worldScreen:not(.hidden)',{timeout:8000});
  delete sheet.K7M2QX; await p.reload(); await p.waitForSelector('#worldScreen:not(.hidden)');
  await p.waitForSelector('#loginScreen:not(.hidden)',{timeout:DELAY+3000}).catch(()=>{});
  ok(await vis('#loginScreen') && /any more/.test(await p.textContent('#loginError')),'back to sign-in with "not in the system any more"');
  ok(errs.length===0,'no page errors'+(errs.length?': '+errs.join(' | '):''));
  await b.close(); console.log(`\n${checks-fails}/${checks} checks passed`); process.exit(fails?1:0);
})().catch(e=>{console.error('SCRIPT ERROR',e.message.split('\n').slice(0,4).join(' | '));process.exit(2);});
