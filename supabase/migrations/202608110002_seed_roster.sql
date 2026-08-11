-- Cadastro da escala SBGL de 16/07 a 15/08/2026.
-- Pode ser executado depois da migração 202608110001_create_operational_rounds.sql.
alter table public.firefighters add column if not exists team text;
alter table public.firefighters add column if not exists role text;
alter table public.firefighters add column if not exists work_hours text;
create unique index if not exists firefighters_roster_identity_idx
  on public.firefighters (name, team, role, shift);

with roster(name, team, shift, role, work_hours) as (
  values
    ('Leandro Dantas dos Santos','Alfa','Diurno','BC TECA','07:00 às 19:00'),
    ('Lucas Rodrigues Borges','Alfa','Diurno','BC TECA','07:00 às 19:00'),
    ('Anderson França Muniz','Alfa','Diurno','BC TECA','07:00 às 19:00'),
    ('João Carlos Passos Reges','Alfa','Diurno','BC TECA','07:00 às 19:00'),
    ('Paulo Cesar Machado Teixeira','Alfa','Diurno','BC TPS — Condutor','07:00 às 19:00'),
    ('Rafael Vander dos Santos Silva','Alfa','Diurno','BC TPS','07:00 às 19:00'),
    ('Luan Gustavo Costa','Alfa','Diurno','BC TPS','07:00 às 19:00'),
    ('Alex de Oliveira Athanásio','Alfa','Diurno','BC TPS','07:00 às 19:00'),
    ('Gilberto da Silva Theodozio','Alfa','Diurno','Hangar','07:00 às 19:00'),
    ('Kayque Lima Roldão','Alfa','Diurno','Hangar','07:00 às 19:00'),
    ('William Lanes da Silva','Alfa','Diurno','Hangar','07:00 às 19:00'),
    ('Alexandre Chagas','Alfa','Diurno','Intermitente','07:00 às 19:00'),
    ('Thiago Ferreira','Alfa','Diurno','Intermitente','07:00 às 19:00'),
    ('Marcio Ryan','Alfa','Diurno','Intermitente','07:00 às 19:00'),
    ('Eduardo Costa da Silva Júnior','Alfa','Diurno','Intermitente','07:00 às 19:00'),
    ('Jorge da Silva Fernandes','Bravo','Noturno','BC TECA','19:00 às 07:00'),
    ('Lorran Carlos Araujo Oliveira','Bravo','Noturno','BC TECA','19:00 às 07:00'),
    ('Marcio Gomes de Araujo','Bravo','Noturno','BC TECA','19:00 às 07:00'),
    ('Edilson Rodrigues Siqueira','Bravo','Noturno','BC TECA','19:00 às 07:00'),
    ('Andre Lima da Silva','Bravo','Noturno','BC TPS','19:00 às 07:00'),
    ('Fabricio Kianelli Joaquim','Bravo','Noturno','BC TPS — Condutor','19:00 às 07:00'),
    ('Lucas da Silva Dias','Bravo','Noturno','BC TPS','19:00 às 07:00'),
    ('Tiago Vidal de Carvalho','Bravo','Noturno','BC TPS','19:00 às 07:00'),
    ('Franklin Yuri Oliveira Magano','Bravo','Noturno','Hangar','19:00 às 07:00'),
    ('Fernando Rodrigues Lima','Bravo','Noturno','Hangar','19:00 às 07:00'),
    ('Antonio Carlos Martins Ferreira','Bravo','Noturno','Hangar','19:00 às 07:00'),
    ('Joel Cella Firmino','Bravo','Noturno','Intermitente','19:00 às 07:00'),
    ('Michel Thalles das Graças Pereira','Bravo','Noturno','Intermitente','19:00 às 07:00'),
    ('Thiago Ferreira','Bravo','Noturno','Intermitente','19:00 às 07:00'),
    ('Daniel Santos Silveira da Silva','Charlie','Diurno','BC TECA','07:00 às 19:00'),
    ('Wellington Ferreira da Silva','Charlie','Diurno','BC TECA','07:00 às 19:00'),
    ('Jaclelson Jovem da Silva','Charlie','Diurno','BC TECA','07:00 às 19:00'),
    ('Ivson Melquiades Barros de Lima','Charlie','Diurno','BC TECA','07:00 às 19:00'),
    ('Mauro Cesar da Silva Rosa','Charlie','Diurno','BC TPS — Condutor','07:00 às 19:00'),
    ('Alexandre Villar Fernandes','Charlie','Diurno','BC TPS','07:00 às 19:00'),
    ('Sérgio Ricardo Paz Oliveira','Charlie','Diurno','BC TPS — Condutor','07:00 às 19:00'),
    ('Fabio de Moraes Campos','Charlie','Diurno','BC TPS','07:00 às 19:00'),
    ('Milton Rodrigues Ribeiro Neto','Charlie','Diurno','Hangar','07:00 às 19:00'),
    ('Daniel Virginio','Charlie','Diurno','Hangar','07:00 às 19:00'),
    ('Miguel Ângelo Neves Araújo','Charlie','Diurno','Hangar','07:00 às 19:00'),
    ('Wancler da Silva Bernardo Junior','Charlie','Diurno','Intermitente','07:00 às 19:00'),
    ('Marcio Ryan','Charlie','Diurno','Intermitente','07:00 às 19:00'),
    ('Álvaro','Charlie','Diurno','Intermitente','07:00 às 19:00'),
    ('Thiago Ferreira','Charlie','Diurno','Intermitente','07:00 às 19:00'),
    ('Marcelo Sidney Barbosa Silva','Delta','Noturno','BC TECA','19:00 às 07:00'),
    ('Pablo Martiniano da Silva Pinto','Delta','Noturno','BC TECA','19:00 às 07:00'),
    ('Patrick Fernandes Nascimento','Delta','Noturno','BC TECA','19:00 às 07:00'),
    ('Lucas Ramsdorf Pereira','Delta','Noturno','BC TECA','19:00 às 07:00'),
    ('Jefferson Nascimento de Menezes','Delta','Noturno','BC TPS','19:00 às 07:00'),
    ('Isaias da Silva Machado','Delta','Noturno','BC TPS — Condutor','19:00 às 07:00'),
    ('Bruno Roberto Alves da Silva','Delta','Noturno','BC TPS','19:00 às 07:00'),
    ('Dionatan dos Santos Nascimento','Delta','Noturno','BC TPS — Condutor','19:00 às 07:00'),
    ('Rodrigo Kauiki Carpinelli Lopes Guimaraes de Carvalho','Delta','Noturno','Hangar','19:00 às 07:00'),
    ('Alexandre da Silva Santiago','Delta','Noturno','Hangar','19:00 às 07:00'),
    ('Luan Vitor de Souza Silva','Delta','Noturno','Hangar','19:00 às 07:00'),
    ('Jorge Luiz Jesus Gonçalves','Delta','Noturno','Intermitente','19:00 às 07:00'),
    ('Eduardo Costa da Silva Júnior','Delta','Noturno','Intermitente','19:00 às 07:00')
)
insert into public.firefighters (name, team, shift, role, work_hours, tps_team, teca_team, hangar_united_team, active)
select name, team, shift, role, work_hours, team, team, team, true from roster
on conflict (name, team, role, shift) do update set
  work_hours = excluded.work_hours,
  tps_team = excluded.tps_team,
  teca_team = excluded.teca_team,
  hangar_united_team = excluded.hangar_united_team,
  active = true;

-- Registros sem equipe/horário: mantidos separados para não preencher uma
-- ronda com informações incorretas. Classifique-os antes de movê-los à tabela acima.
create table if not exists public.pending_firefighters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text,
  note text not null,
  created_at timestamptz not null default now()
);
alter table public.pending_firefighters enable row level security;
drop policy if exists "operational app pending firefighters" on public.pending_firefighters;
create policy "operational app pending firefighters" on public.pending_firefighters for all to anon using (true) with check (true);
insert into public.pending_firefighters (name, role, note) values
  ('Andrew Vitorino da Motta','Intermitente','Sem equipe e horário identificados na planilha'),
  ('Michel Sousa de Oliveira','Intermitente','Sem equipe e horário identificados na planilha'),
  ('Carlos Andre Apolinario Pereira','Condutor','Sem equipe e horário identificados na planilha'),
  ('Jhonatan Santiago','Intermitente','Sem equipe e horário identificados na planilha')
on conflict (name) do update set role = excluded.role, note = excluded.note;
