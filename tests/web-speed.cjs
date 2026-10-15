const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.goto('http://127.0.0.1:8093/');await page.setContent('<p style="font-size:28px;margin:100px">A matrix has rows and columns.</p>');
 await page.evaluate(()=>{window.calls=0;window.chrome={runtime:{getURL:p=>new URL(p,location.origin).href,sendMessage:async m=>{if(m.type==='lookup'){window.calls++;if(m.forceAI)throw Error('AI must not run');const {dictionaryLookup}=await import('/dictionary.js');const data=await dictionaryLookup(m.word);window.dictionaryReady=performance.now();return {data};}return {ok:true};}},storage:{local:{get:async()=>({history:{}})}}};});
 await page.addScriptTag({url:'http://127.0.0.1:8093/web.js'});
 const point=await page.evaluate(()=>{const n=document.querySelector('p').firstChild,r=document.createRange();r.setStart(n,2);r.setEnd(n,8);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};});
 await page.evaluate(()=>{window.started=performance.now();});await page.mouse.move(point.x,point.y);await page.waitForFunction(()=>window.dictionaryReady);
 const ms=await page.evaluate(()=>Math.round(window.dictionaryReady-window.started));assert.equal(await page.evaluate(()=>window.calls),1);
 await page.mouse.move(5,5);await page.waitForTimeout(450);await page.mouse.move(point.x,point.y);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.calls),1);
 await page.screenshot({path:'test-artifacts/fast-web-dictionary.png'});await browser.close();console.log('PASS: first matrix hover dictionary response '+ms+' ms; repeat hover used cache with zero additional requests.');
})().catch(error=>{console.error(error);process.exit(1);});
