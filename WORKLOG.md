# Work log — 2026-10-12

Implemented the AI Guided Reading Companion MVP from the uploaded inspiration:

- Manifest V3 Chrome side panel, on-demand selection capture and right-click capture.
- Manual paste fallback for Kindle Cloud Reader and restricted pages.
- LLM-backed strict structured guides, bilingual EN/ZH explanations, A/B/C/D
  vocabulary priorities, register and approximate CEFR judgments.
- Expandable people/concept cards with Chinese names and uncertainty/legend labels.
- Optional difficult sentence help and Light/Balanced/Deep assistance.
- Local preferences and known-word memory, without accounts or payments.
- Minimal FastAPI backend with server-side API key, exact extension Origin checks,
  bounded inputs, mode caps, quote filtering, cancellation and useful errors.

Setup troubleshooting:

- Clarified that setup commands must run in the project directory.
- Switched backend and extension to port 8001 because WSL relay occupied 8000.
- Corrected a duplicated EXTENSION_ID assignment in the local environment file.
  That environment file is excluded from Git.
- User screenshots confirmed extension installation, server startup and a successful
  health request. Guide requests initially returned 403 before the ID correction.

Verification: 9 mocked-provider backend tests and 4 simulated frontend tests passed,
plus JavaScript syntax checks. A live successful guide and Kindle selection capture
remain unverified. See README.md for setup and browser acceptance checks.

## 2026-10-14 — Reader v0.3

Updated the user-selected Downloads copy. Added saved pages per paste, insertion
positions, page reorder/delete/restore, paste shortcuts, long-text layout, hidden
text until page AI completes, explicit failure recovery, active-tab webpage hover
and click help, shared user-marked learning status, local Qwen 4B/9B selection,
chapter recognition and separately labeled editable AI section suggestions.
Configured future agent-completed edits to commit and push feature/reader-v2.
Browser integration QA passed with simulated AI responses; live local lookup and
outline endpoints also passed. Kindle compatibility remains unverified.

## 2026-10-15 — v0.3.1 fast Web lookup

Default hover/click word help now uses the bundled local dictionary, with a
120 ms hover delay and per-page result cache. AI is explicitly requested for
contextual explanation and dictionary senses remain visible on AI failure.
Restored the stopped Ollama service, added accurate health/error diagnostics,
and changed the launcher to start Ollama when closed. Preserved opt-in AI page
analysis. Offline, browser and regression checks passed; live AI recovered.
