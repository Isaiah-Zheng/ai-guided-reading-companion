(()=>{
 if(window.__readingTutor){window.__readingTutor.toggle();return;}
 let enabled=true,timer,token=0,pinned=false,current=null,lastKey='';
 const host=document.createElement('div');host.style.cssText='position:fixed;z-index:2147483647;inset:0 auto auto 0;';const shadow=host.attachShadow({mode:'closed'});
 const style=document.createElement('style');style.textContent=':host{all:initial}section{font:14px/1.6 system-ui;color:#29362c;background:#fffef9;padding:18px;border:1px solid #d4dbd1;border-radius:12px;box-shadow:0 12px 50px #0002;width:300px;max-height:65vh;overflow:auto}h3{font:22px Georgia;margin:0 0 8px}p{margin:8px 0}small{color:#667365}button{font:12px system-ui;border:1px solid #ccd4c9;background:#f1f5ee;padding:7px;margin:4px;border-radius:6px;cursor:pointer}';shadow.append(style);
 const box=document.createElement('section');box.hidden=true;shadow.append(box);document.documentElement.append(host);
 function hide(){box.hidden=true;current=null;lastKey='';token++;pinned=false;clearTimeout(timer);}
 function paragraph(textNode,word,offset){const text=(textNode.parentElement.closest('p,li,blockquote,article')||textNode.parentElement).textContent;const found=text.indexOf(word);if(text.length<=1200)return text;const at=found<0?offset:found;return text.slice(Math.max(0,at-450),Math.min(text.length,at+650));}
 function hit(event){
  if(event.composedPath().includes(host)||event.target.closest('input,textarea,select,button,a,[contenteditable=true]'))return null;
  let node,offset;
  if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(event.clientX,event.clientY);node=p?.offsetNode;offset=p?.offset;}
  else{const range=document.caretRangeFromPoint?.(event.clientX,event.clientY);node=range?.startContainer;offset=range?.startOffset;}
  if(node?.nodeType!==Node.TEXT_NODE)return null;
  const text=node.textContent;let start=offset,end=offset;while(start>0&&/[A-Za-z’'-]/.test(text[start-1]))start--;while(end<text.length&&/[A-Za-z’'-]/.test(text[end]))end++;
  const word=text.slice(start,end);if(!/[A-Za-z]{2}/.test(word)||word.length>80)return null;
  const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);const rect=range.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return null;
  const context=paragraph(node,word,start);if(!context.includes(word))return null;return {word,context,x:event.clientX,y:rect.bottom};
 }
 function line(text){const p=document.createElement('p');p.textContent=text;box.append(p);}
 function place(point){host.style.left=Math.min(point.x,innerWidth-330)+'px';host.style.top=Math.min(point.y+10,Math.max(10,innerHeight-340))+'px';}
 async function show(point,full){
  current=point;pinned=full;lastKey=point.word+'|'+point.context;const request=++token;place(point);box.hidden=false;box.replaceChildren();const h=document.createElement('h3');h.textContent=point.word;box.append(h);line('Loading local explanation…');
  try{
   const result=await chrome.runtime.sendMessage({type:'lookup',word:point.word,context:point.context});if(request!==token)return;if(result.error)throw Error(result.error);
   box.replaceChildren(h);line(result.data.en);line(result.data.zh);
   if(full){line('Learning value: '+result.data.value);line(result.data.explanation);if(result.data.example)line('Example: '+result.data.example);const {history={}}=await chrome.storage.local.get('history');if(request!==token)return;chrome.runtime.sendMessage({type:'word-viewed',word:point.word});line('Your status: '+(history[point.word.toLowerCase()]?.status||(history[point.word.toLowerCase()]?.viewed?'Previously viewed':'New')));
    for(const [label,status] of [['Learning','learning'],['Known','known']]){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{await chrome.runtime.sendMessage({type:'word-status',word:point.word,zh:result.data.zh,status});b.textContent=label+' ✓';};box.append(b);}
   }else{const b=document.createElement('button');b.textContent='Open learning card';b.onclick=()=>show(point,true);box.append(b);}
   const close=document.createElement('button');close.textContent='Close';close.onclick=hide;box.append(close);
  }catch(error){if(request!==token)return;box.replaceChildren(h);line(error.message);const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>show(point,full);box.append(retry);}
 }
 document.addEventListener('mousemove',event=>{if(!enabled||pinned)return;if(event.composedPath().includes(host)){clearTimeout(timer);return;}const point=hit(event);clearTimeout(timer);if(!point){timer=setTimeout(hide,350);return;}if(lastKey===point.word+'|'+point.context&&!box.hidden)return;timer=setTimeout(()=>show(point,false),600);},true);
 document.addEventListener('click',event=>{if(!enabled||event.composedPath().includes(host))return;const point=hit(event);if(point)show(point,true);else hide();},true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},true);
 const indicator=document.createElement('button');indicator.textContent='Reading Tutor · ON';indicator.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#3d604e;color:white;border:0;border-radius:8px;padding:10px;font:13px system-ui;cursor:pointer';document.documentElement.append(indicator);
 const toggle=()=>{enabled=!enabled;indicator.textContent='Reading Tutor · '+(enabled?'ON':'OFF');hide();};indicator.onclick=toggle;window.__readingTutor={toggle};
})();
