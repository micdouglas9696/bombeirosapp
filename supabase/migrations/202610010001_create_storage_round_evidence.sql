-- Criação e configuração do bucket de evidências fotográficas no Supabase Storage
insert into storage.buckets (id, name, public)
values ('round-evidence', 'round-evidence', true)
on conflict (id) do update set public = true;

-- Permitir leitura pública para que as imagens sejam acessíveis no painel e relatórios
drop policy if exists "Round evidence public select" on storage.objects;
create policy "Round evidence public select"
  on storage.objects for select
  using (bucket_id = 'round-evidence');

-- Permitir upload de imagens fotográficas pelos usuários
drop policy if exists "Round evidence public insert" on storage.objects;
create policy "Round evidence public insert"
  on storage.objects for insert
  with check (bucket_id = 'round-evidence');

-- Permitir atualização/substituição de imagens se necessário
drop policy if exists "Round evidence public update" on storage.objects;
create policy "Round evidence public update"
  on storage.objects for update
  using (bucket_id = 'round-evidence');
