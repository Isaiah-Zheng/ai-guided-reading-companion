const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.value = ''; this.children = []; this.checked = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
}
async function panel() {
  const nodes = new Map(); const writes = [];
  const document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }, createElement: () => new Element() };
  for (const [id, value] of Object.entries({ mode: 'Balanced', level: 'B2', language: 'en' })) document.getElementById(id).value = value;
  const chrome = { tabs: { query: async () => [{ id: 1 }] }, scripting: { executeScript: async () => [{ result: 'selected text' }] }, storage: { local: { get: async () => ({}), set: async value => writes.push(value) }, session: { get: async () => ({}), remove: async () => {} }, onChanged: { addListener() {} } } };
  const context = { document, chrome, console, AbortController, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => ({ vocabulary: [], context: [], sentences: [] }) }) };
  vm.createContext(context);
  await vm.runInContext(`(async () => { ${fs.readFileSync('extension/sidepanel.js', 'utf8')} })()`, context);
  return { nodes, context, writes };
}
test('MV3 manifest and local-only permission boundary', () => {
  const m = JSON.parse(fs.readFileSync('extension/manifest.json'));
  assert.equal(m.manifest_version, 3);
  assert.deepEqual(m.host_permissions, ['http://127.0.0.1/*']);
  assert.ok(fs.existsSync('extension/' + m.side_panel.default_path));
});
test('selection capture and manual paste send exact structured request', async () => {
  const { nodes, context } = await panel();
  await nodes.get('capture').onclick(); assert.equal(nodes.get('passage').value, 'selected text');
  nodes.get('passage').value = 'Manually pasted Kindle passage';
  let body; context.fetch = async (url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ vocabulary: [], context: [], sentences: [] }) }; };
  await nodes.get('guide').onclick();
  assert.equal(body.text, 'Manually pasted Kindle passage'); assert.equal(body.mode, 'Balanced');
  assert.equal(body.sentence_help, false); assert.equal(nodes.get('guide').disabled, false);
});
test('restricted selection and server error remain actionable', async () => {
  const { nodes, context } = await panel();
  context.chrome.scripting.executeScript = async () => { throw Error('restricted'); };
  await nodes.get('capture').onclick(); assert.match(nodes.get('status').textContent, /Paste/);
  nodes.get('passage').value = 'Some text';
  context.fetch = async () => ({ ok: false, json: async () => ({ detail: 'Configure EXTENSION_ID' }) });
  await nodes.get('guide').onclick(); assert.match(nodes.get('status').textContent, /EXTENSION_ID/);
  assert.equal(nodes.get('passage').disabled, false);
});
test('render uses literal text for model HTML and language switch does not refetch', async () => {
  const { nodes, context } = await panel(); nodes.get('passage').value = 'text';
  let calls = 0;
  context.fetch = async () => { calls++; return { ok: true, json: async () => ({ vocabulary: [], sentences: [], context: [{ name: '<script>evil</script>', chinese_name: '名字', kind: 'person', evidence: 'uncertain', explanation: { en: 'English', zh: '中文' } }] }) }; };
  await nodes.get('guide').onclick();
  const card = nodes.get('results').children[1]; assert.match(card.children[0].textContent, /<script>/);
  nodes.get('language').value = 'zh'; await nodes.get('language').onchange();
  assert.equal(nodes.get('results').children[1].children[3].textContent, '中文'); assert.equal(calls, 1);
});
