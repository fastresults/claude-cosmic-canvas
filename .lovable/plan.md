## Goal
Every orb must show a meaningful text label on hover — no exceptions, even if its descriptive title hasn't resolved yet or the source table row is missing.

## Current gap
`Orb.tsx` gates the label render on `hasLabel` (non-empty `node.label`). If `fetchLabel` returns `null` (missing row, unsupported `NodeType`, race before resolution), hovering shows nothing. The rule "never show generic type words" also currently blocks a hover-time fallback.

## Approach
Reconcile the two rules: persistent labels remain descriptive-only (never generic), but **hover** is always allowed to reveal *something* meaningful. When a real title isn't available, hover falls back to a human-friendly descriptor derived from the node type plus a short id suffix so the user can still identify what they're pointing at.

### Changes

1. `src/components/brain/three/palette.ts`
   - Add a `TYPE_HOVER_FALLBACK: Record<NodeType, string>` map with human-readable phrases (e.g. `draft → "Untitled draft"`, `image → "Untitled image"`, `knowledge → "Knowledge entry"`, `document → "Document"`, `campaign → "Campaign"`, `channel → "Channel"`, `scheduled → "Scheduled post"`, `entity → "Entity"`, `audience → "Audience"`, `domain → "Domain"`, `persona → "Persona"`, `voice_sample → "Voice sample"`, `directive → "Directive"`, `preset → "Preset"`, `mcp_client → "MCP client"`, `you → "You"`). These are used **only** on hover as a last resort, never as persistent labels.

2. `src/components/brain/three/Orb.tsx`
   - Compute `hoverLabel = node.label?.trim() || (TYPE_HOVER_FALLBACK[node.nodeType] + " · " + shortId)` where `shortId` is the last 4 chars of the raw id after the `type:` prefix (helps disambiguate multiple unresolved orbs).
   - Persistent label (yellow orbs / focused) still uses `node.label` only, and still hides when empty (unchanged rule).
   - Hover label always renders when `isHover` is true, using `hoverLabel`. Remove the `hasLabel` gate from the hover path.
   - Keep the same styled pill; only the string source changes.

3. `src/components/brain/three/useBrainGraph.ts`
   - Broaden `fetchLabel` fallbacks so more nodes resolve to real titles:
     - `draft`: also try `create_drafts.topic` / `seed` when `title` is null.
     - `image`: already covers prompt+filename — keep.
     - `document`: prefer `file_name`, then derive filename from `source_url`, then `source_type`.
     - `knowledge`: fall back to `source_url` host when `title` is null.
     - `scheduled`: include a short title if joinable; otherwise keep `channel · date`.
   - Retry `fetchLabel` once (500ms) if the initial fetch returns `null`, to cover realtime races where the edge arrives before the row is committed/visible.

4. No changes to persistent-label policy: yellow orbs and focused state still require a real `node.label`. The "no generic Draft" rule stays enforced for the always-visible pills; the fallback only appears while the user is actively hovering.

## Files touched
- `src/components/brain/three/palette.ts`
- `src/components/brain/three/Orb.tsx`
- `src/components/brain/three/useBrainGraph.ts`

## Verification
- Hover each orb type in `/brain`; a pill appears every time.
- Non-hovered non-yellow orbs remain unlabeled (persistent rule intact).
- Yellow orbs with resolved titles still show their real name; no "Draft/Content/Image" ever appears as a persistent label.
