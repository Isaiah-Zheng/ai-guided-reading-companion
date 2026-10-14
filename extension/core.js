export async function articleId(blocks) {
  const bytes = new TextEncoder().encode(JSON.stringify(blocks));
  const hash = await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24);
}
export function splitText(text) {
  return text.replace(/\r\n/g,'\n').split(/\n\s*\n/).map(text=>({type:'paragraph',text:text.trim()})).filter(b=>b.text);
}
export function validateAnnotations(text,items) {
  let end = 0;
  return (Array.isArray(items)?items:[]).filter(a=>a && Number.isInteger(a.start) && Number.isInteger(a.end))
    .sort((a,b)=>a.start-b.start || b.end-a.end)
    .filter(a=>{
      if(a.start<end || a.start<0 || a.end<=a.start || a.end>text.length || !['learn','gloss','entity'].includes(a.kind)) return false;
      if(a.word !== text.slice(a.start,a.end)) return false;
      if(typeof a.zh!=='string' || a.zh.length>24 || typeof a.lemma!=='string' || !a.lemma.trim()) return false;
      end=a.end; return true;
    }).map(a=>({...a,lemma:a.lemma.toLowerCase(),zh:a.zh.slice(0,24)}));
}
export function localAnnotations(text,lexicon) {
  const out=[];
  for(const entry of lexicon) {
    for(const form of entry.forms || [entry.lemma]) {
      const escaped=form.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re = new RegExp('\\b'+escaped+'\\b','gi');
      for(const match of text.matchAll(re)) out.push({...entry,word:match[0],start:match.index,end:match.index+match[0].length,source:'local'});
    }
  }
  return validateAnnotations(text,out);
}
export function recordEncounter(history,annotation,article,index) {
  const lemma=annotation.lemma.toLowerCase();
  const old=history[lemma] || {lemma,word:annotation.word,zh:annotation.zh,encounters:[],viewed:false,firstSource:article.title,firstUrl:article.url};
  const location=article.id+':'+index+':'+annotation.start;
  if(!old.encounters.includes(location)) old.encounters.push(location);
  history[lemma]=old;
  return old;
}
export function viewDetailed(history,annotation,article,index) {
  const entry=recordEncounter(history,annotation,article,index);
  entry.viewed=true; entry.lastViewed=Date.now(); entry.context=article.blocks[index].text;
  if(annotation.kind==='learn') entry.saved=true;
  return entry;
}
