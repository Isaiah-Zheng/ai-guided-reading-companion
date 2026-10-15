import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
let listener,aiCalls=0;const data={settings:{},wordCache:{}};
globalThis.chrome={runtime:{getURL:p=>new URL('../extension/'+p,import.meta.url).href,onMessage:{addListener:fn=>{listener=fn;}}},storage:{local:{get:async()=>data,set:async v=>Object.assign(data,v)}},commands:{onCommand:{addListener(){}}}};
globalThis.fetch=async url=>{if(String(url).startsWith('file:')){const body=await fs.readFile(fileURLToPath(url),'utf8');return {ok:true,json:async()=>JSON.parse(body)};}aiCalls++;return {ok:true,json:async()=>({en:'Contextual array',zh:'矩阵',value:'Useful in mathematics',explanation:'Context-specific.',example:''})};};
const {dictionaryLookup}=await import('../extension/dictionary.js');await import('../extension/worker.js');
async function message(m){return new Promise(resolve=>listener(m,{},resolve));}
test('offline dictionary provides matrix in English and Chinese',async()=>{const entry=await dictionaryLookup('matrix');assert.equal(entry.source,'dictionary');assert.match(entry.zh,/矩阵/);assert.ok(entry.en.length>5);assert.equal(aiCalls,0);});
test('ordinary lookup never depends on the AI backend',async()=>{const result=await message({type:'lookup',word:'matrix',context:'A matrix has rows.'});assert.equal(result.data.source,'dictionary');assert.equal(aiCalls,0);});
test('missing dictionary entry remains explicit without silent AI requests',async()=>{const result=await message({type:'lookup',word:'zzzzunknownwordzzzz',context:'zzzzunknownwordzzzz'});assert.equal(result.data.source,'missing');assert.equal(aiCalls,0);});
test('AI is requested only explicitly and is labeled separately',async()=>{const result=await message({type:'lookup',word:'matrix',context:'A matrix has rows.',forceAI:true});assert.equal(result.data.source,'ai');assert.equal(aiCalls,1);});
