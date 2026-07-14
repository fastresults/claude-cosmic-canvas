
-- 1. workspace_strategy
CREATE TABLE public.workspace_strategy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.opportunity_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  thesis text,
  target_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  phases jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel_strategy jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workspace_strategy_workspace_idx ON public.workspace_strategy(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_strategy TO authenticated;
GRANT ALL ON public.workspace_strategy TO service_role;

ALTER TABLE public.workspace_strategy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workspace strategy"
  ON public.workspace_strategy
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunity_workspaces w
      WHERE w.id = workspace_strategy.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunity_workspaces w
      WHERE w.id = workspace_strategy.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE TRIGGER workspace_strategy_updated_at
  BEFORE UPDATE ON public.workspace_strategy
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

-- 2. workspace_items additions
ALTER TABLE public.workspace_items
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS release_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS release_notes text;

ALTER TABLE public.workspace_items
  DROP CONSTRAINT IF EXISTS workspace_items_release_status_check;
ALTER TABLE public.workspace_items
  ADD CONSTRAINT workspace_items_release_status_check
  CHECK (release_status IN ('draft','scheduled','awaiting_approval','held_missing_day','approved','released','skipped'));

CREATE INDEX IF NOT EXISTS workspace_items_release_status_idx
  ON public.workspace_items(release_status, scheduled_date);
