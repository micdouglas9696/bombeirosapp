-- Adiciona suporte a WhatsApp na tabela de configurações de notificações
alter table public.notification_settings
  add column if not exists recipient_whatsapp text[] not null default array['5521992114159'::text];

-- Atualiza registro padrão com o e-mail e WhatsApp oficiais do RioGaleão
update public.notification_settings
set
  recipient_emails = array['supervisoremergencia@riogaleao.com'::text],
  recipient_whatsapp = array['5521992114159'::text],
  updated_at = now()
where id = true;
