import {articleId,localAnnotations,validateAnnotations,recordEncounter,viewDetailed} from './core.js';
import {lexicon,sample} from './lexicon.js';
import {makePage,migrateBook,currentPage,deletePage,restorePage,movePage} from './pages.js';
const $=id=>document.getElementById(id);
const storage={
 async all(){return globalThis.chrome?.storage?.local?chrome.storage.local.get(null):JSON.parse(localStorage.getItem('reading-tutor')||'{}');},
 async set(values){if(globalThis.chrome?.storage?.local)return chrome.storage.local.set(values);const all=await this.all();localStorage.setItem('reading-tutor',JSON.stringify({...all,...values}));},
 async remove(key){if(globalThis.chrome?.storage?.local)return chrome.storage.local.remove(key);const all=await this.all();delete all[key];localStorage.setItem('reading-tutor',JSON.stringify(all));}
};
const saved=await storage.all(),params=new URLSearchParams(location.search);
let history=saved.history||{},settings={font:20,note:10,notes:true,density:'balanced',sections:true,model:'qwen3.5:4b',...saved.settings};
let article=saved['article:'+params.get('article')],page,ready=false,enhanced=true,generation=0,saveTimer,importMode='new',activeWord,wordToken=0;
if(!article){article={...structuredClone(sample),id:await articleId(sample.blocks),created:Date.now(),annotations:{},ai:false};article=saved['article:'+article.id]||article;}
migrateBook(article);
function notice(text){$('status').textContent=text;}
async function persist(){await storage.set({['article:'+article.id]:article,history});$('save-status').textContent='Saved on this device';}
function safeSave(){persist().catch(()=>{$('save-status').textContent='Could not save — keep your original text';});}
function text(parent,tag,value,cls){const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;parent.append(n);return n;}
function action(parent,label,callback){const n=text(parent,'button',label);n.onclick=callback;return n;}
function applySettings(){document.documentElement.style.setProperty('--font',settings.font+'px');document.documentElement.style.setProperty('--note',settings.note+'px');$('font-size').value=settings.font;$('note-size').value=settings.note;$('font-output').textContent=settings.font+'px';$('note-output').textContent=settings.note+'px';$('notes').checked=settings.notes;$('density').value=settings.density;$('model').value=settings.model;$('ai').checked=!!article.ai;$('suggest-sections').checked=settings.sections;}
function encounterSource(){return {id:article.id+':'+page.id,title:article.title,blocks:page.blocks,url:article.url};}
function annotateLocal(index){page.annotations[index]||={};page.annotations[index].local||=localAnnotations(page.blocks[index].text,lexicon.filter(e=>e.kind!=='entity'||/\b(Rome|Roman|Rubicon|Pompey)\b/i.test(page.raw)));}
function annotations(index){return validateAnnotations(page.blocks[index].text,page.annotations[index]?.ai||page.annotations[index]?.local||[]);}
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
   if(show){const b=text(node,'button',a.word,'annotation '+a.kind);b.setAttribute('aria-label',a.word+': open explanation');b.onclick=()=>openWord(a,index);let hover;
    b.onmouseenter=()=>{hover=setTimeout(()=>showHover(a,b),400);};b.onmouseleave=()=>{clearTimeout(hover);$('hover-card').hidden=true;};
    if(a.kind!=='learn'&&settings.notes&&notes<(settings.density==='light'?1:3)){text(b,'span',' ('+a.zh+')','note');notes++;}
   }else node.append(document.createTextNode(a.word));at=a.end;
  }
  node.append(document.createTextNode(block.text.slice(at)));
 });
}
function showHover(a,node){const card=$('hover-card');card.replaceChildren();text(card,'strong',a.word);text(card,'p',a.en||'');text(card,'p',a.zh);text(card,'small','Click for learning value and your status');const r=node.getBoundingClientRect();card.style.left=Math.min(r.left,innerWidth-300)+'px';card.style.top=Math.min(r.bottom+8,innerHeight-170)+'px';card.hidden=false;}
async function backend(path,payload,model=settings.model){const response=await fetch('http://127.0.0.1:8766'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,model}),signal:AbortSignal.timeout(210000)});const data=await response.json();if(!response.ok)throw Error(data.detail||'Local AI unavailable. Start Local AI and Ollama.');return data;}
function pageControls(){const index=article.pages.indexOf(page);$('page-label').textContent=page?'Page '+(index+1)+' of '+article.pages.length+(page.label?' · '+page.label:''):'No saved pages';$('previous-page').disabled=index<=0;$('next-page').disabled=index<0||index>=article.pages.length-1;}
async function loadPage(){
 const token=++generation;page=currentPage(article);ready=false;$('article').replaceChildren();$('article').hidden=true;$('loading').hidden=false;$('retry-page').hidden=true;$('read-offline').hidden=true;$('hover-card').hidden=true;
 $('title').textContent=article.title;document.title=article.title+' · Reading Tutor';$('source').textContent=article.url?'Imported webpage':'Your saved book';$('source').removeAttribute('href');applySettings();pageControls();countWords();
 if(!page){$('loading-message').textContent='No pages yet. Paste text or restore a deleted page.';$('reading-time').textContent='';return;}
 $('reading-time').textContent=Math.max(1,Math.ceil(page.raw.split(/\s+/).length/220))+' min read';
 if(page.aiModel!==settings.model){page.annotations={};page.details={};delete page.outline;page.aiModel=settings.model;}
 try{
  for(let index=0;index<page.blocks.length;index++)annotateLocal(index);
  if(article.ai){
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
  if(token!==generation)return;reveal();notice(article.ai?'Page ready · local AI annotations loaded.':'AI is off · local glossary only.');await persist();
 }catch(error){if(token!==generation)return;$('loading-message').textContent='Could not finish this page. '+error.message;$('retry-page').hidden=false;$('read-offline').hidden=false;notice('Your pasted page is saved. Retry analysis when ready.');}
}
function reveal(){ready=true;$('loading').hidden=true;$('article').hidden=false;render();const current=page;requestAnimationFrame(()=>{if(page!==current)return;scrollTo(0,(page.progress||0)*Math.max(0,document.documentElement.scrollHeight-innerHeight));});}
$('retry-page').onclick=loadPage;$('read-offline').onclick=()=>{generation++;reveal();notice('Showing saved text without waiting for AI.');};
async function navigate(direction){const index=article.pages.indexOf(page),next=article.pages[index+direction];if(!next)return;clearTimeout(saveTimer);article.currentPageId=next.id;await persist();loadPage();}
$('previous-page').onclick=()=>navigate(-1);$('next-page').onclick=()=>navigate(1);
function updateProgress(){if(!ready||!page)return;const ratio=Math.min(1,Math.max(0,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)));page.progress=ratio;article.progress=ratio;$('progress').style.width=ratio*100+'%';$('progress-label').textContent=Math.round(ratio*100)+'% of this page';clearTimeout(saveTimer);saveTimer=setTimeout(safeSave,400);}
function openImport(mode){importMode=mode;const append=mode==='append';$('import-heading').textContent=append?'Add a page to '+article.title:'Start a new book';$('import-help').textContent='One paste becomes one saved page. Choose where it belongs.';$('import-title').value=append?article.title:'';$('import-title').readOnly=append;$('import-text').value='';$('insert-label').hidden=!append;$('insert-position').replaceChildren();for(let i=0;i<=article.pages.length;i++){const option=text($('insert-position'),'option',i===0?'Before page 1':i===article.pages.length?'At the end (after page '+i+')':'After page '+i+' / before page '+(i+1));option.value=String(i);}$('insert-position').value=String(Math.max(0,article.pages.indexOf(page)+1));$('import-submit').textContent=append?'Save new page →':'Save book →';$('import-dialog').showModal();$('import-text').focus();}
$('import-open').onclick=()=>openImport('new');$('append-open').onclick=()=>openImport('append');$('settings-open').onclick=()=>$('settings-dialog').showModal();
$('import-form').onsubmit=async e=>{
 e.preventDefault();const raw=$('import-text').value;if(!raw.trim())return;const button=$('import-submit');button.disabled=true;
 try{clearTimeout(saveTimer);await persist();const added=makePage(raw);let next;
  if(importMode==='append'){const position=Number($('insert-position').value);if(!Number.isInteger(position)||position<0||position>article.pages.length)throw Error('Choose an insertion position.');next={...article,pages:[...article.pages.slice(0,position),added,...article.pages.slice(position)],currentPageId:added.id,updated:Date.now()};}
  else{const id=crypto.randomUUID();next={id,title:$('import-title').value.trim()||'Untitled book',pages:[added],currentPageId:added.id,trash:[],created:Date.now(),ai:true};}
  await storage.set({['article:'+next.id]:next,history});article=next;window.history.replaceState(null,'','?article='+article.id);$('import-dialog').close();loadPage();
 }catch(error){notice('Could not save. Your existing pages are unchanged; keep the pasted text and retry.');}finally{button.disabled=false;}
};
document.addEventListener('paste',e=>{if(e.target.closest('input,textarea,[contenteditable=true]')||document.querySelector('dialog[open]'))return;const raw=e.clipboardData?.getData('text/plain');if(!raw)return;e.preventDefault();openImport(article.sample?'new':'append');$('import-text').value=raw;});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&$('import-dialog').open){e.preventDefault();$('import-form').requestSubmit();}});
function setMode(value){enhanced=value;$('enhanced').setAttribute('aria-pressed',String(value));$('original').setAttribute('aria-pressed',String(!value));render();}
$('enhanced').onclick=()=>setMode(true);$('original').onclick=()=>setMode(false);
for(const id of ['font-size','note-size','notes','density'])$(id).oninput=async()=>{settings={...settings,font:Number($('font-size').value),note:Number($('note-size').value),notes:$('notes').checked,density:$('density').value};applySettings();render();await storage.set({settings});};
$('model').onchange=async()=>{settings.model=$('model').value;await storage.set({settings});loadPage();};
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
function wordStatus(a){return history[a.lemma]?.status||(history[a.lemma]?.viewed?'Previously viewed':'New');}
function statusButtons(a){$('word-status').replaceChildren();text($('word-status'),'p','Your status: '+wordStatus(a));for(const [label,status] of [['Learning','learning'],['Known','known']])action($('word-status'),label,async()=>{recordEncounter(history,a,encounterSource(),activeWord.index);history[a.lemma].status=status;history[a.lemma].saved=true;await persist();statusButtons(a);countWords();});}
function openWord(a,index){activeWord={a,index,page,source:encounterSource()};wordToken++;$('word-title').textContent=a.word;$('word-history').textContent='Your status: '+wordStatus(a);$('word-ipa').textContent=[a.pos,a.ipa].filter(Boolean).join(' ');$('word-meaning').textContent=a.zh+' — '+(a.en||'');$('word-value').textContent='Learning value: '+(a.value||'Contextual reading support');$('word-details').open=false;$('word-detail-body').replaceChildren();$('knowledge').replaceChildren();statusButtons(a);$('word-dialog').showModal();}
$('word-details').addEventListener('toggle',async()=>{
 if(!$('word-details').open||!activeWord)return;const selected=activeWord,{a,index}=selected,token=++wordToken,body=$('word-detail-body');viewDetailed(history,a,selected.source,index);await persist();countWords();body.replaceChildren();
 const key=a.lemma+':'+index+':'+a.start;let result=selected.page.details[key];
 if(!result&&a.detail)result={explanation:a.detail,example:a.example};
 if(!result&&article.ai){text(body,'p','Loading local explanation…');try{result=await backend('/detail',{word:a.word,context:selected.page.blocks[index].text});selected.page.details[key]=result;await persist();}catch(error){if(token===wordToken){body.replaceChildren();text(body,'p',error.message);}return;}}
 if(token!==wordToken)return;body.replaceChildren();text(body,'p',result?.explanation||a.en||'No further local explanation.');if(result?.example)text(body,'p','Example: '+result.example,'fine');
});
$('words-open').onclick=()=>{const list=$('words-list');list.replaceChildren();for(const w of Object.values(history).filter(w=>w.saved)){const row=entry(list,w.lemma+' · '+w.zh,w.status||'Previously viewed');action(row,'Remove',async()=>{w.saved=false;await persist();row.remove();countWords();});}$('words-dialog').showModal();};
for(const dialog of document.querySelectorAll('dialog'))dialog.querySelector('.close')?.addEventListener('click',()=>dialog.close());
globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.history){history=changes.history.newValue||{};countWords();}});
window.addEventListener('scroll',updateProgress,{passive:true});window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);safeSave();});
await persist();loadPage();if(params.get('error'))notice(params.get('error'));

if(params.has("library"))$("history-open").onclick();
