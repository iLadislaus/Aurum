-- Текст уведомления об операции: магазин в заголовке; ниже сумма и остаток бюджета при каждой трате.
-- Категорию не пишем: её видно по значку.

-- строка про бюджет категории для траты этого месяца, в том числе «вне бюджета»; null для долгов, прошлых месяцев и валютных счетов
create or replace function public.push_left(op uuid) returns text language sql stable set search_path = '' as $$
  select case when coalesce(b.plan, 0) <= 0 then '⚠️ Вне бюджета, за месяц ' || public.push_money(s.spent) || ' ₴'
    when s.spent > b.plan then 'Превышен на ' || public.push_money(s.spent - b.plan) || ' ₴'
    else 'Осталось ' || public.push_money(b.plan - s.spent) || ' ₴ из ' || public.push_money(b.plan) || ' ₴' end
  from public.transactions t
  cross join lateral (select date_trunc('month', now() at time zone 'Europe/Kyiv')::date as mon) m
  join public.categories c on c.id = t.category_id and c.type = 'EXPENSE' and not coalesce(c.is_debt, false)
  cross join lateral (select sum(amount) as plan from public.budgets where category_id = c.id and month = m.mon) b
  cross join lateral (select public.push_spent(c.id, m.mon) as spent) s
  where t.id = op and t.action = 'EXPENSE' and (t.date at time zone 'Europe/Kyiv')::date between m.mon and (now() at time zone 'Europe/Kyiv')::date
    and not exists (select 1 from public.accounts ac where ac.id = t.account_id and ac.is_foreign)
$$;
revoke execute on function public.push_left(uuid) from public, anon, authenticated;

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
      -- в заголовке магазин, ниже сумма и остаток бюджета
      msgs := msgs || jsonb_build_object('tag', 'op-' || (a->>'id'),
        'title', case when (a->>'uncat')::boolean then '❓' else public.push_emoji(a->>'icon') end || ' ' || (a->>'name'),
        'body', (a->>'sum') || case when (a->>'uncat')::boolean then E'\nВыберите категорию в Aurum'
          when pref.budget and a->>'action' = 'EXPENSE' then coalesce(E'\n' || public.push_left((a->>'id')::uuid), '') else '' end);
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
