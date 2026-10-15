import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
let listener;const stored={history:{},settings:{interests:['theology']}};
globalThis.chrome={runtime:{getURL:p=>new URL('../extension/'+p,import.meta.url).href,onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>structuredClone(stored),set:async v=>{await new Promise(r=>setTimeout(r,2));Object.assign(stored,structuredClone(v));}}},commands:{onCommand:{addListener(){}}}};
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await fs.readFile(fileURLToPath(url),'utf8'))});
await import('../extension/worker.js');
const send=m=>new Promise(resolve=>listener(m,{tab:{title:'Theology',url:'https://example.test/faith'}},resolve));
test('concurrent reader and webpage clicks preserve both entries through worker serialization',async()=>{
 const replies=await Promise.all([
 send({type:'learning-event',action:'lookup',a:{word:'divine',lemma:'divine',rank:4052},context:'Divine grace.'}),
 send({type:'word-viewed',word:'salvation',context:'Salvation and divine grace.'})
 ]);
 assert.ok(replies.every(r=>r.ok));assert.equal(stored.history.divine.saved,true);assert.equal(stored.history.salvation.saved,true);
});
test('web hover lookup alone never collects; later deliberate card click does',async()=>{
 await send({type:'lookup',word:'matrix',context:'A matrix has rows.'});assert.equal(stored.history.matrix,undefined);
 await send({type:'word-viewed',word:'matrix',title:'Computing',context:'A matrix has rows.',topicText:'A computer processes a matrix.'});
 assert.equal(stored.history.matrix.saved,true);assert.equal(stored.history.matrix.lookups.length,1);
});
test('invalid status leaves stored learning state unchanged',async()=>{
 const result=await send({type:'learning-event',action:'status',lemma:'divine',status:'mastered-by-ai'});
 assert.match(result.error,/Invalid/);assert.equal(stored.history.divine.status,'learning');
});
