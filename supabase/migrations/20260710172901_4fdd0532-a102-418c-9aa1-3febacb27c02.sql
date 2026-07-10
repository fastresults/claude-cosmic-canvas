
create table public.create_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format_id text not null,
  title text,
  sections jsonb not null default '[]'::jsonb,
  brief_snapshot jsonb,
  preset_id uuid,
  voice_id uuid,
  domain text,
  audience text,
  factor_weights jsonb,
  images jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  archived boolean not null default false,
  quality_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.create_drafts to authenticated;
grant all on public.create_drafts to service_role;
alter table public.create_drafts enable row level security;
create policy "own create_drafts" on public.create_drafts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index create_drafts_user_format_idx on public.create_drafts (user_id, format_id, updated_at desc);
create trigger create_drafts_updated_at before update on public.create_drafts
  for each row execute function public.tg_set_updated_at();

create table public.create_version_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null references public.create_drafts(id) on delete cascade,
  format_id text not null,
  sections jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.create_version_history to authenticated;
grant all on public.create_version_history to service_role;
alter table public.create_version_history enable row level security;
create policy "own create_version_history" on public.create_version_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index create_version_history_draft_idx on public.create_version_history (draft_id, created_at desc);

create table public.create_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  provider text,
  url text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.create_media to authenticated;
grant all on public.create_media to service_role;
alter table public.create_media enable row level security;
create policy "own create_media" on public.create_media for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index create_media_user_kind_idx on public.create_media (user_id, kind, created_at desc);
