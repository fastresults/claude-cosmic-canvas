The current global radius scale is too dramatic. I’ll dial every token down to a subtle, near-square curvature while keeping the scale intact so buttons, cards, inputs, and sheets still pick the right size token.

Changes to `src/styles.css` `@theme inline` radius tokens:

| Token | Current | New |
|-------|---------|-----|
| `--radius-sm` | `0.5rem` | `0.125rem` |
| `--radius-md` | `0.875rem` | `0.25rem` |
| `--radius-lg` | `1.25rem` | `0.375rem` |
| `--radius-xl` | `1.75rem` | `0.5rem` |
| `--radius-2xl` | `2.25rem` | `0.625rem` |
| `--radius-pill` | `999px` | `999px` (unchanged) |

This keeps pill buttons fully rounded, but every other component gets a crisp, square-ish corner with just a hint of rounding. No component files need to change because they already reference these tokens via Tailwind utilities (`rounded-md`, `rounded-lg`, etc.).