// Toolbar launches the full-page Reader. The context menu retains the legacy selection guide.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'guide-selection', title: 'Guide this selection', contexts: ['selection'] });
});
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) throw Error('No active page.');
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const root = document.querySelector('article') || document.querySelector('main') || document.body;
      if (!root) return null;
      const clone = root.cloneNode(true);
      clone.querySelectorAll('script,style,nav,footer,header,aside,form,button,iframe,svg,[hidden],[aria-hidden="true"]').forEach(n => n.remove());
      const paras = [...clone.querySelectorAll('h1,h2,h3,h4,p,blockquote,li')]
        .filter(n => !n.closest('blockquote p,li li,p p'))
        .map(n => ({ type: /^H[1-4]$/.test(n.tagName) ? 'heading' : 'paragraph', text: (n.textContent || '').replace(/\s+/g, ' ').trim() }))
        .filter(n => n.text.length >= 25);
      // Ignore navigation-heavy fragments by retaining prose-rich paragraphs.
      const prose = paras.filter(p => p.type === 'heading' || p.text.length >= 60);
      return { title: document.title || 'Untitled article', url: location.href, paragraphs: prose.slice(0, 1200) };
    }});
    const article = results?.[0]?.result;
    if (!article || article.paragraphs.filter(p => p.type === 'paragraph').length === 0) throw Error('No readable article was found.');
    let length = 0;
    const paragraphs = [];
    for (const p of article.paragraphs) {
      if (length + p.text.length > 200000) break;
      length += p.text.length; paragraphs.push(p);
    }
    if (!paragraphs.length) throw Error('Article exceeds the supported size.');
    await chrome.storage.session.set({ readerImport: { ...article, paragraphs, importedAt: Date.now() } });
    await chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
  } catch (error) {
    // Restricted pages cannot be injected. A readable fallback page makes the error actionable.
    await chrome.storage.session.set({ readerImportError: String(error.message || error) });
    await chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
  }
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'guide-selection' || !tab?.id) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  chrome.storage.session.set({ captured: { text: info.selectionText || '', tabId: tab.id, at: Date.now() } });
});
