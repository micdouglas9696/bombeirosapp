-- Adiciona a coluna opcional 'sector' na tabela operacional_rounds para registrar dinamicamente o setor onde o bombeiro estava no momento da ronda.
alter table public.operational_rounds add column if not exists sector text;
