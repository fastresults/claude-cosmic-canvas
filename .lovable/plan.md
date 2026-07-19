# Replace all OS-level dialogs with app-generated modals

Native `window.prompt` / `window.confirm` / `alert` calls are triggering the browser's OS-styled dialog (the "An embedded page at … says" chrome in the screenshot). We already have `useConfirm()` for confirmations; we need a matching `usePrompt()` for text input, then sweep every remaining native call.

## 1. Add `PromptDialog` primitive

New file `src/components/prompt-dialog.tsx` modeled on `confirm-dialog.tsx`:

- `PromptDialogProvider` (queue + AlertDialog with an `<input>`).
- `usePrompt()` returning `(opts) => Promise<string | null>`.
- Options: `title`, `description?`, `label?`, `placeholder?`, `defaultValue?`, `confirmLabel?`, `cancelLabel?`, `required?`, `maxLength?`, `validate?: (v) => string | null`.
- Enter submits, Esc / Cancel resolves `null`, trims value before resolving.
- Uses the same shadcn `AlertDialog` + `buttonVariants` as `confirm-dialog.tsx` so styling matches the rest of the app.

## 2. Mount the provider

Wrap the app tree once, next to `ConfirmDialogProvider` (same file that already mounts it — likely `src/routes/__root.tsx` or a providers wrapper). Add `<PromptDialogProvider>` inside it so both hooks work everywhere.

## 3. Replace every native call

| File | Current | Replacement |
|---|---|---|
| `src/components/create/shared/SeedInput.tsx:165` | `window.prompt("Paste URL")` | `usePrompt({ title: "Add link", label: "Paste URL", placeholder: "https://…", required: true, validate: isUrl })` |
| `src/components/knowledge/DomainIngestZone.tsx:242` | `window.prompt("Paste a URL")` | same `usePrompt` shape |
| `src/routes/_authenticated/settings.voice.tsx:270` | `prompt("Name this voice")` | `usePrompt({ title: "Name this voice", label: "Voice name", required: true, maxLength: 60 })` |
| `src/routes/_authenticated/workspaces.$id.tsx:83` | `confirm("Delete this workspace? …")` | `useConfirm({ title: "Delete this workspace?", description: "Drafts will unlink but stay in your Library.", destructive: true })` |
| `src/routes/_authenticated/media.tsx:502` | `confirm(\`Delete "${asset.title}"? …\`)` | `useConfirm({ title: \`Delete "${asset.title}"?\`, description: "This can't be undone.", destructive: true })` |
| `src/routes/_authenticated/settings.presets.tsx:216` | `confirm(\`Delete preset …\`)` | `useConfirm({ title: …, description: "This also removes its Brain edges.", destructive: true })` |
| `src/routes/_authenticated/settings.default-profiles.tsx:186` | `confirm(\`Delete profile …\`)` | `useConfirm({ title: …, destructive: true })` |

Each call site becomes `async`, awaits the hook, and only proceeds on a truthy result. Hooks are called at component top-level (not inside the click handler closure) per React rules.

## 4. Guardrail

Add `no-restricted-globals` / `no-alert` entries for `alert`, `confirm`, `prompt` in `eslint.config.js` so future code can't reintroduce OS dialogs. Local identifiers named `confirm` (e.g. `MilestonePrepSheet.tsx`, `ImageAssociationSheet.tsx`, and the `useConfirm` return value itself) are unaffected because the rule targets the global only.

## 5. Verify

- `tsgo` typecheck.
- Manually trigger each replaced flow in the preview: link paste in composer, domain ingest, voice create, workspace/media/preset/profile delete — confirm the new themed modal appears and there is no OS chrome.
