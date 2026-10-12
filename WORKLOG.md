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
