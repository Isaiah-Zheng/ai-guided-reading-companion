const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
const bg = fs.readFileSync('extension/background.js','utf8');
const reader = fs.readFileSync('extension/reader.js','utf8');
const html = fs.readFileSync('extension/reader.html','utf8');
test('toolbar launches a standalone reader while selection fallback remains', () => {
  assert.equal(manifest.action.default_title,'Read with AI');
  assert.match(bg,/chrome\.action\.onClicked\.addListener/);
  assert.match(bg,/chrome\.tabs\.create/);
  assert.match(bg,/chrome\.runtime\.getURL\('reader.html'\)/);
  assert.match(bg,/guide-selection/);
  assert.match(bg,/chrome\.sidePanel\.open/);
});
test('capture extracts article/main text without sending it to an API', () => {
  assert.match(bg,/querySelector\('article'\)/);
  assert.match(bg,/querySelector\('main'\)/);
  assert.match(bg,/paragraphs/);
  assert.doesNotMatch(bg,/fetch\(/);
});
test('reader provides original/enhanced controls and safe text-only rendering', () => {
  for (const id of ['original','enhanced','settings','font-size','content']) assert.ok(html.includes('id="'+id+'"'));
  assert.match(reader,/document\.createTextNode/);
  assert.doesNotMatch(reader,/innerHTML/);
  assert.match(reader,/reader-progress:/);
  assert.match(reader,/window\.scrollTo/);
});
