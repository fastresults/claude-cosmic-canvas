
## Goal
Make every Settings row navigate to a working sub-page, and give the user obvious places to add **personas**, **voice samples**, **knowledge (LinkedIn / resume / notes)**, and **domains of expertise** — the pieces that actually shape what Eve writes.

## Why nothing happens today
`src/routes/_authenticated/settings.tsx` renders `<button>` rows with no `onClick` and no `<Link>`. There are also no child routes, so there's nowhere to go. Fix both.

## Route layout (new)

Convert `settings.tsx` into a layout + add child routes. TanStack file naming:

```
src/routes/_authenticated/
  settings.tsx                     ← layout: <Outlet /> + back-aware header
  settings.index.tsx               ← the current list (rows become <Link>s)
  settings.account.tsx             ← display name, email (read-only), sign out
  settings.voice.tsx               ← Personas + Voice samples + Directives
  settings.knowledge.tsx           ← Knowledge entries + Domains of expertise
  settings.distribution.tsx        ← Channel connections (LinkedIn, X, etc.)
  settings.notifications.tsx       ← Inbox rules placeholder (honest "coming soon")
```

Each child page gets a small `SettingsPageHeader` (title + back link to `/settings`).

## Sub-page contents

**1. Account (`settings.account.tsx`)**
- Read `profiles` row (server fn `getMyProfile`).
- Editable: `display_name`. Read-only: email (from `supabase.auth.getUser`).
- "Sign out" button moves here from the list (keeps existing handler).
- Server fn `updateMyProfile({ display_name })`.

**2. Voice & Style (`settings.voice.tsx`)** — the primary "make Eve sound like me" page
- **Personas** section
  - List `personas` for the user; show which one is `profiles.persona_active_id` with a "Active" badge.
  - Add persona (name), rename, delete, "Make active" (sets `profiles.persona_active_id`).
- **Voice samples** section (per active persona)
  - Loads `voice_profiles` row for the active persona (create on demand).
  - Textarea list of samples in `voice_profiles.samples` (jsonb array of `{ text, source? }`). Add / remove.
  - "How Eve uses this": one-liner explaining these feed the ghostwriter prompt.
- **Directives** section
  - Free-form rules stored in `voice_profiles.directives` (e.g. "Never use emoji", "Prefer active voice"). Add / remove chips.
- Server fns: `listPersonas`, `createPersona`, `renamePersona`, `deletePersona`, `setActivePersona`, `getVoiceProfile`, `upsertVoiceProfile({ samples, directives })`.

**3. Knowledge (`settings.knowledge.tsx`)** — LinkedIn / resume / anything Eve should "know"
- **Domains of expertise** section (small chips at top; makes the "what do you write about" bit obvious)
  - Lists `domains`; add (respect existing two-word check constraint — show inline error if violated); delete.
- **Knowledge entries** section
  - Lists `knowledge_entries` with `kind` badge (`linkedin`, `resume`, `note`, `url`).
  - "Add entry" opens a small form: kind (select), title, source URL (optional), content (textarea for pasted text — resume paste, LinkedIn About text, notes).
  - Delete per row. No embeddings work here — we just persist text; embeddings can be added later without UI change.
- Copy at top: "Paste your LinkedIn About, your resume, links, or notes. Eve uses these as source material — and never claims them as facts unless you say so."
- Server fns: `listDomains`, `addDomain`, `deleteDomain`, `listKnowledge`, `addKnowledge`, `deleteKnowledge`.

**4. Distribution (`settings.distribution.tsx`)**
- Lists `channel_connections` rows with status.
- For now: show LinkedIn / X / Email rows with either "Connected as @handle" or a disabled "Connect" button + "Coming soon" note (no OAuth wiring in this change).
- Delete existing connection is fine (calls `deleteChannel`).
- Server fns: `listChannels`, `deleteChannel`. No new OAuth flow.

**5. Notifications (`settings.notifications.tsx`)**
- Honest placeholder: "Inbox rules and snoozes are coming soon." Link back to Settings.
- No DB writes.

## Wiring the list page

`settings.index.tsx` replaces each `<button>` with a `<Link>`:

```tsx
<Link to="/settings/voice" ...>Voice & Style — Personas, samples, directives</Link>
```

Sign out row stays on the index for muscle-memory and is also on Account.

## Server functions

New file `src/lib/settings/settings.functions.ts` — one module for all list/mutate calls above. All use `.middleware([requireSupabaseAuth])`. Zod-validated inputs. No admin client, no schema changes. Provenance edges are out of scope for this pass (voice/knowledge edits don't need brain nodes yet).

Client data reads use TanStack Query with keys like `["personas"]`, `["voice", personaId]`, `["knowledge"]`, `["domains"]`, `["channels"]`, `["profile"]`. Mutations invalidate their own key.

## UI conventions
- Reuse existing primitives: `Pill`, existing input/button styles, `frosted` cards.
- Each section: heading, one-line explanation, then the interactive list. Empty states say what to add and why.
- No new dependencies.

## Verification
- Typecheck.
- Click through in Playwright: `/settings` → each row navigates → back arrow returns; add a persona, add a domain, add a knowledge entry, confirm they appear in the list after mutation.

## Out of scope
- OAuth flows for LinkedIn / X (Distribution stays informational).
- Embedding generation for knowledge entries (schema already has the column; add later).
- Billing / referrals UI (Account keeps the name + sign-out for now).
- Redesign of the settings home list — same rows, just clickable.
