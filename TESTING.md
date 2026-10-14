# Version 0.3 verification — 2026-10-14

The isolated headless browser check passed: long pasted text split into display
blocks while raw text stayed intact; each paste saved as one page; insertion
before another page; page persistence after reload; delete/restore; next-page
navigation; mobile width; Ctrl+V preview and Ctrl+Enter save; AI loading hidden
text until all blocks finished; explicit Read without AI on failure; webpage
hover/click popup. Web and page model responses were simulated in browser QA.

Backend/core regression tests cover original text anchoring, cache separation,
local model switching and original reading data. Additional page tests cover
legacy migration, raw-text preservation, stable ids, reordering and restoration.

Run `node --test tests/*.test.js` and
`python -m unittest discover -s tests -p "test_*.py"`.
For isolated browser QA, serve extension on localhost:8093, install Playwright
or set PLAYWRIGHT_MODULE, then run `node tests/v3-browser-check.cjs`.

Live local word lookup is verified separately through /lookup. Real Kindle
canvas/frame compatibility is not established by these checks.

Live Qwen3.5 4B checks passed for /lookup (English meaning, Chinese gloss,
learning value) and /outline (valid suggested-section structure). Recognized
chapter labels and editable suggested headings are included in this release.
Legacy cloud backend tests are retained in test_cloud_backend.py.
