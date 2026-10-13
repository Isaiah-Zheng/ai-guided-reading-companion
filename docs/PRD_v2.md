# AI Reading Tutor — Product Requirements v2.0

Status: design baseline (2026-10-13). Chrome extension and standalone Reader tab.

## Primary workflow
- On a supported article page, click **Read with AI** once. Capture the complete readable article, open an independent Reader tab, and present original paragraphs immediately.
- Never require repeated selection or copying. Preserve the article's words and paragraph order. Original mode renders only the imported source. Enhanced mode adds removable annotations.
- Reader-first: 20px body default, ~1.75 line height, ~760px text column, spacious paragraphs, collapsible reading settings.
- Save reading position and analysis locally when feasible; errors must be explicit, and selected-passage side panel may remain as a fallback.

## Minimal adaptive annotations — final design
- **No color coding of different vocabulary tiers in the body.** Underline *only* words/phrases with meaningful learning value, using a subtle single-color underline.
- **Names and key concepts:** add short Chinese names in parentheses, generally on first mention, e.g. Pompey (庞培).
- **Difficult, low-learning-priority words:** show a tiny muted Chinese gloss beside the original word (target 10px; configurable ~9–12px).
- Avoid excessive marks or repeated glosses. Prioritize the reading experience over word count and never insert generated prose into the immutable source.
- English body ~20px; proper-noun Chinese hints ~11px; difficult-word glosses ~10px.

## Word detail and retention
- Word quick view: contextual EN/ZH meaning; IPA for useful everyday spoken words; learning-value judgment.
- Level, explanation depth, and detailed word information stay collapsed initially.
- When a user expands detail for a worthwhile high/medium-value word, save it to the local wordbook; on later interaction, remind that it has been viewed before (do not claim mastery).
- People and terms can open a small Wikipedia-style summary without navigating away, displaying source/uncertainty.

## MVP priority
P0: complete webpage capture; standalone Reader with original/enhanced toggle; readable typographic layout; persisted source and location; incremental non-blocking annotations; compact contextual explanations; collapsible controls; meaningful error/fallback behavior.
Next P0 iterations: IPA, minimal Chinese inline hints, contextual people/concept panels, wordbook and repeat reminders.
Deferred: pre-reading vocabulary-size estimate, EPUB/PDF ingestion, pronunciation playback, tests/quizzes, account sync, advanced spaced repetition.

## Cost, security and privacy
- Start reading before LLM analysis finishes; batch nearby paragraphs rather than transmitting the entire book or issuing one request per word.
- Prefer dictionary/frequency data, Wikimedia summaries, local storage, cached analyses and on-demand detail.
- Do not execute webpage content or model-provided HTML; render imported text as text.
- Provider credentials belong solely to loopback backend; users should understand when reading content is transmitted to the provider. No DRM bypass.
- Bound capture size and batch size; fail gracefully on Chrome internal pages, inaccessible frames and non-DOM readers.

## Acceptance
- One toolbar click on a normal article opens a Reader with complete usable paragraph text, without manual copying or API availability.
- Original mode has no injected hints; toggling Enhanced leaves the exact original words intact.
- Existing side-panel selection flow continues to work via context menu or fallback.
- Automated tests cover extraction heuristics, safe text rendering, mode toggle, and capture handoff; browser integration remains to be verified manually.
