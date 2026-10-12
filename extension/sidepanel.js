const $ = (id) => document.getElementById(id);
let known = [], currentGuide = null, controller = null;
const message = (text) => { $('status').textContent = text; };
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
const explain = (value) => value[$('language').value];
function count() { $('count').textContent = `${$('passage').value.trim().split(/\s+/).filter(Boolean).length} words`; }
function memory() {
  $('known-count').textContent = known.length;
  $('known-list').replaceChildren();
  known.forEach(word => { const button = el('button', `${word} ×`); button.title = 'Remove from known words'; button.onclick = async () => { known = known.filter(w => w !== word); await chrome.storage.local.set({ known }); memory(); }; $('known-list').append(button); });
}
function render() {
  const root = $('results'); root.replaceChildren();
  if (!currentGuide) return;
  const priorities = { A: 'Active', B: 'Recognition', C: 'Literary', D: 'Context' };
  if (!currentGuide.vocabulary.length && !currentGuide.context.length && !currentGuide.sentences.length) root.append(el('p', 'No extra help needed for this passage at your selected level.'));
  if (currentGuide.vocabulary.length) root.append(el('h2', 'Selected vocabulary'));
  currentGuide.vocabulary.forEach(item => {
    const card = el('article', '', 'card'); card.append(el('h3', item.term), el('span', `${item.priority} · ${priorities[item.priority]}`, 'badge'), el('span', item.register, 'badge'), el('span', `≈ ${item.cefr_estimate}`, 'badge'), el('p', explain(item.meaning)), el('blockquote', item.quote));
    const details = el('details'); details.append(el('summary', 'Usage & learning advice'), el('p', explain(item.usage)), el('p', explain(item.learning_advice))); card.append(details);
    const button = el('button', known.includes(item.term) ? 'Known ✓' : 'I know this', 'text-button'); button.disabled = known.includes(item.term);
    button.onclick = async () => { if (known.length >= 500) { message('Known-word memory is full. Remove a word before adding another.'); return; } known.push(item.term); await chrome.storage.local.set({ known }); memory(); render(); }; card.append(button); root.append(card);
  });
  if (currentGuide.context.length) root.append(el('h2', 'People & context'));
  currentGuide.context.forEach(item => { const card = el('details', '', 'card'); card.append(el('summary', `${item.name} · ${item.chinese_name}`), el('span', item.kind, 'badge'), el('span', item.evidence.replaceAll('_', ' '), 'badge'), el('p', explain(item.explanation))); root.append(card); });
  if (currentGuide.sentences.length) root.append(el('h2', 'Difficult sentences'));
  currentGuide.sentences.forEach(item => { const card = el('details', '', 'card'); card.append(el('summary', 'Unpack this sentence'), el('blockquote', item.quote), el('p', explain(item.explanation))); root.append(card); });
}
function setPassage(text) { $('passage').value = text; currentGuide = null; render(); count(); }
async function capture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => window.getSelection()?.toString() || '' });
    const selected = frames.map(frame => frame.result).filter(Boolean).sort((a,b) => b.length-a.length)[0];
    if (!selected) { message('No readable selection found. Select text again, use the right-click menu, or paste it here.'); return; }
    if (selected.length > 12000) { message('Selection is too long. Please select at most 12,000 characters.'); return; }
    setPassage(selected); message('Selection ready. Click Guide Me.');
  } catch { message('This page does not allow selection capture. Paste your passage here; Kindle may require this fallback.'); }
}
async function receiveCaptured(captured) {
  if (!captured) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (captured.tabId !== tab?.id || Date.now() - captured.at > 120000) return;
  if (captured.text.length > 12000) { message('Selection too long. Use a shorter passage.'); return; }
  setPassage(captured.text); message('Selection ready. Click Guide Me.');
  await chrome.storage.session.remove('captured');
}
$('capture').onclick = capture;
$('passage').oninput = () => { count(); currentGuide = null; render(); };
$('clear').onclick = () => { controller?.abort(); setPassage(''); message('Passage cleared.'); };
$('cancel').onclick = () => controller?.abort();
$('reset-memory').onclick = async () => { known = []; await chrome.storage.local.set({ known }); memory(); render(); };
for (const id of ['mode', 'level', 'language', 'sentence-help']) $(id).onchange = async () => {
  await chrome.storage.local.set({ preferences: { mode: $('mode').value, level: $('level').value, language: $('language').value, sentence_help: $('sentence-help').checked } });
  if (id === 'language') render();
};
$('guide').onclick = async () => {
  const text = $('passage').value.trim();
  if (!text || text.length > 12000) { message('Paste 1–12,000 characters first.'); return; }
  controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90000);
  $('guide').disabled = true; $('capture').disabled = true; $('passage').disabled = true; $('cancel').hidden = false;
  currentGuide = null; render(); message('Preparing a selective guide…');
  try {
    const response = await fetch('http://127.0.0.1:8001/guide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ text, mode: $('mode').value, level: $('level').value, sentence_help: $('sentence-help').checked, known_words: known }) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Invalid request. Check your passage and settings.');
    if (!['vocabulary','context','sentences'].every(key => Array.isArray(data[key]))) throw new Error('Invalid guide received. Please retry.');
    currentGuide = data; render(); message('Your guide is ready. Keep the original passage in view.');
  } catch (error) { message(error.name === 'AbortError' ? 'Request cancelled or timed out.' : error instanceof TypeError ? 'Cannot reach the backend. Start it and check EXTENSION_ID in backend/.env.' : error.message); }
  finally { clearTimeout(timeout); controller = null; $('guide').disabled = false; $('capture').disabled = false; $('passage').disabled = false; $('cancel').hidden = true; }
};
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.captured?.newValue) receiveCaptured(changes.captured.newValue).catch(() => {}); });
const saved = await chrome.storage.local.get(['known','preferences']);
known = saved.known || [];
if (saved.preferences) { for (const id of ['mode','level','language']) $(id).value = saved.preferences[id] || $(id).value; $('sentence-help').checked = Boolean(saved.preferences.sentence_help); }
memory(); count();
const session = await chrome.storage.session.get('captured');
await receiveCaptured(session.captured);
