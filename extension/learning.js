// Learning evidence, not an estimate of mastery. Collection is click-led.
export const domains = {
 theology:{label:'Theology · 神学',words:'divine deity theology theological scripture biblical gospel salvation redemption grace faith covenant resurrection worship sermon apostle doctrine holy spirit church god jesus'},
 history:{label:'History · 历史',words:'empire emperor republic senate legion consul dynasty conquest ancient medieval roman rome caesar rubicon pompey historical history'},
 computing:{label:'Computing · 计算机',words:'algorithm server backend database protocol software hardware programming network processor memory matrix tensor variable function api computer'},
 philosophy:{label:'Philosophy · 哲学',words:'philosophy philosophical ethics metaphysics epistemology ontology virtue morality consciousness existence rational reason argument'},
 literature:{label:'Literature · 文学',words:'literature literary novel poetry poem metaphor narrative narrator prose fiction author'},
 science:{label:'Science · 科学',words:'science scientific experiment hypothesis molecule atom physics biology chemistry evolution organism'},
 business:{label:'Business · 商业',words:'business market revenue profit investment investor equity enterprise entrepreneur startup commerce'}
};
const functional=new Set(('a an the and or but so if as at by for from in into of on onto to up upon with without am is are was were be been being do does did done have has had having i me my mine myself we us our ours you your yours he him his she her hers it its they them their theirs this that these those who whom whose which what when where why how not no yes can could will would shall should may might must than then there here some any each every all both either neither much many more most very just only also').split(' '));
const domainSets=Object.fromEntries(Object.entries(domains).map(([key,d])=>[key,new Set(d.words.split(' '))]));
export const normalize=value=>String(value||'').toLowerCase().replace(/’/g,"'").trim();
export const isFunctionWord=value=>functional.has(normalize(value));
function tokens(value){return new Set(normalize(value).match(/[a-z]+/g)||[]);}
export function inferTopics(title='',body=''){
 const heading=tokens(title),text=tokens(body);
 return Object.keys(domains).filter(key=>{const matches=[...domainSets[key]].filter(word=>text.has(word)||heading.has(word));return matches.some(word=>heading.has(word))||matches.length>=2;});
}
export function eligibility(a,interests=[],topics=[]){
 const lemma=normalize(a.lemma||a.word);
 if(!lemma||functional.has(lemma)||a.kind==='entity')return {eligible:false,reason:'Reading help only'};
 const related=[...new Set([...interests,...topics])].filter(key=>domainSets[key]?.has(lemma));
 if(related.length)return {eligible:true,reason:'Relevant to '+related.map(key=>domains[key].label).join(', ')};
 // Reuse the dictionary's existing common-word indicator, not a mastery threshold.
 if(a.core||a.rank>0&&a.rank<=3000||a.source==='local'&&a.kind==='learn')return {eligible:true,reason:'Common / reusable vocabulary'};
 return {eligible:false,reason:'Not automatically selected · you can keep it manually'};
}
export function migrateHistory(history){
 for(const entry of Object.values(history)){entry.lookups||=[];entry.readingEncounters||=[];entry.encounters||=[];if(entry.saved&&!['learning','check','known'].includes(entry.status))entry.status='learning';}
 return history;
}
export function recordLookup(history,a,context,{source='',title='',interests=[],topics=[],now=Date.now(),manual=false}={}){
 const lemma=normalize(a.lemma||a.word);if(!lemma)return null;
 const decision=eligibility(a,interests,topics);
 if(!Object.hasOwn(history,lemma))Object.defineProperty(history,lemma,{value:{lemma,word:a.word,zh:a.zh||'',encounters:[],lookups:[],readingEncounters:[],firstSource:title,firstUrl:source},enumerable:true,writable:true,configurable:true});
 const entry=history[lemma];
 entry.lookups||=[];entry.readingEncounters||=[];entry.encounters||=[];
 const last=entry.lookups.at(-1);
 // Same-context reopen within 30 seconds is one interaction.
 const duplicate=last&&last.context===context&&last.source===source&&now-last.at<30000;
 if(!duplicate){entry.lookups.push({at:now,context,source});entry.lastViewed=now;entry.context=context;}
 entry.viewed=true;entry.zh||=a.zh||'';entry.forms=[...new Set([...(entry.forms||[]),normalize(a.word),lemma])];
 if(manual||(!entry.excluded&&decision.eligible)){entry.saved=true;entry.reason=manual?'Kept manually':decision.reason;if(!entry.status)entry.status='learning';}
 // General dictionary lookup cannot determine whether the reader forgot a sense.
 if(!duplicate&&entry.saved&&entry.status==='check')entry.status='learning';
 return entry;
}
export function setLearningStatus(history,lemma,status){
 if(!['learning','check','known'].includes(status))throw Error('Invalid learning status');
 const entry=history[normalize(lemma)];if(!Object.hasOwn(history,normalize(lemma)))throw Error('Look up the word first');
 entry.saved=true;entry.excluded=false;entry.status=status;return entry;
}
export function removeLearningWord(history,lemma){const e=history[normalize(lemma)];if(e){e.saved=false;e.excluded=true;}return e;}
export function recordReadingEncounter(history,lemma,context,{source='',now=Date.now(),occurrences=1}={}){
 const e=history[normalize(lemma)];if(!e?.saved||e.status==='known')return false;e.readingEncounters||=[];
 e.rawEncounters||=[];let changed=false;
 if(!e.rawEncounters.some(v=>v.context===context&&v.source===source)){e.rawEncounters.push({context,source,occurrences});changed=true;}
 const day=new Date(now).toLocaleDateString('en-CA');
 if(e.readingEncounters.some(v=>v.context===context&&v.day===day))return changed;
 e.readingEncounters.push({at:now,day,context,source});return true;
}
export function trackedAnnotations(text,history){
 const out=[];
 for(const e of Object.values(history)){
  if(!e.saved||e.status==='known')continue;
  for(const form of new Set([e.lemma,...(e.forms||[])])){
   if(!form)continue;const escaped=form.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
   for(const m of text.matchAll(new RegExp('\\b'+escaped+'\\b','gi')))out.push({word:m[0],lemma:e.lemma,zh:(e.zh||'').split('\n')[0].slice(0,24),kind:'learn',start:m.index,end:m.index+m[0].length,source:'history',status:e.status});
  }
 }
 return out.sort((a,b)=>a.start-b.start||b.end-a.end);
}
export function statusLabel(e){return !e?.saved?'Lookup only · 未收录':({learning:'Consolidating · 待巩固',check:'Ready to check · 待考察',known:'Known · 已掌握'}[e.status]||'Consolidating · 待巩固');}
