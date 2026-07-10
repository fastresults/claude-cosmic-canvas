# Answer first

No. Adam's résumé (`adam_anderson_resume.pdf`, uploaded 06:51 UTC today) is saved in the Knowledge Base but is **not** visible in the Brain.

**Why:** the Brain graph is built entirely from rows in `brain_edges`. I checked — there is no `brain_edges` row referencing that entry (or any knowledge entry). The `ingestEntry` server function writes to `knowledge_entries` / `knowledge_chunks` but never calls `writeEdge`, so nothing links the new entry to `you`.

# Plan — make Knowledge appear in the Brain

## 1. Emit a brain edge on every successful ingest

In `src/lib/knowledge/knowledge.functions.ts`, at the end of `ingestEntry` (after the entry row + chunks are written), insert one edge:

```
you → SOURCED_FROM → knowledge:<entry.id>
meta: { source_type, title, kind }
```

Use a server-side Supabase client scoped to the authenticated user (same one the function already uses to insert the entry) so RLS on `brain_edges` passes. Wrap in try/catch and log — ingest must not fail if the edge insert fails.

## 2. Backfill existing entries

One-time migration to create `you → SOURCED_FROM → knowledge:*` edges for every current `knowledge_entries` row that has no matching `brain_edges` row. This covers Adam's résumé and anything else uploaded before the fix.

```sql
INSERT INTO public.brain_edges (user_id, src_type, src_id, edge_kind, dst_type, dst_id, meta)
SELECT e.user_id, 'you', e.user_id, 'SOURCED_FROM', 'knowledge', e.id,
       jsonb_build_object('source_type', e.source_type, 'title', e.title)
FROM public.knowledge_entries e
WHERE e.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.brain_edges b
    WHERE b.dst_type = 'knowledge' AND b.dst_id = e.id
  );
```

(Note: `src_type='you'` uses `user_id` as `src_id` — matches the shape `useBrainGraph` expects, which collapses `src_type='you'` into the single `YOU` node regardless of `src_id`.)

## 3. Archive removes the edge (optional, same edit)

When `archiveEntry` sets `archived_at`, also delete the `you → knowledge:<id>` edge so the Brain stays in sync with what the user sees in Knowledge. Un-archive re-inserts it.

## 4. Verify

- Reload `/brain` → Adam's résumé orb appears connected to You, labelled from `knowledge_entries.title` (label resolver already handles `knowledge` type).
- Upload a new note → new orb appears live via the existing realtime subscription on `brain_edges`.

# Out of scope (call out, don't build now)

- Linking knowledge to `entity` / `domain` nodes based on extracted résumé structure (roles, companies, skills). That's a richer graph enrichment step — worth doing next, but separate from "show it at all".
- Chunk-level nodes. Keep one orb per entry.
