-- Atomic memory profile activation function
-- Avoids race condition between deactivating all and activating target

create or replace function public.activate_memory_profile(
  p_profile_id text,
  p_user_id uuid
)
returns void
language plpgsql
as $$
begin
  update public.memory_profiles
    set is_active = false
    where user_id = p_user_id;

  update public.memory_profiles
    set is_active = true
    where id = p_profile_id
    and user_id = p_user_id;
end;
$$;
