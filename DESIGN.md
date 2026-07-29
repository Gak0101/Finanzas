# Finanzas — Design system

This surface follows the Impeccable vocabulary: an `Operate` dashboard with explicit data states, a strong visual hierarchy and a documented product context.

## Visual idea

`Dark ledger / bright signal`: deep navy frames the working area, warm panels keep finance tables readable, and a single chartreuse accent marks positive motion and primary actions.

## Tokens

- Canvas: `#0d1118`
- Navigation: `#111821`
- Panel: `#f7f5ef`
- Ink: `#16202b`
- Muted ink: `#75808d`
- Accent: `#c8f56a`
- Positive: `#168261`
- Warning: `#bf7920`
- Negative: `#c75253`
- Radius: 12px panels, 7px controls; no decorative pill stacks

## States

- `API_OK`: current price returned by the configured provider.
- `FALLBACK`: last valid price retained after an API miss.
- Missing cost: em dash plus explanatory copy; do not infer a return.
- Manual: entered through an operation; do not imply broker execution.

## Components

- Summary hero: current value, known cost, known P/L and comparable return.
- Market panel: interactive Recharts view by position or P/L.
- Allocation panel: composition by asset type with visible totals.
- Holdings table: source state in the row, not hidden in a tooltip.
- Operation dialog: one explicit action, validation, and a clear local audit note.
