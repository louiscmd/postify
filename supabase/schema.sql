-- Postify — Supabase schema. Run once in: Supabase dashboard → SQL Editor → New query → Run.
-- Every row belongs to one user; Row Level Security makes it invisible to everyone else.

-- ── per-account settings (Anthropic key + model) ──────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  api_key text,
  model text,
  updated_at timestamptz not null default now()
);

-- ── projects (whole carousel stored as JSON) ─────────────────
create table if not exists public.projects (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ── gallery photo metadata (files live in the "images" bucket) ─
create table if not exists public.images (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  w int not null,
  h int not null,
  type text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ── custom style presets ──────────────────────────────────────
create table if not exists public.presets (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.images enable row level security;
alter table public.presets enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own images" on public.images;
create policy "own images" on public.images for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own presets" on public.presets;
create policy "own presets" on public.presets for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── private photo bucket: files stored as <user id>/<image id> ─
insert into storage.buckets (id, name, public) values ('images', 'images', false) on conflict (id) do nothing;

drop policy if exists "own image files" on storage.objects;
create policy "own image files" on storage.objects for all
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
