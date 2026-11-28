-- Уведомления о новых операциях и бюджете. Всё считает база в момент добавления операции;
-- функция push вызывается, только когда есть что отправить.
alter table public.push_keys add column if not exists hook_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

create table if not exists public.push_prefs (
  id int primary key check (id = 1),
  ops text not null default 'all' check (ops in ('all', 'uncat', 'off')),
  budget boolean not null default true
);
insert into public.push_prefs (id) values (1) on conflict do nothing;

-- о каком пороге бюджета уже сообщили: не больше двух строк на категорию в месяц
create table if not exists public.push_marks (
  month date not null,
  category_id bigint not null,
  level int not null,
  primary key (month, category_id, level)
);
alter table public.push_prefs enable row level security;
alter table public.push_marks enable row level security;
revoke all on public.push_prefs, public.push_marks from anon, authenticated;

-- все устройства одним полем: функция push берёт ключи и устройства за один запрос
create or replace function public.push_hook_subs(k public.push_keys) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]') from public.push_subscriptions
$$;
revoke execute on function public.push_hook_subs(public.push_keys) from public, anon, authenticated;

create or replace function public.push_money(v numeric) returns text language sql immutable set search_path = '' as $$
  select replace(trim(to_char(abs(v), case when v = trunc(v) then 'FM999,999,999,990' else 'FM999,999,999,990.00' end)), ',', ' ')
$$;

-- значок категории в начале уведомления: iPhone не даёт поставить свою картинку
create or replace function public.push_emoji(icon text) returns text language sql immutable set search_path = '' as $$
  select coalesce('{"cart":"🛒","bank":"🏦","home":"🏠","health":"🏥","car":"🚕","card":"💳","eat":"🍔","sport":"🏋️","sofa":"🛋️","cloth":"👕","gift":"🎁","digital":"💻","family":"👪","care":"🛁","film":"🎬","study":"📚","coin":"🪙","wallet":"💰","pen":"✍️","basket":"🛍️","swap":"🔄","chart":"📈","user":"🤝","dollar":"💵"}'::jsonb ->> icon, '💳')
$$;

-- название категории без эмодзи, чтобы значок не повторялся
create or replace function public.push_plain(name text) returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(name, '[^A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9 .,+&/()''’-]', '', 'g'), ' {2,}', ' ', 'g'))
$$;

-- название без слов об отмене, чтобы найти списание, которое отменяет возврат
create or replace function public.push_shop(note text) returns text language sql immutable set search_path = '' as $$
  select lower(btrim(regexp_replace(btrim(coalesce(note, '')), '^(скасування\.|повернення платежу|возврат\.?|платіж)\s*', '', 'i')))
$$;

-- траты категории за месяц, как в «Бюджете»: возврат уменьшает ту покупку, которую отменяет
create or replace function public.push_spent(cat bigint, mon date) returns numeric language sql stable set search_path = '' as $$
  with span as (select mon::timestamp at time zone 'Europe/Kyiv' as a, (mon + interval '1 month') at time zone 'Europe/Kyiv' as b),
  tx as (
    select t.* from public.transactions t, span
    where t.date >= span.a and t.action in ('EXPENSE', 'RETURN')
      and not exists (select 1 from public.accounts ac where ac.id = t.account_id and ac.is_foreign)
  ),
  ret as (
    select r.id, r.amount, r.date, e.id as of from tx r left join lateral (
      select e.id from public.transactions e
      where e.action = 'EXPENSE' and e.account_id = r.account_id and public.push_shop(r.note) <> '' and public.push_shop(e.note) = public.push_shop(r.note)
        and r.date - e.date between interval '-2 minutes' and interval '180 days' and e.amount + 0.005 >= r.amount
      order by (abs(e.amount - r.amount) < 0.005) desc, e.date desc limit 1
    ) e on true where r.action = 'RETURN'
  ),
  net as (
    -- покупки месяца за вычетом возвратов и возвраты без найденной покупки
    select t.id, t.category_id, t.amount, greatest(t.amount - coalesce((select sum(amount) from ret where ret.of = t.id), 0), 0) as value
    from tx t, span where t.action = 'EXPENSE' and t.date < span.b
    union all
    select t.id, t.category_id, t.amount, -t.amount from tx t, span
    where t.action = 'RETURN' and t.date < span.b and exists (select 1 from ret where ret.id = t.id and ret.of is null)
  )
  select coalesce(round(sum(case when s.id is null then n.value else n.value * s.amount / nullif(n.amount, 0) end), 2), 0)
  from net n left join public.transaction_splits s on s.transaction_id = n.id
  where coalesce(s.category_id, n.category_id) = cat
$$;

-- сообщения о только что добавленных операциях ids; сама ничего не записывает
create or replace function public.push_digest(ids uuid[]) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pref public.push_prefs;
  today date := (now() at time zone 'Europe/Kyiv')::date;
  mon date := date_trunc('month', now() at time zone 'Europe/Kyiv')::date;
  ops jsonb; alerts jsonb; msgs jsonb := '[]'; marks jsonb := '[]'; n int; a jsonb;
