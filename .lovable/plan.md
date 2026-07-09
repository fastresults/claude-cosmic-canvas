# Plan: Replace native `confirm()` with themed confirmation modal

## Goal
Native browser `confirm()` dialogs (unstyled OS modals) currently appear when deleting voices, knowledge entries, drafts, or disconnecting channels. Replace all of them with a modal that renders through our design system (shadcn `AlertDialog`), so every "system prompt" matches the app's look.

## Approach

### 1. New primitive: `useConfirm()` hook + `<ConfirmDialogProvider />`
Create `src/components/confirm-dialog.tsx`:
- Context provider mounted once near the app root.
- Exposes `const confirm = useConfirm()` returning a `Promise<boolean>`.
- Signature: `confirm({ title, description?, confirmLabel?, cancelLabel?, destructive? })`.
- Renders a single `<AlertDialog>` (shadcn) with themed content — destructive variant styles the confirm button with the `destructive` token.
- Queues sequential calls (one modal at a time).

### 2. Mount the provider
Wrap children in `src/routes/__root.tsx` (inside the existing providers) with `<ConfirmDialogProvider />` so every route has access.

### 3. Replace all `confirm(...)` call sites
Five occurrences, each swapped for `await confirm({...})`:
- `src/routes/_authenticated/settings.voice.tsx:234` — delete voice
- `src/routes/_authenticated/settings.voice.$id.tsx:323` — delete voice (detail)
- `src/routes/_authenticated/settings.knowledge.tsx:243` — delete knowledge entry
- `src/routes/_authenticated/settings.distribution.tsx:63` — disconnect channel
- `src/routes/_authenticated/library.tsx:549` — bulk delete drafts

Each handler becomes async; destructive actions pass `destructive: true`.

### 4. Lint guard (optional, lightweight)
Add a short comment/README note in `src/components/confirm-dialog.tsx` instructing future code to use `useConfirm()` instead of `window.confirm` / `alert`. No ESLint rule added unless requested.

## Out of scope
- `window.alert` / `window.prompt` — none currently used in the codebase; the hook is confirm-only for now (can extend later).
- Toast/notification styling (already themed).
- Any backend, schema, or business-logic changes.

## Technical notes
- Uses existing `src/components/ui/alert-dialog.tsx` — no new dependencies.
- Provider uses `useState` for the current request + a ref queue; resolves the promise on confirm/cancel/close.
- Destructive confirm button: `className={cn(buttonVariants({ variant: "destructive" }))}`.
