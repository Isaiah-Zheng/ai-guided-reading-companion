import {inferTopics,migrateHistory,recordLookup,setLearningStatus,removeLearningWord,recordReadingEncounter,statusLabel} from './learning.js';
import {dictionaryLookup} from './dictionary.js';
import {extractArticle} from './extract.js';
import {articleId} from './core.js';
async function toggleWeb(tabId){await chrome.scripting.executeScript({target:{tabId},files:['web.js']});}
async function importWeb(tabId){
 const [result]=await chrome.scripting.executeScript({target:{tabId},func:extractArticle});if(!result?.result)throw Error('This page cannot be imported. Open the library and paste its text.');
 const article=result.result;article.id=await articleId(article.blocks);const key='article:'+article.id,previous=(await chrome.storage.local.get(key))[key];
 await chrome.storage.local.set({[key]:previous||{...article,created:Date.now(),progress:0,annotations:{},ai:true}});
 await chrome.tabs.create({url:chrome.runtime.getURL('reader.html?article='+article.id)});
}
const activeLookups=new Map();
async function lookup(message){
 if(typeof message.word!=='string'||typeof message.context!=='string'||message.word.length>120||message.context.length>6000||!message.context.includes(message.word))throw Error('Select a word in readable text.');
 if(!message.forceAI){const local=await dictionaryLookup(message.word);return local||{source:'missing',en:'No entry in the local dictionary.',zh:'本地词典暂无此词',value:'Not assessed',explanation:'You can ask the local AI for a contextual explanation.',example:''};}
 const {settings={},wordCache={}}=await chrome.storage.local.get(['settings','wordCache']);const model=settings.model||'qwen3.5:4b',key=JSON.stringify([model,message.word,message.context]);
 if(wordCache[key])return {...wordCache[key],source:'ai'};
 if(activeLookups.has(key))return activeLookups.get(key);
 const task=(async()=>{
  const response=await fetch('http://127.0.0.1:8766/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:message.word,context:message.context,model}),signal:AbortSignal.timeout(210000)});
  const data=await response.json();data.source='ai';if(!response.ok)throw Error(data.detail||'Local model unavailable. Start Local AI and Ollama.');
  const fresh=await chrome.storage.local.get('wordCache'),cache=fresh.wordCache||{};cache[key]=data;while(Object.keys(cache).length>128)delete cache[Object.keys(cache)[0]];await chrome.storage.local.set({wordCache:cache});return data;
 })();activeLookups.set(key,task);try{return await task;}finally{activeLookups.delete(key);}
}
let learningWrites=Promise.resolve();
function updateLearning(event,sender){
 const task=learningWrites.then(async()=>{
  const {history:stored={},settings={}}=await chrome.storage.local.get(['history','settings']),history=migrateHistory(stored);
  if(event.action==='lookup'){
   if(typeof event.context!=='string'||event.context.length>12000||typeof event.a?.word!=='string'||event.a.word.length>120)throw Error('Invalid lookup');
   recordLookup(history,event.a,event.context,{...event.options,interests:settings.interests||[]});
  }else if(event.action==='status')setLearningStatus(history,event.lemma,event.status);
  else if(event.action==='remove')removeLearningWord(history,event.lemma);
  else if(event.action==='encounter')recordReadingEncounter(history,event.lemma,event.context,event.options);
  else throw Error('Invalid learning action');
  await chrome.storage.local.set({history});return {ok:true,history};
 });learningWrites=task.catch(()=>{});return task;
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 (async()=>{
  if(message.type==='lookup')return {data:await lookup(message)};
  if(message.type==='learning-event')return updateLearning(message,sender);
  if(message.type==='word-viewed'){
   const a=await dictionaryLookup(message.word)||{word:message.word,lemma:message.word,zh:''};
   return updateLearning({action:'lookup',a,context:message.context||message.word,options:{source:sender.tab?.url||message.url||'',title:sender.tab?.title||message.title||'Web reading',topics:inferTopics(message.title||sender.tab?.title||'',message.topicText||message.context||'')}},sender);
  }
  if(message.type==='word-status'){
   const a=await dictionaryLookup(message.word)||{word:message.word,lemma:message.word,zh:message.zh||''};
   await updateLearning({action:'lookup',a,context:message.context||message.word,options:{source:sender.tab?.url||'',manual:false}},sender);
   return updateLearning({action:'status',lemma:a.lemma,status:message.status},sender);
  }
  if(sender.tab)throw Error('Unsupported webpage request.');
  if(message.type==='library'){await chrome.tabs.create({url:chrome.runtime.getURL('reader.html?library=1')});return {ok:true};}
  if(message.type==='toggle-web'){await toggleWeb(message.tabId);return {ok:true};}
  if(message.type==='import-web'){await importWeb(message.tabId);return {ok:true};}
  throw Error('Unknown action');
 })().then(respond,error=>respond({error:error.message}));return true;
});
chrome.commands.onCommand.addListener(async command=>{if(command==='toggle-web'){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab?.id)try{await toggleWeb(tab.id);}catch{}}});
