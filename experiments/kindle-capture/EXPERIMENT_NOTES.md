# Experiment notes

Date: 2026-10-20

## Goal

Explore a visible-page collection workflow that could feed AI Reader's assisted-reading export. The goal was comfortable reading on an e-ink device, with prepared language assistance.

## Observations versus hypotheses

| Observation | What it establishes | What it does not establish |
| --- | --- | --- |
| Manual selection could copy short passages quickly. | Some visible text could be copied in that session. | Full-book export or reliable automated copying. |
| Automated selection sometimes left a persistent loading indicator. | The selection-to-copy flow stalled during trials. | Anti-bot detection or a specific internal cause. |
| Changing the selection by one word sometimes restored copying; refreshing could reset the behavior. | The behavior depended on selection/session state. | A diagnosed viewport-boundary or caching bug. |
| A network request returned HTTP 400 and `Invalid viewport dimensions`. | At least one request was rejected with that message. | Which component produced the dimensions or caused the error. |
| Two saved texts shared an opening but had different lengths. | Exact hashes alone missed a likely repeated-page capture. | Correct page progression or complete source text. |
| The user observed copying and page clicks overlapping. | Timing needed further investigation. | That a longer delay would solve all failures. |

## Revisions attempted

1. Initial version: calibrated drag, Ctrl+C and next-page click. A startup requirement for existing clipboard text blocked runs when the clipboard held an image or no text.
2. Second version: removed that prerequisite; checked clipboard changes after selection and attempted Ctrl+C if automatic copying had not appeared quickly. This remained unreliable and accepted differently sized captures from the same passage.
3. Current version: only waits for automatic copying; waits for stable text and a pre-navigation buffer; rejects similar consecutive page openings. Subsequent user reports still indicated unreliable automatic copying. Reliable end-to-end operation remains unverified.

Only the current script is included here. Earlier revisions are described as experiment history, not shipped as alternative working versions.

## What should be investigated before more automation

- Compare successful manual and failing automated selections with identical text boundaries and a fixed browser layout.
- Determine whether the copying behavior belongs to Kindle itself or an installed browser extension.
- Correlate failing requests with a specific selection action before attributing causality.
- Find a navigation-completion signal instead of assuming a click changed pages.
- Verify first/last words and adjacency across captures; fixed coordinates cannot guarantee coverage.

## Current decision

Pause automatic selection and pagination. Prefer manual copying, then explicit review and assisted-reading processing. A manual paste collector could be a separate future experiment; it is not implemented here.

The reusable engineering lesson is to separate successful input simulation, asynchronous application completion, copied-data correctness and actual navigation. Each needs its own observable evidence.
