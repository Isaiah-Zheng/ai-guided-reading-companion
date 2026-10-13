(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let article = null, enhanced = true;
  const key = url => 'reader-progress:' + url;
  const textNode = text => document.createTextNode(text);
  function showStatus(message) { $('status').textContent = message; }
  function render() {
    const root = $('content'); root.replaceChildren();
    if (!article) return;
    for (const p of article.paragraphs) {
      const node = document.createElement(p.type === 'heading' ? 'h2' : 'p');
      // Never set innerHTML from article text or an AI response.
      node.append(textNode(p.text));
      root.append(node);
    }
    $('original').setAttribute('aria-pressed', String(!enhanced));
    $('enhanced').setAttribute('aria-pressed', String(enhanced));
    $('detail').hidden = true;
  }
  function saveProgress() {
    if (!article) return;
    chrome.storage.local.set({ [key(article.url)]: Math.round(window.scrollY) }).catch(() => {});
  }
  async function restoreProgress() {
    if (!article) return;
    const state = await chrome.storage.local.get(key(article.url));
    const y = state[key(article.url)] || 0;
    window.scrollTo(0, y);
  }
  async function init() {
    try {
      const stored = await chrome.storage.session.get(['readerImport', 'readerImportError']);
      article = stored.readerImport;
      if (!article || !Array.isArray(article.paragraphs) || !article.paragraphs.length) {
        showStatus(stored.readerImportError || 'No article available. Open an ordinary article page and click Read with AI. Restricted or canvas-rendered pages may require manual paste in the side panel.');
        $('article').hidden = true;
        return;
      }
      $('title').textContent = article.title || 'Untitled article';
      $('source').textContent = article.url || '';
      render();
      showStatus('Original article ready. AI annotations will be added in the next development milestone.');
      await restoreProgress();
    } catch (error) { showStatus('Unable to open article: ' + error.message); }
  }
  $('original').onclick = () => { enhanced = false; render(); };
  $('enhanced').onclick = () => { enhanced = true; render(); };
  $('settings-toggle').onclick = () => { $('settings').hidden = !$('settings').hidden; $('settings-toggle').setAttribute('aria-expanded', String(!$('settings').hidden)); };
  $('font-size').oninput = () => { $('content').style.fontSize = $('font-size').value + 'px'; };
  $('close-detail').onclick = () => { $('detail').hidden = true; };
  let lastSave = 0;
  window.addEventListener('scroll', () => { if (Date.now() - lastSave >= 1500) { lastSave = Date.now(); saveProgress(); } }, { passive: true });
  window.addEventListener('pagehide', saveProgress);
  init();
})();
