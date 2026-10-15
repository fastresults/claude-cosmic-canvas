# Desktop experience: recommendation and phased plan

## 1. Recommendation (summary)

**Option C, built on an A foundation: one responsive codebase, with a single responsive app shell and dedicated multi-pane layouts only for the 4 screens that clearly benefit (Create editor, Library, Milestone workspace, Brain).**

Why:
- All data, AI calls, streaming, auto-save and onboarding gates already live in hooks and server functions, not in the screens. Layout can change without touching any of it — no duplicated business logic, no second app.
- Option B (two shells per screen) doubles every future screen. Option A alone wastes the desktop on the editor and library, where side-by-side panes are the whole point.
- Hybrid keeps one component tree per screen; desktop panes are just extra regions shown at `lg:` and up, fed by the same hooks.

Trade-offs: Maintenance — one file per screen, breakpoints inline. Consistency — same tokens, shadcn parts, fonts. Performance — desktop-only panes are lazy-loaded, so mobile ships no extra code. Future features — build once mobile-first, optionally add a desktop pane.

## 2. Current app review

- **Navigation:** fixed TopBar (h-14) + fixed BottomNav (6 tabs: Home, Library, Arcs, Queue, Brain, Settings) + floating ComposerBar above it. Everything sits in `max-w-2xl`/`max-w-3xl` centered columns (45 uses), which is why desktop looks like a stretched phone.
- **Layout method:** almost no breakpoints (~50 `sm:/md:/lg:` uses in app code). `useIsMobile` exists but is unused outside the stock sidebar. shadcn `Sidebar` is installed but unused.
- **Mobile-only surfaces:** `EveSheet` (vaul bottom drawer) used by ~20 secondary surfaces (capture sheets, draft detail, image association, domain/entry detail, milestone prep, schedule). `DecisionDock` sticky bottom bar. Fixed FABs (`bottom-24 right-5`).
- **Touch-only interactions:** hold-to-speak (Orb, HoldToSpeakButton), ThumbPeek long-press, BrainSearch pointer handling.
- **AI touchpoints:** Home orb + rotating suggestions; ComposerBar (global prompt, voice); Create editor (streamed drafts, title gate, image generation sheet); Milestone workspace (plan arc, "Draft all"); Knowledge research / company dossier (step progress); Brain "Ask Eve" bar; onboarding.
- **Hardest to adapt:** Create editor (streaming canvas + dock + several sheets, 21K file), ImageAssociationSheet (26K, built as a stacked sheet), Brain (3D canvas + HUD overlays assume portrait), Settings (21 sub-pages each with their own header).

## 3. Desktop design

### Breakpoints
```text
< 768   mobile    — exactly today's layout (no change)
768+    tablet    — wider content, sheets become centered dialogs, bottom nav kept, 44px tap targets kept
1024+   desktop   — left sidebar replaces bottom nav; multi-pane screens activate; AI panel available
1440+   wide      — AI panel docked open by default; extra column in grids
```
Reading text stays capped (~70ch / `max-w-3xl`); forms cap at `max-w-xl`; only grids, tables and panes use the full width.

### Navigation
- Bottom tab bar → collapsible left sidebar (icons + labels, collapses to icon rail; setup-lock icons preserved). Same tab list, one source.
- TopBar stays, gains: global search field (opens command palette), profile/defaults pills moved here from the DefaultsStrip.
- Settings: left sub-nav list + content pane instead of a list page that drills in.

### AI on desktop
- **Eve panel**: a right-side docked panel (resizable, ~380px) that holds the ComposerBar, voice orb and recent runs. Stays open alongside any screen; replaces the floating composer at `lg+`. Toggle with Cmd/Ctrl+J.
- **Generate left, result right**: Create editor becomes brief/settings + sources on the left, live streaming draft on the right; image generation opens inline in the right column instead of a sheet.
- **Progress**: streaming text stays word-by-word; long jobs (research, Draft all) show a step list in the panel so the user can keep working elsewhere.
- **Keyboard**: Enter sends, Shift+Enter newline everywhere; Cmd/Ctrl+K real command palette (navigate, create format, switch voice/profile, search drafts) replacing today's "jump to Library"; existing `g`-shortcuts kept; Cmd+S rename/save draft, Cmd+Enter generate, Esc closes panels.
- **History**: Eve panel lists recent drafts and runs; Library shows a detail preview pane so past outputs are scannable without opening each.

