# Editorial formatting for generated drafts

## Why drafts look bland
Two causes, both confirmed in code:

1. **The model is never asked to format.** `src/lib/create/format-rules.ts` tells the AI the structure ("problem; approach; evidence…") but never says to use Markdown. So bodies come back as plain-text walls — subheads like "1. Standing still is still a decision" are just another line, with no headings, lists, or emphasis to render.
2. **The renderer is minimal.** `src/components/primitives/Markdown.tsx` uses small, uniform `prose-sm` styling, and `StreamCanvas.tsx` renders each section as a plain card — no editorial hierarchy, pull quotes, or rhythm.

## Plan

### 1. Ask for real Markdown at generation time (`format-rules.ts`)
- Add a formatting directive for long-form formats (whitepaper, op-ed, case-study, press-release, newsletter, blog-style): use `##`/`###` for section and sub-section headings, numbered/bulleted lists where content enumerates, `**bold**` for key terms, and one `>` pull quote per major section for a standout sentence.
- Keep short-form formats (social posts, quick emails) unchanged — no header salad there.

### 2. Editorial rendering (`Markdown.tsx`)
- Upgrade the prose styling: larger, tighter display headings with clear h2/h3 hierarchy, generous paragraph spacing and measure (max line length), styled blockquotes as pull quotes (large italic display text, accent rule, no grey mumbling), proper list styling with accent markers, and horizontal rules as section dividers.
- Light and dark mode both covered via existing semantic tokens — no hardcoded colors.

### 3. Section cards with editorial rhythm (`StreamCanvas.tsx`)
- Section heading becomes a real display heading with a small accent kicker/rule above it.
- More whitespace inside cards; first paragraph of each section can get a subtle lead-paragraph size bump.

### 4. Verify
- Generate a test whitepaper draft signed in, screenshot it in light and dark mode, confirm headings, lists, and pull quotes render with editorial style.
- `bunx tsgo --noEmit` clean, vitest passes.

## Out of scope
- Changing which AI model writes drafts or its token limits.
- The separate company-research progress view.
