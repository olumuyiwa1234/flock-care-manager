create table public.notification_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  notification_id text not null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, notification_id)
);

grant select, insert, update, delete on public.notification_dismissals to authenticated;
grant all on public.notification_dismissals to service_role;

alter table public.notification_dismissals enable row level security;

create policy "Users can view their own dismissals"
  on public.notification_dismissals
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own dismissals"
  on public.notification_dismissals
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own dismissals"
  on public.notification_dismissals
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own dismissals"
  on public.notification_dismissals
  for delete
  to authenticated
  using (user_id = auth.uid());