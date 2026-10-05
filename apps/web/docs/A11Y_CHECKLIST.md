# A11Y Checklist — Next.js scaffold (2026-10-05)

Status vocabulary: DONE (in scaffold) / PENDING (builder worker's components) /
NEEDS-VERIFICATION (needs a real check with assistive tech).

## Scaffold-level (DONE 2026-10-05)

- [x] **`<html lang="en">`** — present in `app/layout.tsx`.
- [x] **Skip link** — "Skip to main content" in the root layout, visually
      hidden until keyboard focus (`app/globals.css` `.skip-link`). Target:
      `<main id="main-content">` — every page template MUST render this id.
- [x] **`:focus-visible` styles** — 3px gold outline on dark purple, never
      `outline: none` without a higher-contrast replacement (`app/globals.css`).
- [x] **Color-contrast-safe defaults** — dark purple + gold design system:
      body text `--aa-cream` (#f3ecdb) ≈ 13.2:1 on `--aa-purple-deep` (#17102b);
      gold `--aa-gold` (#d9a93c) ≈ 7.4:1; secondary `--aa-cream-dim` ≈ 8.1:1.
      All exceed WCAG AA (4.5:1).
- [x] **`prefers-reduced-motion`** — animations/transitions disabled
      (`app/globals.css`).
- [x] **No icon-only elements without labels in the scaffold** — verified:
      scaffold has no icon-only buttons/links. Rule: every icon-only control
      MUST carry `aria-label`.
- [x] **Semantic landmarks** — `/soap-shop` uses `<main id="main-content">`,
      `<section aria-label="…">`, heading hierarchy h1 → h2 → h3.

## Builder worker — self-verification required (PENDING)

The soap-builder worker owns these; nothing below may ship unverified:

1. **Keyboard trap-free step flow** — the 6-step ritual must be fully
   operable by keyboard: every custom control (base cards, shape picker,
   scent recipes, oil toggles, botanical selector, color swatches) reachable
   by Tab, activatable by Enter/Space, with visible focus. No focus may be
   trapped inside a step. Esc closes any dialog/overlay and returns focus to
   the trigger.
2. **aria-live for the blend readout** — the dynamic blend summary
   (oils selected, profile tags) MUST be announced via an `aria-live="polite"`
   region so screen-reader users hear the blend change as they toggle oils.
3. **aria-live for the reveal** — the "Your Alchemy Is Complete ✨" reveal
   step MUST move focus to the reveal heading (tabindex="-1" + .focus()) or
   announce via aria-live; the order summary must be readable in DOM order.
4. **Labels on all custom controls** — every swatch, toggle, and card:
   real `<label>`, `aria-label`, or `aria-labelledby`. Color swatches must
   announce the color NAME, not just the hex (hex alone is meaningless).
5. **Step progress** — expose the ritual position as
   `aria-label="Step 3 of 6: Scent"` (or `aria-valuenow` on a progressbar);
   completed steps marked `aria-current="step"`.
6. **Per-slot bundle editor** — each of the 5 slots is a labeled group
   (`<fieldset>`/`<legend>` or role="group" + aria-label); slot identity
   ("Slot 2 — Medium Rose") announced on focus.
7. **Live preview canvas** — the Wave Rectangle preview is decorative for
   AT: `aria-hidden="true"` on the canvas with a text equivalent describing
   the current configuration nearby.
8. **Form errors** — validation errors announced via `aria-live="assertive"`
   or `role="alert"`, with `aria-invalid` + `aria-describedby` on the field.
9. **Touch targets** — minimum 44×44px for all interactive elements (mobile-first).
10. **No emoji as sole content** — every emoji (✨ etc.) paired with text or
    `aria-hidden` + labeled alternative.

## Shared rules (all workers)

- Never use `outline: none` without a replacement focus indicator.
- Never convey information by color alone (pair with text/icon/label).
- Decorative images: `alt=""` + `aria-hidden`; meaningful images: real `alt`.
- Test with keyboard-only navigation before every handoff; screen-reader
  pass (NVDA/VoiceOver) before IMPLEMENTED status.
