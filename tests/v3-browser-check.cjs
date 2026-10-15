const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
fs.mkdirSync('test-artifacts',{recursive:true});
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0;await page.route('http://127.0.0.1:8766/outline',r=>r.fulfill({json:{sections:[{index:0,title:'A royal bargain',level:2}]}}));
 await page.route('http://127.0.0.1:8766/analyze',async route=>{requests++;await new Promise(r=>setTimeout(r,350));const body=route.request().postDataJSON();await route.fulfill({json:{paragraphs:body.paragraphs.map(p=>({index:p.index,annotations:[]}))}});});
 await page.addInitScript(()=>{if(!localStorage.getItem('reading-tutor'))localStorage.setItem('reading-tutor',JSON.stringify({settings:{interestsChosen:true}}));});
 await page.goto((process.env.READER_TEST_URL||'http://127.0.0.1:8093')+'/reader.html');await page.waitForSelector('#article p');await page.locator('#settings-open').click();await page.locator('#reading-mode').selectOption('ai');await page.locator('#settings-dialog .close').click();
 await page.locator('#import-open').click();await page.locator('#import-title').fill('Rubicon QA');const raw=('A haughty tyrant demanded a fabulous price. The old woman vanished. ').repeat(65);await page.locator('#import-text').fill(raw);await page.locator('#import-submit').click();
 await page.waitForFunction(()=>document.getElementById('title').textContent==='Rubicon QA');
 assert.equal(await page.locator('#article').isVisible(),false);assert.equal(await page.locator('#article').textContent(),'');
 await page.waitForSelector('#article p',{timeout:30000});assert.ok(requests>1);assert.ok(await page.locator('#article p').count()>1);
 let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));const key=Object.keys(state).find(k=>state[k]?.title==='Rubicon QA');assert.equal(state[key].pages.length,1);assert.equal(state[key].pages[0].raw,raw);
 await page.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','This is the earlier page.');document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.locator('#insert-position').selectOption('0');await page.keyboard.press('Control+Enter');await page.waitForFunction(()=>document.getElementById('page-label').textContent.startsWith('Page 1 of 2'));await page.waitForSelector('#article p');
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(state[key].pages[0].raw,'This is the earlier page.');assert.equal(state[key].pages[1].raw,raw);
 await page.reload();await page.waitForSelector('#article p');assert.match(await page.locator('#page-label').textContent(),/Page 1 of 2/);
 await page.locator('#pages-open').click();await page.locator('#pages-list .entry').first().getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await page.locator('#pages-list .entry').count(),1);assert.equal(await page.locator('#trash-list .entry').count(),1);
 await page.locator('#pages-dialog details summary').click();await page.locator('#trash-list').getByRole('button',{name:'Restore'}).click();assert.equal(await page.locator('#pages-list .entry').count(),2);await page.locator('#pages-dialog .close').click();
 await page.locator('#next-page').click();await page.waitForFunction(()=>document.getElementById('page-label').textContent.startsWith('Page 2 of 2'));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'test-artifacts/pages-preview.png',fullPage:true});
 // AI failure hides text and presents explicit recovery.
 await page.route('http://127.0.0.1:8766/analyze',route=>route.fulfill({status:503,json:{detail:'Model is offline'}}));
 await page.locator('#append-open').click();await page.locator('#import-text').fill('A new unavailable page.');await page.locator('#import-submit').click();await page.waitForSelector('#retry-page');assert.equal(await page.locator('#article').isVisible(),false);await page.locator('#read-offline').click();assert.equal(await page.locator('#article').isVisible(),true);
 assert.deepEqual(errors,[]);
 // Web overlay uses actual hit testing and shadow popup with a simulated extension bridge.
 const web=await browser.newPage({viewport:{width:1000,height:700}});await web.setContent('<p style="font-size:28px;margin:100px">A haughty tyrant demanded a fabulous price.</p>');
 await web.evaluate(()=>{const store={history:{}};window.chrome={storage:{local:{get:async()=>store}},runtime:{sendMessage:async m=>m.type==='lookup'?{data:{en:'Arrogant',zh:'傲慢的',value:'Recognition',explanation:'Shows pride.',example:'A haughty reply.'}}:{ok:true}}};});
 await web.addScriptTag({path:path.resolve('extension/web.js')});
 const point=await web.evaluate(()=>{const n=document.querySelector('p').firstChild,r=document.createRange();r.setStart(n,2);r.setEnd(n,9);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};});
 await web.mouse.move(point.x,point.y);await web.waitForTimeout(900);await web.mouse.click(point.x,point.y);await web.waitForTimeout(200);await web.screenshot({path:'test-artifacts/web-preview.png'});
 await browser.close();console.log('PASS: long paste, loading gate, saved pages, insertion, reload, delete/restore, navigation, mobile, failure recovery, web hover/click.');
})().catch(error=>{console.error(error);process.exit(1);});
