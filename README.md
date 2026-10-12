# AI Guided Reading Companion — MVP

Chrome Manifest V3 side panel + local Python FastAPI server. Built from the uploaded
`作品与项目灵感.md` (2026-10-12). The previous chat exposed no recoverable implementation,
so this workspace contains a fresh implementation of that specification.

## Start on Windows

Run these commands from this project directory in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and choose this project's `extension` folder. Chrome 116+ is required.
2. Copy the extension's ID into `EXTENSION_ID` in `backend/.env`.
3. Put your OpenAI API key in `OPENAI_API_KEY` in that same file. Never put it in
   the extension, browser storage, or a committed file. `OPENAI_MODEL` defaults
   to `gpt-4o-mini`; change it to a Responses/structured-output capable model
   available to your API account. API billing is separate from ChatGPT.
4. Start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8001
```

Restart the server after editing `.env`. Keep this terminal running during use.
The server must remain bound to loopback; this MVP is not a public hosting setup.
`http://127.0.0.1:8001/health` reports status/configuration without revealing secrets.

## Use

Pin the extension, select roughly 100–300 words on an ordinary webpage, click its
toolbar button, then **Use selection** → **Guide Me**. Alternatively, right-click
the highlighted passage → **Guide this selection**, then click **Guide Me** in
the panel. This explicitly sends the selected passage, never the whole page.

On Kindle Cloud Reader, try the same sequence. If text is not available as a
normal selection, manually copy/paste a passage into the panel. No screenshot,
DRM bypass, or protected-content extraction is implemented. Restricted Chrome
pages, inaccessible cross-origin frames, and canvas-rendered readers may fail
capture. Manual paste remains available.

Choose Light (up to 3 words/2 context cards), Balanced (6/4), or Deep (10/6),
and B1–C2 level. Sentence help is opt-in, capped at 1/2/4 sentences respectively.
English/中文 changes explanations without another API call. Context cards show
Chinese names and expandable background, with legend/uncertainty labels.

A = Active use; B = Recognition; C = Literary/rare; D = Context.
Register and approximate CEFR are separate judgments. **I know this** stores a
word locally and suppresses it in future guides. Remove words or reset memory
in the panel. Preferences persist; passages and guides do not persist. A selected
right-click passage is briefly held in Chrome session storage, consumed on panel
load, and ignored after two minutes. No accounts, payment, or review scheduler.

## Privacy and limits

Only Guide Me calls the backend and paid LLM. The server does not store passages
or log provider responses; Responses requests set `store: false`. Provider data
handling policies still apply. Page text and model output are treated as untrusted;
the UI renders text nodes, not model HTML. Exact quotes are filtered against the
input, modes are capped server-side, and sentence opt-in is enforced server-side.

The backend checks the exact extension Origin and restricts CORS. There is no
provider key in extension code. Origin checks protect against ordinary web pages;
they are not authentication against other local programs. Do not expose this server
to the network. There is no public-server authentication or rate limiting.

Background cards use model knowledge and are **not web-verified**; they can be
wrong. Legend/uncertainty labels are model judgments. The original reading remains
central; no full passage translation or summary is requested.

## Verify

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
node --test tests/extension.test.cjs
node --check extension/background.js
node --check extension/sidepanel.js
```

Backend tests mock the provider (no API charges), exercising strict output,
Origin/CORS restrictions, validation, missing credentials, refusals, quota/error
responses, timeout, quote grounding, known words, mode caps and sentence opt-in.
Frontend tests run in a small simulated Chrome/DOM environment, covering capture,
manual paste, request shape, failures and literal bilingual rendering.

Browser acceptance checklist (requires your installed Chrome and reading session):

- Load the extension with no manifest errors and open the side panel.
- Select ordinary webpage text; test Use selection and the context menu.
- With the backend/key configured, get a real guide and toggle EN/ZH.
- Compare modes; opt in/out of sentence help; mark/remove a known word.
- Stop backend and confirm a useful connection error; test cancel.
- Try actual Kindle Cloud Reader selection; document whether paste is needed.

## Files and references

- `extension/`: manifest, service worker, panel HTML/CSS/JS; no build step.
- `backend/app.py`: validated schemas, prompt, local API and provider request.
- `backend/.env.example`: configuration template (no secret).
- `tests/`: backend integration tests and frontend simulated tests.

Implementation references: [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
and [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
