-- Helper: confirms the privileged approval/role columns are unchanged for a given profile.
-- Runs as definer so it can read the stored row regardless of the caller's policies.
create or replace function app.profile_privileged_fields_unchanged(
  _id uuid,
  _approval_status text,
  _sub_role text,
  _approved_by uuid,
  _approved_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, app
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _id
      and p.approval_status is not distinct from _approval_status
      and p.sub_role is not distinct from _sub_role
      and p.approved_by is not distinct from _approved_by
      and p.approved_at is not distinct from _approved_at
  );
$$;

revoke all on function app.profile_privileged_fields_unchanged(uuid, text, text, uuid, timestamptz) from public;
grant execute on function app.profile_privileged_fields_unchanged(uuid, text, text, uuid, timestamptz) to authenticated;

-- Self-service profile edits may never touch approval status, sub-role or approval audit fields.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and app.profile_privileged_fields_unchanged(
    id, approval_status, sub_role, approved_by, approved_at
  )
);