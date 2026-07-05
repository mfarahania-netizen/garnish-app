# Guided Step Page Cleanup Report

Date: 2026-07-05

## Changes

- Main instruction remains always visible.
- Optional information is collapsed:
  - visual cue
  - doneness cue
  - short tip
  - recovery
- Timer label changed to natural copy: `تایمر N دقیقه`.
- AI help button is visually secondary.
- Main content is RTL and right-aligned.
- Large centered paragraph treatment was reduced.

## Tests

- `cook.smoke.test.jsx`: PASS
- Verified optional notes are not expanded by default.
- Verified timer label appears as `تایمر ۱۵ دقیقه`.
