chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'guide-selection', title: 'Guide this selection', contexts: ['selection'] });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'guide-selection' || !tab?.id) return;
  // Open immediately within the context-menu user gesture, before asynchronous storage.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  chrome.storage.session.set({ captured: { text: info.selectionText || '', tabId: tab.id, at: Date.now() } });
});
