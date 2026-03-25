alter table public.interview_sessions
  add column if not exists report_id text,
  add column if not exists memory_profile_id text,
  add column if not exists analysis_job_id text,
  add column if not exists analysis_error text,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_completed_at timestamptz;

insert into storage.buckets (id, name, public)
values ('session-artifacts', 'session-artifacts', false)
on conflict (id) do nothing;

drop policy if exists "users can read own session artifacts" on storage.objects;
create policy "users can read own session artifacts" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'session-artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can insert own session artifacts" on storage.objects;
create policy "users can insert own session artifacts" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'session-artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can update own session artifacts" on storage.objects;
create policy "users can update own session artifacts" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'session-artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'session-artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can delete own session artifacts" on storage.objects;
create policy "users can delete own session artifacts" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'session-artifacts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
