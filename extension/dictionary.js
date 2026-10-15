import {isFunctionWord} from './learning.js';
const buckets=new Map();
function baseUrl(){return globalThis.chrome?.runtime?.getURL?chrome.runtime.getURL('dictionary/'):new URL('./dictionary/',import.meta.url).href;}
async function bucket(letter){if(!buckets.has(letter)){const task=fetch(baseUrl()+letter+'.json').then(r=>{if(!r.ok)throw Error('Local dictionary could not load. Reload the extension.');return r.json();}).catch(error=>{buckets.delete(letter);throw error;});buckets.set(letter,task);}return buckets.get(letter);}
export async function dictionaryLookup(input){
 const word=input.toLowerCase().replace(/’/g,"'").trim();if(!/^[a-z][a-z '-]{1,59}$/.test(word))return null;
 let lemma=word,entry=(await bucket(word[0]))[word];
 if(typeof entry==='string'){lemma=entry;entry=(await bucket(lemma[0]))[lemma];}
 if(!entry)return null;
 const surface=entry;
 // Use only explicit dictionary form references, never blind suffix stemming.
 const form=(entry.zh||'').match(/([a-z][a-z'-]*)\s*的(?:过去|现在|复数|第三人称|比较级|最高级)/i)
  ||(entry.en||'').match(/(?:imp\.|p\. p\.|past tense|past participle|present participle|plural)[\s\S]{0,60}?\bof\s+([a-z][a-z'-]*)/i);
 if(form&&form[1].toLowerCase()!==lemma){
  const base=form[1].toLowerCase(),candidate=(await bucket(base[0]))[base];
  if(candidate&&typeof candidate==='object'){lemma=base;entry=candidate;}
 }
 const value=entry.core||entry.rank>0&&entry.rank<=3000?'Common / reusable — dictionary frequency indicator':entry.rank>0&&entry.rank<=15000?'Useful for recognition — dictionary frequency indicator':'Recognition or specialist use — check the context';
 return {word:input,lemma,en:entry.en||'An English definition is not included in this local entry.',zh:entry.zh,ipa:surface.ipa,rank:entry.rank,core:!!entry.core,value,source:'dictionary',explanation:'General dictionary senses; the meaning in your sentence may differ.',example:''};
}
export async function dictionaryAnnotations(text,known={}){
 const words=[...new Set(text.match(/[A-Za-z][A-Za-z’'-]{1,}/g)||[])].slice(0,350);
 const entries=await Promise.all(words.map(async word=>({word,data:await dictionaryLookup(word)})));
 const out=[];let notes=0;
 for(const {word,data} of entries){
  if(!data||isFunctionWord(word)||isFunctionWord(data.lemma)||known[data.lemma]?.status==='known')continue;
  const tracked=known[data.lemma]?.saved;
  if(!tracked&&(data.core||data.rank>0&&data.rank<=15000||notes>=2))continue;
  const re=new RegExp('\\b'+word.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&')+'\\b','g');
  for(const match of text.matchAll(re)){
   out.push({...data,word:match[0],start:match.index,end:match.index+word.length,zh:data.zh.split('\n')[0].slice(0,24),kind:tracked?'learn':'gloss',detail:data.explanation});
   if(!tracked){notes++;break;}
  }
 }
 return out.sort((a,b)=>a.start-b.start);
}
