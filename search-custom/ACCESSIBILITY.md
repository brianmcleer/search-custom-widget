# Accessibility (WCAG 2.1 AA) - audit & conformance notes

This widget was reviewed against WCAG 2.1 AA. Scope covers the **runtime UI**
(what end users of the published app see) and the **settings panel** (what app
authors use in Experience Builder), plus the **popup HTML** the widget
generates.

## Summary of what was reviewed and updated

### Runtime widget (`src/runtime/widget.tsx`)
- The widget container is exposed as a **search landmark** (`role="search"`
  with an `aria-label`), so assistive tech can find and label the region
  (WCAG 1.3.1, 2.4.1).
- The status line ("No map linked", "waiting for the map view…", etc.) is a
  **polite live region** (`role="status"` / `aria-live="polite"`), so state
  changes are announced (WCAG 4.1.3).
- Status text color was darkened to meet **contrast** minimums (WCAG 1.4.3).
- The search box itself is the Esri `Search` widget, which provides its own
  labeled input, keyboard operation, and suggestion list semantics.

### Generated popups & links (`src/runtime/custom-search.ts`)
- Removed the "Click here" link pattern. Default link text is now descriptive
  ("Open link"), and every generated link carries an `aria-label` of the form
  "<field>, opens in a new tab" so the link purpose and new-tab behavior are
  clear (WCAG 2.4.4, 3.2.5). This applies to the auto-generated Arcade popup,
  the spatial-lookup field lists, and static lines.
- External links use `rel="noopener noreferrer"`.
- Field-list section headings render as real `<h4>` headings (WCAG 1.3.1).

### Settings panel (`src/setting/setting.tsx`)
- Every form control (text inputs, numeric inputs, selects, switches, and text
  areas) has a programmatic **accessible name** via `aria-label` matching its
  visible label - visible-text-only association is not relied on (WCAG 1.3.1,
  3.3.2, 4.1.2).
- "Remove" buttons (which otherwise all read identically) now have **distinct,
  descriptive names** - e.g. "Remove search source <name>", "Remove lookup rule
  N", "Remove URL rule N" (WCAG 2.4.6, 4.1.2).
- The XML import/view, Arcade, and JSON editor text areas (which use adjacent
  helper text rather than a wrapped label) have explicit `aria-label`s.
- Import/export status messages are a polite live region (WCAG 4.1.3).

## Notes & ongoing considerations
- **Keyboard:** all controls are standard jimu-ui / Esri components and operate
  with keyboard; focus order follows DOM order.
- **Authoring content:** authors can type their own placeholders, messages,
  link text, and Arcade. The accessibility of *that* content (e.g. meaningful
  link text, sufficient color contrast in custom popup HTML) is the author's
  responsibility - the widget provides accessible defaults and structure.
- **Color contrast** of the map basemap behind an on-map search box is outside
  the widget's control; prefer the in-widget placement when contrast matters.
- This document reflects a code-level review; for formal conformance, pair it
  with manual screen-reader testing (NVDA/JAWS/VoiceOver) in your deployment.
