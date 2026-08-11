create extension if not exists "pgcrypto";

create table if not exists public.firefighters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shift text not null check (shift in ('Diurno', 'Noturno')),
  tps_team text not null check (tps_team in ('Alfa', 'Bravo', 'Charlie', 'Delta')),
  teca_team text not null check (teca_team in ('Alfa', 'Bravo', 'Charlie', 'Delta')),
  hangar_united_team text not null check (hangar_united_team in ('Alfa', 'Bravo', 'Charlie', 'Delta')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.operational_rounds (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  firefighter_id uuid references public.firefighters(id) on delete set null,
  firefighter_name text not null,
  shift text not null check (shift in ('Diurno', 'Noturno')),
  tps_team text not null,
  teca_team text not null,
  hangar_united_team text not null,
  conformity integer not null check (conformity between 0 and 100),
  non_conformities integer not null default 0 check (non_conformities >= 0),
  status text not null default 'Em análise' check (status in ('Em análise', 'Aprovado', 'Ocorrência')),
  final_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.round_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.operational_rounds(id) on delete cascade,
  item_number integer not null check (item_number between 1 and 20),
  item_text text not null,
  status text not null check (status in ('Conforme', 'Não conforme', 'N/A')),
  observation text,
  priority text check (priority in ('Baixa', 'Média', 'Alta', 'Crítica')),
  location text,
  action_taken text,
  supervisor_notified text,
  ss_number text,
  photo_path text,
  created_at timestamptz not null default now(),
  unique(round_id, item_number)
);

create index if not exists operational_rounds_created_at_idx on public.operational_rounds(created_at desc);
create index if not exists round_answers_round_id_idx on public.round_answers(round_id);

alter table public.firefighters enable row level security;
alter table public.operational_rounds enable row level security;
alter table public.round_answers enable row level security;

-- The current interface has no authentication flow. These policies permit the
-- publishable browser client to operate; replace them with authenticated-role
-- policies before making the system public.
drop policy if exists "operational app firefighters" on public.firefighters;
create policy "operational app firefighters" on public.firefighters for all to anon using (true) with check (true);
drop policy if exists "operational app rounds" on public.operational_rounds;
create policy "operational app rounds" on public.operational_rounds for all to anon using (true) with check (true);
drop policy if exists "operational app answers" on public.round_answers;
create policy "operational app answers" on public.round_answers for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public) values ('round-evidence', 'round-evidence', true)
on conflict (id) do nothing;
drop policy if exists "operational app photos" on storage.objects;
create policy "operational app photos" on storage.objects for all to anon using (bucket_id = 'round-evidence') with check (bucket_id = 'round-evidence');
