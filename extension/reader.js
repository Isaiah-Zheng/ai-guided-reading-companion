import {dictionaryLookup,dictionaryAnnotations} from './dictionary.js';
import {articleId,localAnnotations,validateAnnotations} from './core.js';
import {domains,inferTopics,eligibility,migrateHistory,recordLookup,setLearningStatus,removeLearningWord,recordReadingEncounter,trackedAnnotations,statusLabel} from './learning.js';
import {lexicon,sample} from './lexicon.js';
import {makePage,migrateBook,currentPage,deletePage,restorePage,movePage} from './pages.js';
const $=id=>document.getElementById(id);
const storage={
 async all(){return globalThis.chrome?.storage?.local?chrome.storage.local.get(null):JSON.parse(localStorage.getItem('reading-tutor')||'{}');},
 async set(values){if(globalThis.chrome?.storage?.local)return chrome.storage.local.set(values);const all=await this.all();localStorage.setItem('reading-tutor',JSON.stringify({...all,...values}));},
 async remove(key){if(globalThis.chrome?.storage?.local)return chrome.storage.local.remove(key);const all=await this.all();delete all[key];localStorage.setItem('reading-tutor',JSON.stringify(all));}
};
const saved=await storage.all(),params=new URLSearchParams(location.search);
let history=migrateHistory(saved.history||{}),settings={font:20,note:10,notes:true,density:'balanced',sections:true,readingMode:'dictionary',model:'qwen3.5:4b',...saved.settings};
let explicitAI=false;
let article=saved['article:'+params.get('article')],page,ready=false,enhanced=true,generation=0,saveTimer,importMode='new',activeWord,wordToken=0;
if(!article){article={...structuredClone(sample),id:await articleId(sample.blocks),created:Date.now(),annotations:{},ai:false};article=saved['article:'+article.id]||article;}
migrateBook(article);
function notice(text){$('status').textContent=text;}
async function persist(){await storage.set({['article:'+article.id]:article});$('save-status').textContent='Saved on this device';}
function safeSave(){persist().catch(()=>{$('save-status').textContent='Could not save — keep your original text';});}
function text(parent,tag,value,cls){const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;parent.append(n);return n;}
function action(parent,label,callback){const n=text(parent,'button',label);n.onclick=callback;return n;}
function applySettings(){document.documentElement.style.setProperty('--font',settings.font+'px');document.documentElement.style.setProperty('--note',settings.note+'px');$('font-size').value=settings.font;$('note-size').value=settings.note;$('font-output').textContent=settings.font+'px';$('note-output').textContent=settings.note+'px';$('notes').checked=settings.notes;$('density').value=settings.density;$('model').value=settings.model;$('ai').checked=!!article.ai;$('reading-mode').value=settings.readingMode;$('suggest-sections').checked=settings.sections;}
function encounterSource(){return {id:article.id+':'+page.id,title:article.title,blocks:page.blocks,url:article.url};}
function annotateLocal(index){page.annotations[index]||={};page.annotations[index].local||=localAnnotations(page.blocks[index].text,lexicon.filter(e=>e.kind!=='entity'||/\b(Rome|Roman|Rubicon|Pompey)\b/i.test(page.raw)));}
function annotations(index){
 const raw=page.blocks[index].text,tracked=[...trackedAnnotations(raw,history),...(page.annotations[index]?.dictionary||[]).filter(a=>a.kind==='learn'&&history[a.lemma]?.saved&&history[a.lemma]?.status!=='known')];
 const hints=[...(page.annotations[index]?.local||[]),...((settings.readingMode==='dictionary'?page.annotations[index]?.dictionary:page.annotations[index]?.ai)||[])].filter(a=>a.kind!=='learn'&&history[a.lemma]?.status!=='known'&&!tracked.some(t=>a.start<t.end&&a.end>t.start));
 return validateAnnotations(raw,[...tracked,...hints]);
}
function currentTopics(){return inferTopics(article.title,page?.raw||'');}
let mutationQueue=Promise.resolve(),observer,encounterTimers=[];
async function mutateLearning(event){
 const task=mutationQueue.then(async()=>{
  if(globalThis.chrome?.runtime?.id){
   const result=await chrome.runtime.sendMessage({type:'learning-event',...event});if(result.error)throw Error(result.error);history=result.history;
  }else{
   history=migrateHistory((await storage.all()).history||{});
   applyLearningEvent(history,event);await storage.set({history});
  }
  countWords();return history;
 });mutationQueue=task.catch(()=>{});return task;
}
function applyLearningEvent(target,event){
 if(event.action==='lookup')return recordLookup(target,event.a,event.context,event.options);
 if(event.action==='status')return setLearningStatus(target,event.lemma,event.status);
 if(event.action==='remove')return removeLearningWord(target,event.lemma);
 if(event.action==='encounter')return recordReadingEncounter(target,event.lemma,event.context,event.options);
}
function observeReading(){
 observer?.disconnect();for(const timer of encounterTimers)clearTimeout(timer);encounterTimers=[];
 if(!enhanced)return;
 observer=new IntersectionObserver(entries=>{
  for(const item of entries){
   clearTimeout(item.target._readingTimer);
   if(!item.isIntersecting||document.visibilityState!=='visible')continue;
   const targetPage=page,index=Number(item.target.dataset.index),context=page.blocks[index].text,source=article.id+':'+page.id;
   const timer=setTimeout(async()=>{
    if(page!==targetPage||document.visibilityState!=='visible'||document.querySelector('dialog[open]')||!item.target.isConnected)return;
    const lemmas=[...new Set(annotations(index).filter(a=>a.kind==='learn').map(a=>a.lemma))];
    for(const lemma of lemmas){
     const occurrences=annotations(index).filter(a=>a.kind==='learn'&&a.lemma===lemma).length;
     if(recordReadingEncounter(structuredClone(history),lemma,context,{source,occurrences}))await mutateLearning({action:'encounter',lemma,context,options:{source,occurrences}});
    }
   },2000);item.target._readingTimer=timer;encounterTimers.push(timer);
  }
 },{threshold:0.1});
 for(const node of $('article').querySelectorAll('p[data-index]'))observer.observe(node);
}
function placeWordCard(anchor){
 const box=$('word-dialog'),bounds=$('article').getBoundingClientRect(),width=300;
 const right=innerWidth-bounds.right-20,left=bounds.left-20;
 box.style.width=Math.min(width,innerWidth-24)+'px';box.style.maxHeight='65vh';
 if(right>=width){box.style.left=(bounds.right+12)+'px';box.style.top=Math.max(85,Math.min(anchor?.top||100,innerHeight-box.offsetHeight-12))+'px';box.style.bottom='auto';}
 else if(left>=width){box.style.left=(bounds.left-width-12)+'px';box.style.top=Math.max(85,Math.min(anchor?.top||100,innerHeight-box.offsetHeight-12))+'px';box.style.bottom='auto';}
 else{box.style.left=Math.max(12,innerWidth-width-12)+'px';box.style.top='auto';box.style.bottom='12px';box.style.maxHeight='40vh';}
}
function pointWord(event){
 if(event.target.closest('button,a,input,textarea,[contenteditable=true]'))return null;
 let node,offset;const p=document.caretPositionFromPoint?.(event.clientX,event.clientY);
 if(p){node=p.offsetNode;offset=p.offset;}else{const range=document.caretRangeFromPoint?.(event.clientX,event.clientY);node=range?.startContainer;offset=range?.startOffset;}
 if(node?.nodeType!==Node.TEXT_NODE||!$('article').contains(node))return null;
 const value=node.textContent;let start=offset,end=offset;
 while(start>0&&/[A-Za-z’'-]/.test(value[start-1]))start--;
 while(end<value.length&&/[A-Za-z’'-]/.test(value[end]))end++;
 const word=value.slice(start,end);if(!/[A-Za-z]{2}/.test(word))return null;
 const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);const rect=range.getBoundingClientRect();
 if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return null;
 return {word,index:Number(node.parentElement.closest('[data-index]').dataset.index),rect};
}
$('article').addEventListener('click',event=>{
 if(!ready||!getSelection().isCollapsed)return;const hit=pointWord(event);if(hit)openWord({word:hit.word,lemma:hit.word,zh:'',kind:'gloss'},hit.index,hit.rect);
});
$('article').addEventListener('mouseup',event=>{
 const selection=getSelection();if(selection.isCollapsed||event.target.closest('button'))return;
 const word=selection.toString().trim(),node=selection.anchorNode?.parentElement?.closest('[data-index]'),end=selection.focusNode?.parentElement?.closest('[data-index]');
 if(!node||end!==node||word.length>120||word.split(/\s+/).length<2||word.split(/\s+/).length>12)return;
 openWord({word,lemma:word,zh:'',kind:'gloss'},Number(node.dataset.index),selection.getRangeAt(0).getBoundingClientRect());
});
function countWords(){$('word-count').textContent=Object.values(history).filter(w=>w.saved).length;}
function render(){
 if(!ready)return;
 $('article').replaceChildren();const entities=new Set();
 page.blocks.forEach((block,index)=>{
  if(enhanced)for(const section of page.outline?.sections||[])if(section.index===index){const heading=text($('article'),'h'+section.level,section.title);heading.title='AI suggested heading · click to rename';heading.className='suggested-heading';heading.onclick=async()=>{const title=prompt('Edit suggested heading',section.title);if(title!==null){section.title=title.slice(0,100);await persist();render();}};}
  const node=text($('article'),block.type==='heading'?'h'+(block.level||2):'p','');node.dataset.index=index;
  if(!enhanced||block.type==='heading'){node.textContent=enhanced?(block.displayTitle||block.text):block.text;if(block.type==='heading')node.onclick=async()=>{const title=prompt('Edit display heading (original text stays saved)',block.displayTitle||block.text);if(title!==null){block.displayTitle=title.slice(0,100);await persist();render();}};return;}
  let at=0,notes=0;
  for(const a of annotations(index)){
   node.append(document.createTextNode(block.text.slice(at,a.start)));let show=true;
   if(a.kind==='entity'){if(entities.has(a.lemma))show=false;else entities.add(a.lemma);}
   if(a.kind==='gloss'&&notes>=(settings.density==='light'?1:3))show=false;
   if(show){const b=text(node,'button',a.word,'annotation '+a.kind);b.setAttribute('aria-label',a.word+': open explanation');b.onclick=()=>openWord(a,index,b.getBoundingClientRect());let hover;
    b.onmouseenter=()=>{hover=setTimeout(()=>showHover(a,b),400);};b.onmouseleave=()=>{clearTimeout(hover);$('hover-card').hidden=true;};
    if(a.kind!=='learn'&&settings.notes&&notes<(settings.density==='light'?1:3)){text(b,'span',' ('+a.zh+')','note');notes++;}
   }else node.append(document.createTextNode(a.word));at=a.end;
  }
  node.append(document.createTextNode(block.text.slice(at)));
 });
 observeReading();
}
function showHover(a,node){const card=$('hover-card');card.replaceChildren();text(card,'strong',a.word);text(card,'p',a.en||'');text(card,'p',a.zh);text(card,'small','Click for learning value and your status');const r=node.getBoundingClientRect();card.style.left=Math.min(r.left,innerWidth-300)+'px';card.style.top=Math.min(r.bottom+8,innerHeight-170)+'px';card.hidden=false;}
async function backend(path,payload,model=settings.model){const response=await fetch('http://127.0.0.1:8766'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,model}),signal:AbortSignal.timeout(210000)});const data=await response.json();if(!response.ok)throw Error(data.detail||'Local AI unavailable. Start Local AI and Ollama.');return data;}
function pageControls(){const index=article.pages.indexOf(page);$('page-label').textContent=page?'Page '+(index+1)+' of '+article.pages.length+(page.label?' · '+page.label:''):'No saved pages';$('previous-page').disabled=index<=0;$('next-page').disabled=index<0||index>=article.pages.length-1;}
async function loadPage(){
 const token=++generation;$('word-dialog').close();page=currentPage(article);ready=false;$('article').replaceChildren();$('article').hidden=true;$('loading').hidden=false;$('retry-page').hidden=true;$('read-offline').hidden=true;$('hover-card').hidden=true;
 $('title').textContent=article.title;document.title=article.title+' · Reading Tutor';$('source').textContent=article.url?'Imported webpage':'Your saved book';$('source').removeAttribute('href');applySettings();pageControls();countWords();
 if(!page){$('loading-message').textContent='No pages yet. Paste text or restore a deleted page.';$('reading-time').textContent='';return;}
 $('reading-time').textContent=Math.max(1,Math.ceil(page.raw.split(/\s+/).length/220))+' min read';
 if(page.aiModel!==settings.model){page.annotations={};page.details={};delete page.outline;page.aiModel=settings.model;}
 try{
  for(let index=0;index<page.blocks.length;index++){annotateLocal(index);if(settings.readingMode==='dictionary'&&page.blocks[index].type!=='heading'){page.annotations[index].dictionary=await dictionaryAnnotations(page.blocks[index].text,history);if(token!==generation)return;}}
  if(article.ai&&settings.readingMode==='ai'){
   const target=page,model=settings.model,indexes=target.blocks.map((b,i)=>b.type==='heading'?null:i).filter(i=>i!==null);
   if(settings.sections&&!target.outline&&!target.blocks.some(b=>b.type==='heading')&&indexes.length>2){$('loading-message').textContent='Finding suggested section headings…';target.outline=await backend('/outline',{blocks:target.blocks.map((b,index)=>({index,text:b.text.slice(0,250)})).slice(0,40)},model);if(token!==generation)return;await persist();}
   for(let step=0;step<indexes.length;step++){
    if(token!==generation)return;const index=indexes[step];$('loading-message').textContent='Preparing page '+(article.pages.indexOf(target)+1)+' · '+(step+1)+' / '+indexes.length+' reading blocks…';
    if(target.annotations[index]?.ai)continue;
    const result=await backend('/analyze',{title:article.title,paragraphs:[{index,text:target.blocks[index].text}]},model);if(token!==generation)return;
    const record=result.paragraphs?.find(p=>p.index===index);if(!record)throw Error('The model omitted a reading block. Please retry.');
    target.annotations[index].ai=validateAnnotations(target.blocks[index].text,record.annotations);await persist();
   }
  }
  if(token!==generation)return;reveal();notice(settings.readingMode==='dictionary'?'Page ready · local dictionary. Click a word or select a phrase; AI is optional.':article.ai?'Page ready · local AI annotations loaded.':'AI is off · local glossary only.');await persist();
 }catch(error){if(token!==generation)return;$('loading-message').textContent='Could not finish this page. '+error.message;$('retry-page').hidden=false;$('read-offline').hidden=false;notice('Your pasted page is saved. Retry analysis when ready.');}
}
function reveal(){ready=true;$('loading').hidden=true;$('article').hidden=false;render();const current=page;requestAnimationFrame(()=>{if(page!==current)return;scrollTo(0,(page.progress||0)*Math.max(0,document.documentElement.scrollHeight-innerHeight));});}
$('retry-page').onclick=loadPage;$('read-offline').onclick=()=>{generation++;reveal();notice('Showing saved text without waiting for AI.');};
async function navigate(direction){const index=article.pages.indexOf(page),next=article.pages[index+direction];if(!next)return;clearTimeout(saveTimer);article.currentPageId=next.id;await persist();loadPage();}
$('previous-page').onclick=()=>navigate(-1);$('next-page').onclick=()=>navigate(1);
function updateProgress(){if(!ready||!page)return;const ratio=Math.min(1,Math.max(0,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)));page.progress=ratio;article.progress=ratio;clearTimeout(saveTimer);saveTimer=setTimeout(safeSave,400);}
function openImport(mode){importMode=mode;const append=mode==='append';$('import-heading').textContent=append?'Add a page to '+article.title:'Start a new book';$('import-help').textContent='One paste becomes one saved page. Choose where it belongs.';$('import-title').value=append?article.title:'';$('import-title').readOnly=append;$('import-text').value='';$('insert-label').hidden=!append;$('insert-position').replaceChildren();for(let i=0;i<=article.pages.length;i++){const option=text($('insert-position'),'option',i===0?'Before page 1':i===article.pages.length?'At the end (after page '+i+')':'After page '+i+' / before page '+(i+1));option.value=String(i);}$('insert-position').value=String(Math.max(0,article.pages.indexOf(page)+1));$('import-submit').textContent=append?'Save new page →':'Save book →';$('import-dialog').showModal();$('import-text').focus();}
$('import-open').onclick=()=>openImport('new');$('append-open').onclick=()=>openImport('append');$('settings-open').onclick=()=>$('settings-dialog').showModal();
$('import-form').onsubmit=async e=>{
 e.preventDefault();const raw=$('import-text').value;if(!raw.trim())return;const button=$('import-submit');button.disabled=true;
 try{clearTimeout(saveTimer);await persist();const added=makePage(raw);let next;
  if(importMode==='append'){const position=Number($('insert-position').value);if(!Number.isInteger(position)||position<0||position>article.pages.length)throw Error('Choose an insertion position.');next={...article,pages:[...article.pages.slice(0,position),added,...article.pages.slice(position)],currentPageId:added.id,updated:Date.now()};}
  else{const id=crypto.randomUUID();next={id,title:$('import-title').value.trim()||'Untitled book',pages:[added],currentPageId:added.id,trash:[],created:Date.now(),ai:true};}
  await storage.set({['article:'+next.id]:next});article=next;window.history.replaceState(null,'','?article='+article.id);$('import-dialog').close();loadPage();
 }catch(error){notice('Could not save. Your existing pages are unchanged; keep the pasted text and retry.');}finally{button.disabled=false;}
};
document.addEventListener('paste',e=>{if(e.target.closest('input,textarea,[contenteditable=true]')||document.querySelector('dialog[open]'))return;const raw=e.clipboardData?.getData('text/plain');if(!raw)return;e.preventDefault();openImport(article.sample?'new':'append');$('import-text').value=raw;});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&$('import-dialog').open){e.preventDefault();$('import-form').requestSubmit();}});
function setMode(value){enhanced=value;$('enhanced').setAttribute('aria-pressed',String(value));$('original').setAttribute('aria-pressed',String(!value));render();}
$('enhanced').onclick=()=>setMode(true);$('original').onclick=()=>setMode(false);
for(const id of ['font-size','note-size','notes','density'])$(id).oninput=async()=>{settings={...settings,font:Number($('font-size').value),note:Number($('note-size').value),notes:$('notes').checked,density:$('density').value};applySettings();render();await storage.set({settings});};
$('model').onchange=async()=>{settings.model=$('model').value;await storage.set({settings});loadPage();};
$('reading-mode').onchange=async()=>{settings.readingMode=$('reading-mode').value;await storage.set({settings});loadPage();};
$('ai').onchange=async()=>{article.ai=$('ai').checked;await persist();loadPage();};
$('suggest-sections').onchange=async()=>{settings.sections=$('suggest-sections').checked;await storage.set({settings});loadPage();};
function entry(parent,title,subtitle){const row=text(parent,'div','','entry');const body=text(row,'div','');text(body,'p',title,'entry-title');text(body,'p',subtitle,'fine');return row;}
function showPages(){const list=$('pages-list');list.replaceChildren();article.pages.forEach((p,i)=>{const row=entry(list,'Page '+(i+1)+(p.label?' · '+p.label:''),p.raw.trim().slice(0,75)+'…');const buttons=text(row,'div','');
 action(buttons,'Read',async()=>{article.currentPageId=p.id;await persist();$('pages-dialog').close();loadPage();});
 action(buttons,'Rename',async()=>{const label=prompt('Page label',p.label||'');if(label===null)return;p.label=label.slice(0,100);await persist();showPages();pageControls();});
 action(buttons,'↑',async()=>{movePage(article,p.id,-1);await persist();showPages();pageControls();});action(buttons,'↓',async()=>{movePage(article,p.id,1);await persist();showPages();pageControls();});
 action(buttons,'Delete',async()=>{deletePage(article,p.id);generation++;await persist();showPages();loadPage();});
 });
 $('trash-list').replaceChildren();for(const p of article.trash){const row=entry($('trash-list'),p.label||'Deleted page',p.raw.slice(0,65));action(row,'Restore',async()=>{restorePage(article,p.id);await persist();showPages();loadPage();});}
}
$('pages-open').onclick=()=>{showPages();$('pages-dialog').showModal();};
$('history-open').onclick=async()=>{const list=$('history-list');list.replaceChildren();for(const book of Object.values(await storage.all()).filter(a=>a?.id&&(a.pages||a.blocks)).sort((a,b)=>b.created-a.created)){const row=entry(list,book.title,(book.pages?.length||1)+' saved page(s)');action(row,'Read',async()=>{clearTimeout(saveTimer);await persist();article=migrateBook(book);window.history.replaceState(null,'','?article='+book.id);$('history-dialog').close();loadPage();});}$('history-dialog').showModal();};
function briefMeaning(value,limit){return String(value||'').split('\n').slice(0,2).join('; ').slice(0,limit);}
function wordStatus(a){return statusLabel(history[a.lemma]);}
function statusButtons(a){
 const box=$('word-status');box.replaceChildren();const e=history[a.lemma];text(box,'p',wordStatus(a));
 if(e?.lookups?.length)text(box,'small',e.lookups.length+' lookup(s) · '+(e.readingEncounters?.length||0)+' reading encounters');
 const buttons=text(box,'div','','word-actions');
 for(const [label,status] of [[e?.saved?'Keep learning':'Keep this word','learning'],['Known','known']]){
  action(buttons,label,async()=>{await mutateLearning({action:'status',lemma:a.lemma,status});statusButtons(a);render();});
 }
 if(e?.saved)action(buttons,'Remove / Undo',async()=>{await mutateLearning({action:'remove',lemma:a.lemma});statusButtons(a);render();});
}
async function openWord(a,index,anchor){
 const targetPage=page,source=encounterSource(),request=++wordToken;
 explicitAI=false;activeWord=null;$('word-title').textContent=a.word;$('word-meaning').textContent='Looking in the local dictionary…';$('word-history').textContent='';$('word-ipa').textContent='';$('word-value').textContent='';$('word-status').replaceChildren();$('knowledge').replaceChildren();$('word-details').open=false;$('word-detail-body').replaceChildren();
 if(!$('word-dialog').open)$('word-dialog').show();placeWordCard(anchor);
 try{
  const local=await dictionaryLookup(a.word);
  if(request!==wordToken||page!==targetPage||!$('word-dialog').open)return;
  a={...a,...(local||{}),zh:local?.zh||a.zh||'本地词典暂无此词',lemma:local?.lemma||a.lemma};
  activeWord={a,index,page:targetPage,source};const options={source:source.id,title:source.title,interests:settings.interests||[],topics:currentTopics()};
  await mutateLearning({action:'lookup',a,context:targetPage.blocks[index].text,options});
  if(request!==wordToken||page!==targetPage||!$('word-dialog').open)return;
  $('word-history').textContent=history[a.lemma]?.reason||eligibility(a,settings.interests||[],currentTopics()).reason;
  $('word-ipa').textContent=[a.pos,a.ipa].filter(Boolean).join(' ');$('word-meaning').textContent=briefMeaning(a.zh,100)+' — '+briefMeaning(a.en,180);$('word-value').textContent=a.value||'You can keep this word manually.';statusButtons(a);
  text($('knowledge'),'small','Local dictionary · general meanings');
  action($('knowledge'),'Explain in this context (AI)',async()=>{
   explicitAI=true;const token=++wordToken,body=$('word-detail-body');body.replaceChildren();$('word-details').open=true;text(body,'p','Loading local AI explanation…');
   try{const result=await backend('/lookup',{word:a.word,context:targetPage.blocks[index].text});if(token!==wordToken)return;body.replaceChildren();for(const key of ['en','zh','value','explanation'])if(result[key])text(body,'p',result[key]);if(result.example)text(body,'p','Example: '+result.example);}
   catch(error){if(token===wordToken){body.replaceChildren();text(body,'p',error.message+' The local dictionary is still available.');}}
  });
  render();placeWordCard(anchor);
 }catch(error){if(request===wordToken)$('word-meaning').textContent=error.message;}
}
$('word-dialog').addEventListener('close',()=>{wordToken++;activeWord=null;});
$('word-details').addEventListener('toggle',()=>{
 if(!$('word-details').open||!activeWord||explicitAI)return;
 const a=activeWord.a,body=$('word-detail-body');body.replaceChildren();text(body,'p',a.zh);if(a.en)text(body,'p',a.en);text(body,'p',a.detail||a.explanation||'Use the optional AI button for a contextual explanation.');if(a.example)text(body,'p',a.example);
});
let checkLemma;
async function startCheck(lemma){
 checkLemma=lemma;await mutateLearning({action:'status',lemma,status:'check'});const e=history[lemma];
 $('check-word').textContent=e.word||lemma;$('check-context').textContent=e.context||'';$('check-meaning').textContent=e.zh||'No saved definition. Use the word card if needed.';
 $('check-meaning').hidden=true;$('check-answer').hidden=true;$('check-reveal').hidden=false;$('words-dialog').close();$('word-dialog').close();$('check-dialog').showModal();render();
}
$('check-reveal').onclick=()=>{$('check-meaning').hidden=false;$('check-answer').hidden=false;$('check-reveal').hidden=true;};
async function finishCheck(status){await mutateLearning({action:'status',lemma:checkLemma,status});$('check-dialog').close();render();notice(status==='known'?'Marked known by your recognition check.':'Back to reading consolidation. Earlier history is preserved.');}
$('check-known').onclick=()=>finishCheck('known');$('check-unsure').onclick=()=>finishCheck('learning');
function showWords(){
 const list=$('words-list');list.replaceChildren();
 for(const w of Object.values(history).filter(w=>w.saved)){
  const row=entry(list,w.lemma+' · '+briefMeaning(w.zh,90),statusLabel(w)+' · '+(w.lookups?.length||0)+' lookup(s) · '+(w.readingEncounters?.length||0)+' reading context/day encounter(s)');
  const buttons=text(row,'div','','word-actions');
  if(w.status!=='known')action(buttons,w.status==='check'?'Continue check':'Check when ready',()=>startCheck(w.lemma));
  else action(buttons,'Need more reading',async()=>{await mutateLearning({action:'status',lemma:w.lemma,status:'learning'});showWords();render();});
  action(buttons,'Remove',async()=>{await mutateLearning({action:'remove',lemma:w.lemma});showWords();render();});
 }
 if(!list.children.length)text(list,'p','No words yet. Click while reading; useful words can enter here.');
}
$('words-open').onclick=()=>{showWords();$('words-dialog').showModal();};
for(const [key,d] of Object.entries(domains)){
 const label=text($('interest-options'),'label','','check'),input=document.createElement('input');input.type='checkbox';input.value=key;input.checked=(settings.interests||[]).includes(key);label.append(input,document.createTextNode(d.label));
}
$('settings-dialog').addEventListener('close',async()=>{if(!settings.interestsChosen){settings.interestsChosen=true;await storage.set({settings});}});
$('save-interests').onclick=async()=>{
 settings.interests=[...$('interest-options').querySelectorAll('input:checked')].map(n=>n.value);settings.interestsChosen=true;await storage.set({settings});$('settings-dialog').close();notice('Interests saved. Current article topics also influence collection; you can change interests in Aa.');
};
window.addEventListener('resize',()=>{if($('word-dialog').open)placeWordCard();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){observer?.disconnect();for(const timer of encounterTimers)clearTimeout(timer);}else if(ready)observeReading();});
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.close')?.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(ready)observeReading();});}
globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.history){history=migrateHistory(changes.history.newValue||{});countWords();render();}});
window.addEventListener('scroll',updateProgress,{passive:true});window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);safeSave();});
await persist();loadPage();if(!settings.interestsChosen){notice('Choose interests in Aa, or skip and let each article guide collection.');$('settings-dialog').showModal();}if(params.get('error'))notice(params.get('error'));

if(params.has("library"))$("history-open").onclick();
