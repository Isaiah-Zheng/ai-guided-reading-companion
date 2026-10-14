# AI Reading Tutor · v0.2

A runnable Chrome extension implementing the v2 Reader design. It is an early development build, not a finished high-coverage AI product.

## Try it in Chrome

1. Extract the ZIP into a permanent folder.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**.
3. Select the **extension** folder (the one containing `manifest.json`).
4. Pin **AI Reading Tutor**. Open a normal English article and click **Read with AI**.
5. The article opens in a separate Reader tab. For unsupported pages, use **Import** to paste full text.

To open the Reader without importing, use the extension's **Details → Extension options**. It starts with a short original sample, not an excerpt from Rubicon.

## What works

- One-click extraction of visible text in ordinary semantic article/main pages; title, source, paragraph order, headings, and plain text are retained.
- Full-text paste fallback; Original / Enhanced switch.
- 20px body text, 10px gray Chinese notes, a 760px maximum column, adjustable text and note sizes.
- Useful words underlined; entity labels only on their first annotated occurrence; low-reuse difficult words get short Chinese notes. No colored frequency highlighting.
- Quick View and collapsed Detailed View. Useful words save only when details are opened. Encounters are deduplicated by article and location; repeated visits do not imply mastery.
- Local article storage, paragraph annotation cache, contextual explanation cache, settings, reading-position restoration, article deletion, and wordbook removal.
- A small hand-authored offline glossary with IPA and sample explanations. **It is not high-coverage, personalized, or context-aware AI.** Its Roman entity mappings suit the sample; generic ambiguous names such as Senate can be wrong in other contexts. Verify these against the article.
- Optional AI batch annotation of nearby paragraphs, on-demand detailed explanations, and exact-span validation that prevents AI from rewriting source text.
- Wikipedia summary retrieval on explicit request, cached locally with source links and ambiguity/error handling.

## Enable local AI

Open Ollama, then run `Start Local AI.cmd` from this project folder. Both Qwen3.5
4B and 9B are already installed on this laptop. The backend listens on
`http://127.0.0.1:8766` and defaults to Ollama; no cloud API key is needed.

Reload AI Reading Tutor at `chrome://extensions`, then reload the Reader tab.
Click **Aa**, choose **Local AI model**, and tick **Enable AI for this article**.
Close settings to read. Nearby paragraphs are annotated one at a time. Click an
annotated word for its meaning; expand **Detailed explanation** for context and
an example. First startup or model switching takes longer.

Changing models clears this article's AI annotation and explanation caches so
the new model can analyze it. It retains the article, reading progress and wordbook.
The backend also separates its caches by provider and model. It unloads the other
Qwen model when switching. Annotation spans are validated against the original text.

Local AI is fallible; historical identities and IPA can be wrong. Wikipedia lookup
remains an explicit separate network request. AI is off for each new article until
you enable it. Text is stored locally as before.

Cloud mode remains optional: set `AI_PROVIDER=openai`, `OPENAI_API_KEY` and
`OPENAI_MODEL` in the backend's environment before starting it. That mode sends
reading data to the provider and can incur charges.

## Local Reader preview

```powershell
python -m http.server 8080 --bind 127.0.0.1 --directory extension
```

Open http://127.0.0.1:8080/reader.html. The preview uses its own local browser storage. Chrome article-import integration requires the installed extension.

## Checks

```powershell
node --test tests/core.test.js
python -m unittest discover -s tests -p "test_*.py"
```

## Current limits / next work

Extraction is a DOM heuristic, not a universal article parser: dynamically loaded text, complex nested layouts, captions, tables, images, paywalls, login-only books, PDF, and EPUB are not guaranteed. It imports currently rendered accessible text; it does not bypass access controls. Original restores the **extracted text**, not the original website layout. Review the source if text appears incomplete.

Local annotation coverage is deliberately small. AI output remains fallible. Long individual paragraphs over 6,000 characters currently fall back to local support. Context-aware entity disambiguation, broader local vocabulary data, accessible larger-note defaults, robust article extraction, provider budgeting, and multi-site import testing are the next engineering milestones. This build has no accounts, cross-device sync, voice, or subscriptions.

Permission rationale: `activeTab` and `scripting` import the page only after a toolbar click; `storage` saves reading data; localhost allows the optional backend; English Wikipedia allows requested encyclopedia summaries. No background reading of unrelated tabs.

Development references: [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

## Keep pasting into one book

Open your book from Articles, then choose **Add text to this book**. Paste the
next part and click **Save to this book**. The title and book ID stay the same;
new paragraphs are appended after the old text and saved in Chrome local storage.
Existing annotations, wordbook and reading position are retained. Continue adding
parts until the book is complete. Use **New book / article** only for another work.
Reloading the page or restarting Chrome retains successfully saved text; removing
the extension or clearing its storage removes that data.


## Version 0.3: pages and webpage mode

Reload the extension once after updating. Existing stored books migrate into one
legacy page because old paste boundaries were not recorded. Future pastes each
become one page. Original pasted text is retained; oversized paragraphs are
arranged into smaller display blocks at sentence/word boundaries.

Reader shortcuts: Ctrl+V outside a text box opens a new-page preview; Ctrl+Enter
saves it. Previous/Next turns pages. Manage pages supports labels, order, deletion
and restoration. Pages remain saved even if AI fails. When AI is enabled, the
current page stays hidden until all its blocks finish. Retry resumes cached blocks;
Read without AI is an explicit alternative. Analysis uses the local model.

Click the extension toolbar icon for the popup. Toggle word help on this webpage
or use Alt+Shift+R (customizable at chrome://extensions/shortcuts). Hover over a
word for a bilingual meaning; click for value, detail and Known/Learning controls.
Web mode sends only the selected word and nearby context through the extension
worker to localhost. It does not import the page or require access to all websites.
Cached context-specific lookups are immediate; uncached lookups show Loading.
Webpage access needs a user gesture on each new page. Restricted pages, PDFs,
canvas text and inaccessible Kindle frames may not provide readable text.

Learning status is user marked, separate from learning value. Browser storage
holds pages and history; uninstalling or clearing extension data removes them.

The new-page preview includes insertion position: before page 1, between any
two pages, or at the end. The default is after the currently open page. Stable
page IDs keep annotations and word encounters attached when order changes.

Standalone chapter/part/book labels, uppercase headings and Markdown heading
lines are recognized automatically. Missing formatting can use AI suggested
sections, clearly labeled separately from original text. Click a heading to edit
its display label. Suggested sections can be disabled in Aa. Chapter numbering
is never invented. Full raw pasted text remains saved unchanged.
