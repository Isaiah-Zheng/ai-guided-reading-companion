# Click-led reading vocabulary · v0.4.0

## Delivered behavior

- First-run interests are optional, remembered, and editable under Aa. Seven small
  curated topic vocabularies combine chosen interests with the current page/title.
  Topic matching is a transparent local heuristic, not an AI classifier.
- A deliberate click opens local dictionary help immediately. Collection requires
  either the existing common-word indicator (core/rank up to 3000), curated topic
  relevance, or an explicit manual Keep action. Function words and recognized
  entities do not qualify automatically. Hover alone never collects.
- Reader ordinary words use clicks, annotated words also support brief hover help,
  and selection of a short phrase in one block opens one lookup. Rare recognition
  hints and proper-name Chinese notes remain separate from learning underlines.
- New saved words enter learning (待巩固). Their matching occurrences underline
  immediately. Later pages also normalize dictionary forms when those words exist
  in the bundled dictionary. No general stemmer guesses unrelated words.
- Each lookup retains its source and paragraph. Same-source/context reopening
  within 30 seconds is one interaction. A later lookup returns check (待考察) to
  learning while preserving history. Already-known words stay known until the
  reader explicitly changes the state: dictionary lookup cannot identify senses
  reliably or prove forgetting.
- Reader paragraphs visible for two seconds while the tab is visible and no help
  or management dialog is open can provide encounter evidence. Original locations
  and occurrence counts are stored separately from distinct context/local-day
  encounters. Copies of the same paragraph on the same day do not inflate that
  second count. Visibility is an approximation, not proof of reading.
- The wordbook offers Check when ready. The reader recalls before revealing the
  meaning, then reports understood or unsure. Unsure returns to learning; understood
  marks known. No encounter count automatically declares mastery or schedules a test.
- Removal excludes a word from subsequent automatic collection. Manual Keep can
  restore it. Existing legacy history is migrated without clearing original records.
- Reader word cards use a side margin when enough space exists. Narrow screens use
  a compact bottom card. Page numbers and saved position remain; percentage is gone.
- Web hover now includes anchor text; ordinary link clicks still navigate. Opening
  a Web learning card shares collection/history with Reader through the worker.
- The service worker serializes learning mutations to avoid concurrent-tab lost
  updates. Saving a book no longer writes an old snapshot over vocabulary history.

## Boundaries

Reading encounter observation and persistent underlines currently apply to Reader,
not arbitrary webpages. Web mode shares deliberate lookups and statuses. Phrase
selection currently applies to Reader. No account sync, phone app, AI topic
classification, sense-specific mastery, or scientifically calibrated scheduling
is claimed. Dictionary lookup stays independent of Ollama. AI explanations remain
explicitly requested. Small curated domain lists can miss useful words; manual
Keep is available.

Engineering constants (two-second visibility, thirty-second reopen suppression,
context/day deduplication) are conservative interaction heuristics, not learning
science thresholds. Real retention and user experience still need use-based review.

## Installation

This release was built in an isolated checkout based on the clean Downloads
checkout at 6524fa3. The sandbox cannot write to that installed Downloads folder.
After the branch is pushed, update the existing checkout with a fast-forward pull
and reload its existing extension in chrome://extensions. Keep the same installed
extension identity so Chrome retains its local books and history. Do not delete
and reinstall it or copy a new browser profile over the original.
