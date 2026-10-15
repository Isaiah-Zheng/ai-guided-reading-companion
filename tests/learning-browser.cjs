const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('extension');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let aiCalls=0;
 await page.route('http://127.0.0.1:8766/**',r=>{aiCalls++;return r.abort();});
 await page.goto(base+'/reader.html');await page.waitForSelector('#article p');
 // Initial interests can be skipped or selected, and remain editable.
 await page.locator('#interest-options input[value=theology]').check();await page.locator('#save-interests').click();
 await page.locator('#import-open').click();await page.locator('#import-title').fill('Theology and divine grace');await page.locator('#import-text').fill('Divine grace is discussed in theology. Divine wisdom matters.\n\nWe read about divine love. It was a meaningful passage.');await page.locator('#import-submit').click();await page.waitForSelector('#article p');
 assert.equal(await page.locator('.annotation.learn').count(),0);
 async function clickWord(word,paragraph=0){
  const point=await page.locator('#article p').nth(paragraph).evaluate((p,word)=>{const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const at=n.textContent.toLowerCase().indexOf(word.toLowerCase());if(at>=0){const r=document.createRange();r.setStart(n,at);r.setEnd(n,at+word.length);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2};}}throw Error('word not found '+word);},word);
  await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>document.getElementById('word-status').textContent.includes('lookup(s)'));
 }
 await clickWord('Divine');assert.match(await page.locator('#word-meaning').textContent(),/神/);assert.equal(await page.locator('.annotation.learn').count(),3);
 let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(state.history.divine.saved,true);assert.equal(state.history.divine.lookups.length,1);assert.equal(aiCalls,0);
 const bounds=await page.locator('#word-dialog').boundingBox(),article=await page.locator('#article').boundingBox();assert.ok(bounds.x>=article.x+article.width);fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/learning-desktop.png'});
 await page.locator('#word-dialog .close').click();
 // Same-card revisit does not inflate lookup evidence.
 await clickWord('Divine');await page.locator('#word-dialog .close').click();
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(state.history.divine.lookups.length,1);
 await page.waitForTimeout(2400);
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(state.history.divine.readingEncounters.length,2);
 await page.locator('#words-open').click();await page.getByRole('button',{name:'Check when ready',exact:true}).click();
 assert.equal(await page.locator('#check-meaning').isVisible(),false);
 await page.locator('#check-reveal').click();await page.locator('#check-unsure').click();
 state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(state.history.divine.status,'learning');assert.equal(state.history.divine.lookups.length,1);
 await page.locator('#words-open').click();await page.getByRole('button',{name:'Check when ready',exact:true}).click();await page.locator('#check-reveal').click();await page.locator('#check-known').click();
 assert.equal(await page.locator('.annotation.learn').count(),0);
 // Function words remain available to look up without automatic collection.
 await clickWord('was',1);state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.ok(!state.history.be?.saved&&!state.history.was?.saved);await page.locator('#word-dialog .close').click();
 // Known words can explicitly return to learning.
 await page.locator('#words-open').click();await page.getByRole('button',{name:'Need more reading',exact:true}).click();await page.locator('#words-dialog .close').click();
 await page.reload();await page.waitForSelector('.annotation.learn');
 assert.equal(await page.locator('.annotation.learn').count(),3);
 await page.waitForTimeout(2400);state=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-tutor')));assert.equal(state.history.divine.readingEncounters.length,2);
 // Paste insertion, navigation, delete and restore remain intact.
 await page.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','An earlier page about divine love.');document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 await page.locator('#insert-position').selectOption('0');await page.keyboard.press('Control+Enter');await page.waitForFunction(()=>document.getElementById('page-label').textContent.startsWith('Page 1 of 2'));
 await page.locator('#pages-open').click();await page.locator('#pages-list .entry').first().getByRole('button',{name:'Delete',exact:true}).click();await page.locator('#pages-dialog details summary').click();await page.locator('#trash-list').getByRole('button',{name:'Restore'}).click();assert.equal(await page.locator('#pages-list .entry').count(),2);await page.locator('#pages-dialog .close').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await clickWord('divine');const mobileCard=await page.locator('#word-dialog').boundingBox();assert.ok(mobileCard.x>=0&&mobileCard.x+mobileCard.width<=390);await page.screenshot({path:'test-artifacts/learning-mobile.png',fullPage:true});await page.locator('#word-dialog .close').click();
 // Selecting a complete phrase opens one lookup, without a model request.
 await page.locator('#article p').first().evaluate(p=>{
  const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n,start,end;
  while(n=walker.nextNode()){const a=n.textContent.indexOf('divine'),b=n.textContent.indexOf('love');if(a>=0)start={n,at:a};if(b>=0)end={n,at:b+4};}
  const range=document.createRange();range.setStart(start.n,start.at);range.setEnd(end.n,end.at);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.getElementById('word-title').textContent==='divine love');await page.waitForFunction(()=>document.getElementById('word-status').textContent.includes('lookup(s)'));assert.equal(aiCalls,0);await page.locator('#word-dialog .close').click();
 assert.deepEqual(errors,[]);assert.equal(aiCalls,0);
 // Web mode: blue link text gets hover help and click still navigates.
 const web=await browser.newPage({viewport:{width:1000,height:700}});
 await web.setContent('<p style="font-size:28px;margin:100px">A <a href="#destination">matrix</a> has rows.</p><p id="destination">Destination</p>');
 await web.evaluate(()=>{window.lookups=0;window.chrome={runtime:{sendMessage:async m=>{if(m.type==='lookup'){window.lookups++;return {data:{word:m.word,lemma:'matrix',en:'A rectangular array',zh:'矩阵',source:'dictionary',value:'Useful'}};}return {ok:true,history:{}};}},storage:{local:{get:async()=>({history:{}})}}};});
 await web.addScriptTag({path:path.resolve('extension/web.js')});await web.locator('a').hover();await web.waitForFunction(()=>window.lookups===1);await web.locator('a').click();await web.waitForFunction(()=>location.hash==='#destination');
 await browser.close();console.log('PASS: interests, click collection, all occurrences, repeat dedup, visible encounters, check failure/success, known/manual return, function words, persistence, paste/pages/restore, narrow width, offline AI independence, link hover/navigation.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