begin
  select * into pref from public.push_prefs where id = 1;

  -- операции из банка за последние двое суток; внесённые вручную владелец и так видел
  select coalesce(jsonb_agg(x order by x.date), '[]') into ops from (
    select t.id, t.date, t.category_id,
      coalesce(nullif(trim(split_part(t.note, E'\n', 1)), ''), 'Операция') as name,
      case when t.action = 'EXPENSE' then '−' else '+' end || public.push_money(t.amount) || ' '
        || case t.currency when 'USD' then '$' when 'EUR' then '€' else '₴' end as sum,
      public.push_plain(c.name) as cat, c.icon, (t.action <> 'INCOME' and (t.category_id is null or c.name ~* '^uncategorized')) as uncat, t.action
    from public.transactions t left join public.categories c on c.id = t.category_id
    where t.id = any(ids) and t.mono_op_id is not null and t.action <> 'TRANSFER' and t.date > now() - interval '2 days'
  ) x
  where pref.ops = 'all' or (pref.ops = 'uncat' and x.uncat);

  -- категории расходов из новых операций этого месяца, дошедшие до 80% или превысившие бюджет
  if pref.budget then
    select coalesce(jsonb_agg(y), '[]') into alerts from (
      select c.id as category_id, public.push_plain(c.name) as name, c.icon, b.plan, s.spent, case when s.spent > b.plan then 100 else 80 end as level
      from (
        select distinct t.category_id from public.transactions t
        where t.id = any(ids) and t.action = 'EXPENSE' and (t.date at time zone 'Europe/Kyiv')::date between mon and today
          and not exists (select 1 from public.accounts ac where ac.id = t.account_id and ac.is_foreign)
      ) k
      join public.categories c on c.id = k.category_id and c.type = 'EXPENSE' and not coalesce(c.is_debt, false)
      join lateral (select sum(amount) as plan from public.budgets where category_id = c.id and month = mon) b on b.plan > 0
      join lateral (select public.push_spent(c.id, mon) as spent) s on s.spent >= b.plan * 0.8
      where not exists (select 1 from public.push_marks p where p.month = mon and p.category_id = c.id
        and p.level >= case when s.spent > b.plan then 100 else 80 end)
    ) y;
  else
    alerts := '[]';
  end if;

  for a in select * from jsonb_array_elements(alerts) loop
    marks := marks || jsonb_build_object('month', mon, 'category_id', a->'category_id', 'level', a->'level');
  end loop;
  -- текст про бюджет категории
  select coalesce(jsonb_agg(v || jsonb_build_object('text',
      case when (v->>'level')::int = 100 then 'бюджет превышен на ' || public.push_money((v->>'spent')::numeric - (v->>'plan')::numeric) || ' ₴'
      else 'потрачено ' || floor((v->>'spent')::numeric * 100 / (v->>'plan')::numeric) || '%, осталось ' || public.push_money((v->>'plan')::numeric - (v->>'spent')::numeric) || ' ₴' end)), '[]')
    into alerts from jsonb_array_elements(alerts) v;

  n := jsonb_array_length(ops);
  if n > 3 then
    msgs := msgs || jsonb_build_object('title', 'Новых операций: ' || n, 'body', 'Откройте Aurum, чтобы посмотреть', 'tag', 'ops-' || (ops->0->>'id'));
  else
    for a in select * from jsonb_array_elements(ops) loop
      -- бюджет этой же категории дописываем в то же сообщение
      msgs := msgs || jsonb_build_object('title', case when (a->>'uncat')::boolean then '❓' else public.push_emoji(a->>'icon') end || ' ' || (a->>'name') || ' · ' || (a->>'sum'), 'tag', 'op-' || (a->>'id'),
        'body', case when (a->>'uncat')::boolean then 'Без категории, выберите в Aurum'
          else coalesce(a->>'cat', case a->>'action' when 'INCOME' then 'Поступление' else 'Возврат' end) end
          || coalesce((select E'\n' || upper(left(v->>'text', 1)) || substr(v->>'text', 2) from jsonb_array_elements(alerts) v
               where v->'category_id' = a->'category_id' and a->>'action' = 'EXPENSE' limit 1), ''));
      if a->>'action' = 'EXPENSE' then
        select coalesce(jsonb_agg(v), '[]') into alerts from jsonb_array_elements(alerts) v where v->'category_id' is distinct from a->'category_id';
      end if;
    end loop;
  end if;
  for a in select * from jsonb_array_elements(alerts) loop
    msgs := msgs || jsonb_build_object('title', public.push_emoji(a->>'icon') || ' Бюджет: ' || (a->>'name'), 'body', upper(left(a->>'text', 1)) || substr(a->>'text', 2),
      'tag', 'budget-' || (a->>'category_id') || '-' || (a->>'level'));
  end loop;
  return jsonb_build_object('messages', msgs, 'marks', marks);
end $$;

create or replace function public.push_after_insert() returns trigger language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  begin
    -- без подписанных устройств и новых строк ничего не делаем
    if exists (select 1 from public.push_subscriptions) and exists (select 1 from ins_rows) then
      d := public.push_digest(array(select id from ins_rows));
      if jsonb_array_length(d->'messages') > 0 then
        insert into public.push_marks (month, category_id, level)
          select (m->>'month')::date, (m->>'category_id')::bigint, (m->>'level')::int from jsonb_array_elements(d->'marks') m
          on conflict do nothing;
        perform net.http_post(
          url := 'https://ozgorwowudjhyvdncilu.supabase.co/functions/v1/push',
          headers := '{"content-type": "application/json"}'::jsonb,
          body := jsonb_build_object('action', 'hook', 'secret', (select hook_secret from public.push_keys where id = 1), 'messages', d->'messages'),
          timeout_milliseconds := 10000);
      end if;
    end if;
  exception when others then
    -- уведомление никогда не должно мешать записи операции
    raise warning 'push_after_insert: %', sqlerrm;
  end;
  return null;
end $$;

revoke execute on function public.push_digest(uuid[]), public.push_after_insert(), public.push_money(numeric), public.push_shop(text), public.push_emoji(text), public.push_plain(text), public.push_spent(bigint, date) from public, anon, authenticated;

-- имя по алфавиту после mono_glue_after_insert: к этому моменту пары переводов уже склеены
drop trigger if exists push_after_insert on public.transactions;
create trigger push_after_insert after insert on public.transactions
  referencing new table as ins_rows for each statement execute function public.push_after_insert();
