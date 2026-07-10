
-- opportunity_workspaces
CREATE TABLE public.opportunity_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  moment_type TEXT NOT NULL,
  target_date DATE,
  ai_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  total_items INT NOT NULL DEFAULT 0,
  completed_items INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_workspaces TO authenticated;
GRANT ALL ON public.opportunity_workspaces TO service_role;
ALTER TABLE public.opportunity_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspaces" ON public.opportunity_workspaces
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER opportunity_workspaces_updated_at
  BEFORE UPDATE ON public.opportunity_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX opportunity_workspaces_user_updated_idx
  ON public.opportunity_workspaces(user_id, updated_at DESC);

-- workspace_items
CREATE TABLE public.workspace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.opportunity_workspaces(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  sort_order INT NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'ongoing',
  status TEXT NOT NULL DEFAULT 'pending',
  content_generation_id UUID,
  generated_output TEXT,
  generation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_items TO authenticated;
GRANT ALL ON public.workspace_items TO service_role;
ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspace items" ON public.workspace_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.opportunity_workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.opportunity_workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()));
CREATE TRIGGER workspace_items_updated_at
  BEFORE UPDATE ON public.workspace_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX workspace_items_workspace_sort_idx
  ON public.workspace_items(workspace_id, sort_order);
CREATE INDEX workspace_items_scheduled_idx
  ON public.workspace_items(workspace_id, scheduled_date);

-- Link create_drafts to workspaces
ALTER TABLE public.create_drafts
  ADD COLUMN workspace_id UUID REFERENCES public.opportunity_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN workspace_item_id UUID REFERENCES public.workspace_items(id) ON DELETE SET NULL,
  ADD COLUMN scheduled_date TIMESTAMPTZ,
  ADD COLUMN distribution_channel TEXT;
CREATE INDEX create_drafts_workspace_idx ON public.create_drafts(workspace_id);
CREATE INDEX create_drafts_workspace_item_idx ON public.create_drafts(workspace_item_id);

-- Trigger: bump completed_items when a workspace-scoped draft becomes published.
CREATE OR REPLACE FUNCTION public.tg_workspace_bump_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NOT NULL
     AND NEW.status = 'published'
     AND (OLD.status IS DISTINCT FROM 'published') THEN
    UPDATE public.opportunity_workspaces
      SET completed_items = completed_items + 1
      WHERE id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER create_drafts_workspace_bump
  AFTER UPDATE OF status ON public.create_drafts
  FOR EACH ROW EXECUTE FUNCTION public.tg_workspace_bump_completed();

-- Trigger: cascade archive from workspace to its drafts.
CREATE OR REPLACE FUNCTION public.tg_workspace_cascade_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status IS DISTINCT FROM 'archived' THEN
    UPDATE public.create_drafts
      SET archived = true, status = 'archived'
      WHERE workspace_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER opportunity_workspaces_cascade_archive
  AFTER UPDATE OF status ON public.opportunity_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.tg_workspace_cascade_archive();

-- Trigger: keep total_items in sync as items are added/removed.
CREATE OR REPLACE FUNCTION public.tg_workspace_items_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.opportunity_workspaces
      SET total_items = total_items + 1 WHERE id = NEW.workspace_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.opportunity_workspaces
      SET total_items = GREATEST(total_items - 1, 0) WHERE id = OLD.workspace_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER workspace_items_count_ins
  AFTER INSERT ON public.workspace_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_workspace_items_count();
CREATE TRIGGER workspace_items_count_del
  AFTER DELETE ON public.workspace_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_workspace_items_count();