### Component behavior by breakpoint
- `EveSheet` → becomes `ResponsiveSheet`: bottom drawer on mobile, centered dialog (md) or right side panel (lg) on desktop. One change upgrades all ~20 sheets.
- DecisionDock → inline action bar at the top/bottom of the pane, not viewport-sticky.
- Stacked cards → 2–3 column grids (drafts, media, voices, audiences); Library and Queue get a table/list view toggle.
- Long-press → hover preview + right-click/"…" menu; hold-to-speak also works as click-to-toggle and Space key; drag-and-drop already exists for knowledge (DesktopDropzone) — extend to Media.
- FABs hidden at `lg+`; their action moves into the page header.

## 4. Screen-by-screen

| Screen | Current mobile | Proposed desktop | Size |
|---|---|---|---|
| Shell (all pages) | Top bar, bottom tabs, floating composer | Sidebar + top bar + dockable Eve panel | M |
| Home | Centered orb + suggestions | Orb + suggestions left, recent drafts / active milestones grid right | S |
| Create index | Stacked format cards + recent drafts | Format grid (3–4 col) + recent drafts column | S |
| Create editor | Single column, stream, sticky dock, sheets | Two panes: brief/sources / live draft; images inline | L |
| Library | Tabs + collapsible list | List + detail preview pane, list/table toggle | M |
| Drafts / Archive | Card list | Grid or table with bulk select | S |
| Arcs / Workspaces list | Card list + FAB | Grid, header button | S |
| Milestone workspace | Stacked phases + items | Phase timeline left, item detail/draft right | L |
| Queue | List | Calendar/week view + list | M |
| Brain | Full-screen 3D + overlays | Canvas + persistent legend/search sidebar + peek panel instead of sheet | M |
| Media hub | Grid + upload sheet | Wider grid, drag-drop upload, detail side panel | S |
| Settings (21 pages) | List page → drill-in | Sub-nav + content pane, forms capped width | M |
| Knowledge / Domains / Audiences / Voice | Lists + detail sheets | List + detail side panel | M |
| Onboarding | Full-screen steps | Centered card with step rail on the left | S |
| Auth / legal | Centered form | Unchanged (already fine), split-brand panel optional | S |

## 5. New shared components and hooks
- `useBreakpoint()` (SSR-safe, returns mobile/tablet/desktop/wide) — rarely needed; CSS breakpoints first.
- `AppShell` (extended) with `AppSidebar` (built on installed shadcn Sidebar), `MobileNav` (current BottomNav).
- `EvePanel` — docked AI panel wrapping existing ComposerBar + orb; state persisted per user.
- `ResponsiveSheet` — drawer / dialog / side panel by breakpoint; `EveSheet` becomes an alias.
- `SplitPane` / `MasterDetail` — list + detail with URL-driven selection (`?id=`), so mobile navigates and desktop shows side by side from the same state.
- `PageHeader` — title, actions (replaces FABs on desktop).
- `CommandPalette` — shadcn Command, registry of actions.
- `ActionMenu` — "…"/right-click equivalent for long-press actions.

## 6. Phased build
- **Phase 1 – Shell:** sidebar, top bar search, breakpoint-aware content widths, FAB→header, `ResponsiveSheet` swap. Every screen stops looking like a phone.
- **Phase 2 – Core AI screens:** Eve panel; Create editor two-pane; Milestone workspace two-pane; Library master-detail.
- **Phase 3 – Remaining:** Settings sub-nav, Brain side panels, Queue calendar, grids for drafts/media/voices/audiences, onboarding.
- **Phase 4 – Polish:** command palette, shortcut set + updated `?` sheet, hover/right-click menus, click-to-talk, focus management, tablet tuning.

Each phase is verified with screenshots at 393px, 820px, 1280px and 1600px, in light and dark.

## 7. Risks and prevention
- **Mobile regressions:** all desktop styles are additive at `md:`/`lg:` only; mobile classes untouched. Screenshot diff at 393px before/after each phase.
- **Sheet→dialog swap breaking flows** (focus, unsaved-changes guard, nested sheets in image flow): migrate behind one primitive, test each of the ~20 callers.
- **Hydration flashes** from JS breakpoint checks: prefer CSS show/hide; `useBreakpoint` only after mount.
- **Onboarding gate bypass** via new sidebar links: sidebar reuses the same `requiresSetup` lock logic as BottomNav.
- **Two composers at once:** composer renders in exactly one place per breakpoint.
- **3D Brain resize cost:** debounce canvas resize, keep offscreen pause.

## 8. Questions before starting
1. Should the Eve AI panel be open by default on desktop, or opened on demand?
2. Tablet (768–1023): keep bottom tabs (touch-first), or switch to the collapsed sidebar?
3. Queue: do you want a calendar view on desktop, or just a wider list?
4. Any screens you rarely use on desktop that can stay simply "wider mobile" to save effort?
