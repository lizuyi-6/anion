create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.profiles (
  user_id uuid primary key,
  full_name text,
  preferred_role_pack text not null default 'engineering',
  workspace_mode text not null default 'interview',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_pack_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_pack text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  role_pack text not null,
  target_company text not null,
  level text not null,
  job_description text not null,
  config jsonb not null,
  director_state jsonb not null,
  current_pressure int not null default 42,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_turns (
  id text primary key,
  session_id text not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  speaker_id text not null,
  speaker_label text not null,
  kind text not null,
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  sequence int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.session_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.diagnostic_reports (
  id text primary key,
  session_id text not null unique references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_profiles (
  id text primary key,
  session_id text not null unique references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_evidence (
  id uuid primary key default gen_random_uuid(),
  memory_profile_id text not null references public.memory_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  summary text not null,
  kind text not null,
  embedding vector(1536),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memory_evidence_embedding_idx
  on public.memory_evidence
  using hnsw (embedding vector_cosine_ops);

create table if not exists public.command_threads (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null,
  title text not null,
  session_id text references public.interview_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.command_messages (
  id text primary key,
  thread_id text not null references public.command_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.command_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.role_pack_preferences enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_turns enable row level security;
alter table public.session_artifacts enable row level security;
alter table public.diagnostic_reports enable row level security;
alter table public.memory_profiles enable row level security;
alter table public.memory_evidence enable row level security;
alter table public.command_threads enable row level security;
alter table public.command_messages enable row level security;
alter table public.generated_artifacts enable row level security;

create policy "users own profiles" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own role pack preferences" on public.role_pack_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own interview sessions" on public.interview_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own interview turns" on public.interview_turns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own session artifacts" on public.session_artifacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own diagnostic reports" on public.diagnostic_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own memory profiles" on public.memory_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own memory evidence" on public.memory_evidence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own command threads" on public.command_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own command messages" on public.command_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users own generated artifacts" on public.generated_artifacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
