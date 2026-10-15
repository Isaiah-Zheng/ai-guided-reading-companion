const buckets=new Map();
function baseUrl(){return globalThis.chrome?.runtime?.getURL?chrome.runtime.getURL('dictionary/'):new URL('./dictionary/',import.meta.url).href;}
async function bucket(letter){if(!buckets.has(letter)){const task=fetch(baseUrl()+letter+'.json').then(r=>{if(!r.ok)throw Error('Local dictionary could not load. Reload the extension.');return r.json();}).catch(error=>{buckets.delete(letter);throw error;});buckets.set(letter,task);}return buckets.get(letter);}
export async function dictionaryLookup(input){
 const word=input.toLowerCase().replace(/’/g,"'").trim();if(!/^[a-z][a-z '-]{1,59}$/.test(word))return null;
 let lemma=word,entry=(await bucket(word[0]))[word];
 if(typeof entry==='string'){lemma=entry;entry=(await bucket(lemma[0]))[lemma];}
 if(!entry)return null;
 const value=entry.core||entry.rank>0&&entry.rank<=3000?'Common / reusable — dictionary frequency indicator':entry.rank>0&&entry.rank<=15000?'Useful for recognition — dictionary frequency indicator':'Recognition or specialist use — check the context';
 return {word:input,lemma,en:entry.en||'An English definition is not included in this local entry.',zh:entry.zh,ipa:entry.ipa,rank:entry.rank,value,source:'dictionary',explanation:'General dictionary senses; the meaning in your sentence may differ.',example:''};
}
export async function dictionaryAnnotations(text,known={}){
 const words=[...new Set(text.match(/[A-Za-z][A-Za-z’'-]{2,}/g)||[])].slice(0,350);
 const entries=await Promise.all(words.map(async word=>({word,data:await dictionaryLookup(word)})));
 const out=[];
 for(const {word,data} of entries){
  if(!data||known[data.lemma]?.status==='known'||data.rank>0&&data.rank<4000)continue;
  const start=text.indexOf(word);if(start<0)continue;
  out.push({word,lemma:data.lemma,start,end:start+word.length,zh:data.zh.split('\n')[0].slice(0,24),en:data.en,kind:'learn',source:'dictionary',value:data.value,ipa:data.ipa,detail:data.explanation});if(out.length>=6)break;
 }
 return out.sort((a,b)=>a.start-b.start);
}
