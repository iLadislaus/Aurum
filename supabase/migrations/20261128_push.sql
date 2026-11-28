-- Уведомления: ключи отправителя и подписанные устройства. Обе таблицы доступны только edge-функции push
-- (RLS включён, правил нет — приложению строки не отдаются).
create table if not exists public.push_keys (
  id int primary key check (id = 1),
  public_key text not null,
  private_key jsonb not null
);
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_keys, public.push_subscriptions from anon, authenticated;
