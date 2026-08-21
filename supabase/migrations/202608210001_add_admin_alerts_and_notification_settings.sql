create table if not exists public.notification_settings (
  id boolean primary key default true check (id),
  recipient_emails text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into public.notification_settings (id, recipient_emails)
values (true, '{}')
on conflict (id) do nothing;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.operational_rounds(id) on delete cascade,
  title text not null,
  message text not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id)
);

create index if not exists admin_notifications_open_idx
  on public.admin_notifications(created_at desc)
  where acknowledged_at is null;

alter table public.notification_settings enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists "operational app notification settings" on public.notification_settings;
create policy "operational app notification settings"
  on public.notification_settings for all to anon using (true) with check (true);

drop policy if exists "operational app admin notifications" on public.admin_notifications;
create policy "operational app admin notifications"
  on public.admin_notifications for all to anon using (true) with check (true);
