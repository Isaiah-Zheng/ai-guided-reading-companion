# Kindle Capture Experiment

**Visibility: public. Status: experimental / unreliable.**

This Windows prototype investigates whether visible text in Kindle for Web can be selected, copied and saved before moving to the next screen. The intended use was to supply text for a personal assisted-reading workflow in AI Reader.

**The experiment did not achieve reliable end-to-end capture. Manual copying is currently the preferred workflow.** This is an engineering experiment, not a working ebook downloader or a supported AI Reader feature.

## Current implementation

- Python 3.10+ with standard-library Windows APIs; no third-party packages.
- Three mouse positions calibrated with F8: selection start, selection end and next-page arrow.
- The latest revision waits for the webpage to copy automatically. It does not send Ctrl+C during capture.
- Up to 30 seconds per capture, including 5 seconds of unchanged new clipboard text before accepting it.
- An additional 2-second pause before the next-page click, with another clipboard-content check.
- Stops on empty, short, unchanged or duplicate text, similar page openings, F9, or a foreground-window change.
- Saves each accepted capture immediately, plus a combined text file and a status manifest.

These checks are heuristics. Stable clipboard content does not prove that the webpage has completed its work, that every line was captured, or that the next page was reached.

## What happened during manual trials

Some text was captured, but selection and automatic copying repeatedly stalled. Two saved captures started with the same passage and ended at different positions: different clipboard contents did not prove a successful page turn.

A failing network request returned HTTP 400 with `Invalid viewport dimensions`. Its precise relationship to selection, browser layout and the automation remains unresolved. There is no confirmed evidence of anti-bot detection or deliberate text scrambling.

See [EXPERIMENT_NOTES.md](EXPERIMENT_NOTES.md) for observations, attempted changes and remaining questions.

## Run a small trial

This remains unreliable. Start with five screens and manually check every boundary.

1. Open a book you can access in Kindle for Web and sign in yourself.
2. Use a single text column. Close developer tools and keep window position, font size and browser zoom fixed.
3. Confirm that selecting a passage manually copies it to the clipboard. If the webpage requires a Copy button, this revision will not handle that flow.
4. Open a terminal in this folder and run:

```powershell
python kindle_capture.py --pages 5
```

Alternatively, double-click `Start_5_Pages.cmd`. Use `py` instead of `python` if that is your Python launcher.

5. Focus the browser, position the pointer at the first visible letter and press F8. Do not drag manually.
6. Position it at the last visible letter and press F8. Stay within text, away from outer margins and the footer.
7. Position it at the next-page arrow and press F8. Capture starts after five seconds.

Some laptops require Fn+F8. F9 (or Fn+F9) stops the script. Do not operate the mouse or keyboard while capture is running. It uses the real pointer and clipboard, replaces clipboard contents through normal copying and may change synced reading progress.

The final-word position changes between pages, so a fixed selection can omit content. Clicking a button is not proof of navigation. The foreground-window check cannot detect another tab inside the same browser window.

## Output and continuation

Each run creates its own `captures/<timestamp>_<suffix>/` folder with:

- `page_0001.txt`, etc.: raw copied text, not original book page numbers.
- `combined.txt`: captures separated explicitly; no guessed reconstruction.
- `manifest.json`: order, character counts, normalized hashes and completion/stop status.

Files are saved locally; the script makes no network requests or AI calls. Outputs are ignored by this folder's `.gitignore`. Do not commit captured book text, generated ebooks, account information or browser-session data.

There is no automatic resume. Check the last saved passage against the book before starting another batch. Exact-duplicate detection operates within one run; similar-opening checks compare consecutive accepted captures. Neither proves completeness.

Options for a slower experiment:

```powershell
python kindle_capture.py --pages 5 --copy-timeout 45 --stable-seconds 8 --before-turn 3 --delay 4
```

The program does not log in, decrypt files, access hidden content APIs, or bypass copy limits. Stop if the website reports a copying restriction.

## Validation

```powershell
python -m unittest test_capture.py
```

**11 logic tests passed locally on 2026-10-20.** Tests cover delayed clipboard updates, stabilization, stale-content rejection, duplicate handling and raw-text persistence. They use a fake Windows interface and do not certify browser compatibility, native mouse/clipboard integration, page completeness or navigation.

## Project ownership

The script and tests were AI-generated, with user-led manual trials and debugging observations. This repository records that collaboration and its limits; a passing test suite or a saved capture does not establish independent mastery or product readiness.
