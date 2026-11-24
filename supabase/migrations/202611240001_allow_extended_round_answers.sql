-- Permite registrar checklists estendidos (ex.: itens 21+ do Hangar United) na tabela round_answers
alter table public.round_answers drop constraint if exists round_answers_item_number_check;
alter table public.round_answers add constraint round_answers_item_number_check check (item_number >= 1);
