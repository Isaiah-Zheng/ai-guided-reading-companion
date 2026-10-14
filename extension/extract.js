// Self-contained: Chrome serializes this function into the selected page.
export function extractArticle() {
  const excluded = 'nav,header,footer,aside,form,script,style,[hidden],[aria-hidden="true"],[role="navigation"],.comments,.advertisement';
  const eligible = el => !el.closest(excluded) && !!el.getClientRects().length;
  const candidates = [...document.querySelectorAll('article,main,[role="main"],.article-body,.entry-content,.post-content')];
  const score = root => [...root.querySelectorAll('p')].filter(eligible).reduce((sum,p) => sum + p.innerText.length - [...p.querySelectorAll('a')].reduce((n,a)=>n+a.innerText.length,0),0);
  candidates.sort((a,b)=>score(b)-score(a));
  const root = candidates[0] || document.body;
  const blocks = [...root.querySelectorAll('h2,h3,h4,p,blockquote,li,pre')]
    .filter(eligible)
    .filter(el => !el.parentElement.closest('li,pre'))
    .filter(el => el.tagName !== 'BLOCKQUOTE' || !el.querySelector('p'))
    .map(el=>({type:/^H/.test(el.tagName)?'heading':'paragraph',text:el.innerText.replace(/\r\n/g,'\n').trim()}))
    .filter(b=>b.text.length > 0);
  const textLength = blocks.reduce((n,b)=>n+b.text.length,0);
  if(textLength < 200) throw new Error('No readable article found. Paste the full text in the Reader instead.');
  const title = root.querySelector('h1')?.innerText || document.querySelector('h1')?.innerText || document.title;
  return {title:title.trim(),url:location.href,blocks,extraction:'Visible article text. Check the source if anything appears missing.'};
}
