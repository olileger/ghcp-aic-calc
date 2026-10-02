---
name: static-calculator-ui
description: Use when changing the calculator's HTML, CSS, browser interactions, accessibility, or responsive layout. Produces focused UI changes and browser checks while preserving Clawpilot themes, independent model shares, standalone operation, and GitHub Pages compatibility.
metadata:
  version: "1.0"
---

# Maintain the static calculator UI

## Scope and baseline

Read the markup, CSS, theme initialization, rendering functions, and affected
event handlers in `index.html` before editing. Keep this application static and
self-contained. Do not add a framework, backend, external font, CDN dependency,
telemetry, persistence, or new runtime network request without explicit approval.

The interface has four token-volume inputs, independent shares per catalogue
row, provider/model/tier search, USD and AI Credit sorting, share clearing,
and value reset. Preserve the unofficial-tool disclaimer and official pricing
link. The visible UI is mainly English; do not translate it as a side effect.

## Procedure

1. Identify the affected interaction, visual states, and calculation dependencies.
   Preserve unrelated working-tree changes. Agree on scope before intentionally
   changing semantics or localization.
2. Reuse the existing selectors, event delegation, formatting helpers, and
   `--cp-*` theme variables. Use theme tokens rather than new hard-coded colors.
3. Preserve light/dark selection through `clawpilotTheme` and the system color
   preference fallback. Check both explicit theme values and no override.
4. Preserve accessible labels, keyboard focus, visible focus indicators, table
   headers, sort-button `aria-pressed` state, and the live model count.
   Dynamic attributes must remain correctly escaped if model data handling changes.
5. Keep number-entry behavior, caret position, and shares stable across re-renders.
   Distinguish volume `input` events, share `input` and `change` events, and blur.
   Load `calculator-validation` for any change affecting values or totals.
6. Keep original model indices associated with their shares through filtering and
   sorting. A model name alone is not an identity because tiers can repeat it.
   Do not normalize independent percentages or automatically pick a context tier.
7. Verify the affected UI in an available browser. Use direct file opening for
   the standalone path and a local static server if the change affects URL or
   serving behavior. Do not claim static-server checks prove file-mode support.
8. Update `README.md` for changes affecting usage. Report meaningful limitations,
   including browser checks that could not be executed.

## Targeted browser checks

Select the checks relevant to the change; cover the full list for broad UI work.

| Area | Expected behavior |
| --- | --- |
| Initial load | Catalogue and zero totals render without console errors or runtime network dependencies. |
| Themes | `?clawpilotTheme=light`, `?clawpilotTheme=dark`, and system preference work with readable inputs, totals, and focus states. |
| Responsive layout | Check 320px, 560px, 900px, and a desktop width; input columns adapt and the wide table scrolls within its wrapper. |
| Volume entry | Decimal dots/commas, grouped digits, paste, deletion, blur, and caret position work; visible totals recalculate. |
| Shares | Zero, 100, fractional, and out-of-range values follow the current contract; changes affect only the intended model row. |
| Search | Provider, model, and tier matches are case-insensitive; count and empty state track results; hidden rows keep shares. |
| Sorting | Both directions work for USD and credits; pressed state matches the selection; share `change` reapplies sorting. |
| Clear and reset | Clear zeroes all shares; reset zeroes volumes, restores shares to 100, clears search, preserves sort, and focuses the first input. |
| Accessibility | Controls work with the keyboard, labels identify inputs, focus is visible, table headers remain usable, and live count updates are meaningful. |
| Static deployment | No build or backend is needed; file opening and root GitHub Pages serving remain compatible. |

For theme checks, emulate both light and dark system preferences where the browser
supports it. Respect reduced-motion preferences when adding animated behavior.
Check small USD and credit values independently of arithmetic correctness.

## Requirements and limits

- Runtime: a modern browser; browser automation is optional, not guaranteed.
- Dependencies: existing HTML, CSS, and vanilla JavaScript only.
- Network: unnecessary for UI checks apart from optionally checking the existing
  official source link. No authenticated API or MCP server is required.
- Filesystem: active checkout; screenshots or temporary helpers belong in an
  approved scratch location, not in the application by default.
- Shell: optional for the README's `python -m http.server 8000` command if Python
  is available. Avoid occupied ports and stop task-only servers after use.
- Human approval: required for changes outside the requested UI scope, dependency
  additions, deployment, or materially different share/billing behavior.
