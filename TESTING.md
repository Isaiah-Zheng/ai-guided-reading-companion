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


## Dictionary-first fix — 2026-10-15

- 13 JavaScript tests and 19 Python tests passed.
- Offline browser check: Reader text and bilingual matrix lookup remained usable
  while every AI-backend request was blocked.
- Existing v0.3 browser workflow checks passed with AI mode selected explicitly.
- Focused Web-mode check measured first matrix hover at 315 ms on this machine,
  including the 120 ms hover delay and loading its dictionary bucket. Repeat hover
  required no additional lookup request. This is an observed local test, not a
  guaranteed latency for every computer or word.
- Root cause of reported AI failure: Ollama was not running although the Reader
  backend was reachable. Ollama was restarted; a real bilingual contextual lookup
  returned HTTP 200 in 9 seconds. Basic dictionary lookup makes no model request.
- Missing-model, closed-service and malformed-answer messages have separate tests.
- Bundled ECDICT includes 759,781 word/form records, loaded by letter. The source
  CSV is not committed; compacted licensed entries and attribution are bundled.


## v0.4.0 click-led vocabulary · 2026-10-15

- 28 JavaScript tests pass, including explicit dictionary form normalization,
  function-word filtering, click eligibility, phrase spans, state transitions,
  historical migration, same-context/day evidence, manual removal, and concurrent
  Reader/Web mutations through the service worker.
- 19 Python tests pass using isolated dependencies; backend source is unchanged.
- tests/learning-browser.cjs passes in isolated headless Chrome: optional interests,
  dictionary-only first-click collection, every matching occurrence, repeat-click
  deduplication, visible encounters and reload deduplication, recall pass/failure,
  manual return from known, function-word exclusion, phrase selection, persistence,
  paste insertion, page delete/restore, desktop margin card, narrow viewport card,
  no AI dependency, hyperlink hover, and normal hyperlink navigation.
- tests/offline-browser.cjs and tests/v3-browser-check.cjs both pass. The latter
  retains long-paste, loading gate, AI failure/recovery, page ordering/navigation,
  and mobile-width coverage. AI responses in that suite are simulated.
- Browser scripts accept PLAYWRIGHT_MODULE; offline/v3 scripts also accept
  READER_TEST_URL to avoid collisions with a pre-existing localhost:8093 service.
- Screenshots were visually inspected. No live installed Chrome profile or personal
  reading data was used. Actual extension installation/reload remains a user-side
  step because this environment cannot write the Downloads checkout.
- No real-model quality/latency claim is made for this release: contextual model
  handling is unchanged. See docs/learning-v0.4.md for scope and limitations.
