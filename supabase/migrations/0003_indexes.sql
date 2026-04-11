-- Production indexes for frequently queried columns
-- All user_id and session_id FK columns used in DataStore queries

-- Interview sessions
create index if not exists idx_interview_sessions_user_id
  on public.interview_sessions (user_id);
create index if not exists idx_interview_sessions_status
  on public.interview_sessions (status);

-- Interview turns
create index if not exists idx_interview_turns_session_id
  on public.interview_turns (session_id);
create index if not exists idx_interview_turns_user_id
  on public.interview_turns (user_id);

-- Session artifacts
create index if not exists idx_session_artifacts_session_id
  on public.session_artifacts (session_id);

-- Diagnostic reports
create index if not exists idx_diagnostic_reports_user_id
  on public.diagnostic_reports (user_id);

-- Memory profiles
create index if not exists idx_memory_profiles_user_id
  on public.memory_profiles (user_id);
create index if not exists idx_memory_profiles_session_id
  on public.memory_profiles (session_id);

-- Memory evidence
create index if not exists idx_memory_evidence_user_id
  on public.memory_evidence (user_id);
create index if not exists idx_memory_evidence_profile_id
  on public.memory_evidence (memory_profile_id);

-- Command threads
create index if not exists idx_command_threads_user_id
  on public.command_threads (user_id);

-- Command messages
create index if not exists idx_command_messages_thread_id
  on public.command_messages (thread_id);
create index if not exists idx_command_messages_user_id
  on public.command_messages (user_id);

-- Generated artifacts
create index if not exists idx_generated_artifacts_thread_id
  on public.generated_artifacts (thread_id);

-- Role pack preferences
create index if not exists idx_role_pack_preferences_user_id
  on public.role_pack_preferences (user_id);
