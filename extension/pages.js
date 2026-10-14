export function readingBlocks(raw, limit=1000) {
 const blocks=[],paragraphs=[];
 const heading=line=>{
  if(line.length>100||line.length<2||/[.!?]$/.test(line))return 0;
  if(/^(chapter|part|book|section)\s+(\d+|[IVXLCDM]+|one|two|three|four|five)\b/i.test(line))return 2;
  if(/^#{1,3}\s+/.test(line))return Math.min(3,line.match(/^#+/)[0].length+1);
  if(line===line.toUpperCase()&&/[A-Z]/.test(line)&&line.split(/\s+/).length<=12)return 2;
  return 0;
 };
 let buffer=[];
 const flush=()=>{if(buffer.length){paragraphs.push(buffer.join('\n').trim());buffer=[];}};
 for(const line of raw.replace(/\r\n/g,'\n').split('\n')){
  const trimmed=line.trim(),level=heading(trimmed);
  if(!trimmed){flush();continue;}
  if(level){flush();paragraphs.push({type:'heading',text:trimmed,level});}else buffer.push(line);
 }
 flush();
 for(let text of paragraphs){
  if(typeof text!=='string'){blocks.push(text);continue;}
  while(text.length>limit){
   const window=text.slice(0,limit);let cut=0;
   for(const match of window.matchAll(/[.!?]["”’']?\s+/g))cut=match.index+match[0].length;
   if(cut<limit/3)cut=window.lastIndexOf(' ');
   if(cut<limit/3)cut=limit;
   blocks.push({type:'paragraph',text:text.slice(0,cut).trim()});text=text.slice(cut).trim();
  }
  if(text)blocks.push({type:'paragraph',text});
 }
 return blocks;
}
export function makePage(raw,label=''){
 const blocks=readingBlocks(raw);
 return {id:crypto.randomUUID(),label:label||blocks.find(b=>b.type==='heading')?.text||'',raw,blocks,annotations:{},details:{},progress:0,created:Date.now()};
}
export function migrateBook(book){
 if(!book.pages){
  const page={id:'legacy-'+book.id,label:'',raw:(book.blocks||[]).map(b=>b.text).join('\n\n'),
   blocks:book.blocks||[],annotations:book.annotations||{},details:book.details||{},progress:book.progress||0,aiModel:book.aiModel};
  // Reflow oversized legacy paragraphs; cached spans cannot safely move to new blocks.
  if(page.blocks.some(b=>b.text.length>1200)){page.blocks=readingBlocks(page.raw);page.annotations={};page.details={};}
  book.pages=[page];book.currentPageId=page.id;
 }
 book.trash||=[];
 return book;
}
export function currentPage(book){return book.pages.find(p=>p.id===book.currentPageId)||book.pages[0];}
export function deletePage(book,id){
 const index=book.pages.findIndex(p=>p.id===id);if(index<0)return;
 const [page]=book.pages.splice(index,1);book.trash.push({...page,deletedAt:Date.now(),formerIndex:index});
 if(book.currentPageId===id)book.currentPageId=book.pages[Math.min(index,book.pages.length-1)]?.id;
}
export function restorePage(book,id){
 const index=book.trash.findIndex(p=>p.id===id);if(index<0)return;
 const [page]=book.trash.splice(index,1);book.pages.splice(Math.min(page.formerIndex??book.pages.length,book.pages.length),0,page);
 delete page.deletedAt;delete page.formerIndex;book.currentPageId=page.id;
}
export function movePage(book,id,direction){const index=book.pages.findIndex(p=>p.id===id),next=index+direction;if(index<0||next<0||next>=book.pages.length)return;[book.pages[index],book.pages[next]]=[book.pages[next],book.pages[index]];}
