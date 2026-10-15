const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1100,height:800}});let aiCalls=0;
 try{
 await page.route('http://127.0.0.1:8766/**',route=>{aiCalls++;return route.abort();});
 await page.addInitScript(()=>{if(!localStorage.getItem('reading-tutor'))localStorage.setItem('reading-tutor',JSON.stringify({settings:{interestsChosen:true}}));});
 await page.goto((process.env.READER_TEST_URL||'http://127.0.0.1:8093')+'/reader.html');await page.waitForSelector('#article p',{timeout:30000});
 await page.locator('#import-open').click();await page.locator('#import-title').fill('Offline computing matrix');await page.locator('#import-text').fill('A matrix has rows and columns. We study matrix operations.');await page.locator('#import-submit').click();await page.waitForFunction(()=>document.getElementById('title').textContent==='Offline computing matrix');await page.waitForSelector('#article p');assert.equal(aiCalls,0);assert.match(await page.locator('#status').textContent(),/dictionary/);
 await page.getByRole('button',{name:'Original',exact:true}).click();
 const point=await page.evaluate(()=>{const p=document.querySelector('#article p'),walk=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode()){const i=n.textContent.indexOf('matrix');if(i>=0){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+6);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};}}});
 await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>document.getElementById('word-meaning').textContent.includes('矩阵'));assert.equal(aiCalls,0);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(stored.history.matrix.saved,true);await page.screenshot({path:'test-artifacts/offline-dictionary.png'});console.log('PASS: Reader click lookup and collection work with all AI requests blocked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
