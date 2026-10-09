# Numbat Maths

A Year 1 maths practice app for iPad, built as an offline-first PWA. Pip the numbat talks the child through four islands that map to the Victorian Curriculum 2.0 Mathematics Level 1:

| Island | What it practises | VC2.0 Level 1 |
| --- | --- | --- |
| Sharing Equally | Drag things onto friends' plates, check it is fair, say how many each (with leftovers and groups of ten as extensions) | VC2M1N06 |
| Equal Groups | Groups of 2, 5 and 10, skip counting, "how many groups?" | VC2M1N03, VC2M1A01 |
| Numbers to 120 | Find on a track or 120 chart, tens and ones, before/after, ordering | VC2M1N01, VC2M1N02 |
| Add and Take Away | Ten frames, part-part-whole, make ten, doubles, subtraction within 20 | VC2M1N04, VC2M1N05 |

Design notes: every instruction is spoken (Web Speech, Australian English voice when available), short mastery-based quests with gentle hints, spaced review of shaky skills, stickers instead of shops, and a hold-to-open grown-ups page with per-skill accuracy and what to practise at home. Everything is stored on the device; there are no accounts, analytics or network calls after the first load.

## Install on an iPad

1. Open the site in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open it from the Home Screen: it runs full screen, works offline, and in both orientations.

## Develop

Plain HTML, CSS and ES modules; no build step. Serve the folder with any static server, e.g. `python3 -m http.server 8124`.

- `tests/play.mjs` plays through a quest on iPad emulation (Playwright) and screenshots to `screens/`.
- `tests/make-icons.mjs` regenerates the PNG icons and splash screens from `assets/icons/icon.svg`.

Fonts: Fredoka and Nunito (SIL Open Font License), bundled. Illustrations are original SVG.
