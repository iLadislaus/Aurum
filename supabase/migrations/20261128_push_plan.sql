-- Уведомления по расписанию: «Платежи» (накануне в 09:00) и «Советы» (воскресенье 19:00).
-- Всё считает база; функция push вызывается, только когда есть что отправить.
alter table public.push_prefs add column if not exists payments boolean not null default true;
alter table public.push_prefs add column if not exists advice boolean not null default true;

-- траты за дни a..b по категориям и магазинам: возврат уменьшает ту покупку, которую отменяет
create or replace function public.push_flow(a date, b date) returns table (cat bigint, shop text, value numeric) language sql stable set search_path = '' as $$
  with span as (select a::timestamp at time zone 'Europe/Kyiv' as a, (b + 1)::timestamp at time zone 'Europe/Kyiv' as b),
  tx as (
    select t.* from public.transactions t, span
    where t.date >= span.a and t.action in ('EXPENSE', 'RETURN')
      and not exists (select 1 from public.accounts ac where ac.id = t.account_id and ac.is_foreign)
  ),
  ret as (
    select r.id, r.amount, e.id as of from tx r left join lateral (
      select e.id from public.transactions e
      where e.action = 'EXPENSE' and e.account_id = r.account_id and public.push_shop(r.note) <> '' and public.push_shop(e.note) = public.push_shop(r.note)
        and r.date - e.date between interval '-2 minutes' and interval '180 days' and e.amount + 0.005 >= r.amount
      order by (abs(e.amount - r.amount) < 0.005) desc, e.date desc limit 1
    ) e on true where r.action = 'RETURN'
  ),
  net as (
    -- покупки за эти дни за вычетом возвратов и возвраты без найденной покупки
    select t.id, t.category_id, t.note, t.amount, greatest(t.amount - coalesce((select sum(amount) from ret where ret.of = t.id), 0), 0) as value
    from tx t, span where t.action = 'EXPENSE' and t.date < span.b
    union all
    select t.id, t.category_id, t.note, t.amount, -t.amount from tx t, span
    where t.action = 'RETURN' and t.date < span.b and exists (select 1 from ret where ret.id = t.id and ret.of is null)
  )
  select c.id, btrim(split_part(n.note, E'\n', 1)),
    case when s.id is null then n.value else n.value * s.amount / nullif(n.amount, 0) end
  from net n
  left join public.transaction_splits s on s.transaction_id = n.id
  left join public.categories c on c.id = coalesce(s.category_id, n.category_id)
  where not coalesce(c.is_debt, false)
$$;

create or replace function public.push_spent(cat bigint, mon date) returns numeric language sql stable set search_path = '' as $$
  select coalesce(round(sum(f.value), 2), 0) from public.push_flow(mon, (mon + interval '1 month')::date - 1) f where f.cat = push_spent.cat
$$;

-- завтрашние платежи из «На горизонте»; дата повторяется каждую неделю, месяц или год
create or replace function public.push_payments(day date) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('title', '📅 ' || btrim(split_part(p.name, E'\n', 1)),
    'body', public.push_money(p.amount) || E' ₴\nЗавтра платёж', 'tag', 'pay-' || p.id || '-' || (day + 1)) order by p.amount desc), '[]')
  from public.recurring_payments p
  where p.active and not p.dismissed and p.next_date <= day + 1 and case p.period
    when 'week' then (day + 1 - p.next_date) % 7 = 0
    when 'month' then (p.next_date + make_interval(months => ((extract(year from day + 1) - extract(year from p.next_date)) * 12
      + extract(month from day + 1) - extract(month from p.next_date))::int))::date = day + 1
    when 'year' then (p.next_date + make_interval(years => (extract(year from day + 1) - extract(year from p.next_date))::int))::date = day + 1
    else p.next_date = day + 1 end
$$;

-- анализ недели, которая заканчивается в день day: сводка, заметный рост категории и (в конце месяца) бюджет.
-- Крупные обязательные разовые платежи (аренда) ростом не считаются
create or replace function public.push_advice(day date) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  msgs jsonb := '[]'; weeks jsonb; total numeric; usual numeric; pct int; up text; r record; top record;
  mon date := date_trunc('month', day)::date;
  months text[] := array['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
begin
  select coalesce(sum(value), 0) into total from public.push_flow(day - 6, day);
  select coalesce(sum(value), 0) / 4 into usual from public.push_flow(day - 34, day - 7);
  -- сравнивать есть с чем, только если история длиннее пяти недель
  if not exists (select 1 from public.transactions where date < (day - 34)::timestamp at time zone 'Europe/Kyiv') then usual := 0; end if;

  -- по категориям: эта неделя (w) и средняя из четырёх прошлых (av)
  select coalesce(jsonb_agg(q), '[]') into weeks from (
    select x.cat, sum(x.w) as w, sum(x.u) / 4 as av from (
      select f.cat, f.value as w, 0 as u from public.push_flow(day - 6, day) f
      union all select f.cat, 0, f.value from public.push_flow(day - 34, day - 7) f) x
    group by x.cat) q;

  if total > 0 then
    pct := case when usual > 0 then round((total - usual) * 100 / usual) end;
    select string_agg(name || ' +' || public.push_money(round(diff)) || ' ₴', ', ' order by diff desc) into up from (
      select public.push_plain(c.name) as name, k.w - k.av as diff
      from jsonb_to_recordset(weeks) k(cat bigint, w numeric, av numeric) join public.categories c on c.id = k.cat
      where usual > 0 and k.av > 0 and k.w - k.av >= 500 and not (coalesce(c.is_mandatory, false) and coalesce(c.spend_mode, '') = 'lump') order by 2 desc limit 2) q;
    msgs := msgs || jsonb_build_object('title', '📊 Неделя: ' || public.push_money(round(total)) || ' ₴', 'tag', 'week-' || day,
      'body', coalesce(case when pct is null then null when abs(pct) < 5 then 'Как обычно.'
          else 'На ' || abs(pct) || '% ' || case when pct > 0 then 'больше' else 'меньше' end || ' обычного.' end, 'Траты за 7 дней.')
        || coalesce(E'\nВыше обычного: ' || up, ''));
  end if;

  -- одна категория, где траты выросли сильнее всего (в полтора раза и больше)
  select k.cat, k.w, k.av, public.push_plain(c.name) as name, c.icon into r
    from jsonb_to_recordset(weeks) k(cat bigint, w numeric, av numeric) join public.categories c on c.id = k.cat
    where usual > 0 and k.av > 0 and k.w >= k.av * 1.5 and k.w - k.av >= 500
      and not (coalesce(c.is_mandatory, false) and coalesce(c.spend_mode, '') = 'lump') and c.name !~* '^uncategorized'
    order by k.w - k.av desc limit 1;
  if found then
    select f.shop, sum(f.value) as s into top from public.push_flow(day - 6, day) f where f.cat = r.cat and f.shop <> '' group by f.shop order by 2 desc limit 1;
    msgs := msgs || jsonb_build_object('title', public.push_emoji(r.icon) || ' ' || r.name || ' выше обычного', 'tag', 'grow-' || day,
      'body', public.push_money(round(r.w)) || ' ₴ за неделю, обычно ' || public.push_money(round(r.av)) || ' ₴.'
        || coalesce(E'\nБольше всего: ' || top.shop || ', ' || public.push_money(round(top.s)) || ' ₴', ''));
  end if;

  -- последнее воскресенье месяца: что превышено
  if date_trunc('month', day + 7) <> date_trunc('month', day) then
    select count(*) as n, sum(ov) as s, (array_agg(name order by ov desc))[1] as name, max(ov) as m into r from (
      select public.push_plain(c.name) as name, public.push_spent(c.id, mon) - b.plan as ov
      from (select category_id, sum(amount) as plan from public.budgets where month = mon group by category_id) b
      join public.categories c on c.id = b.category_id and c.type = 'EXPENSE' and not coalesce(c.is_debt, false)
      where b.plan > 0) q where ov > 0;
    msgs := msgs || jsonb_build_object('title', '🎯 Бюджет ' || months[extract(month from day)::int], 'tag', 'month-' || mon,
      'body', case when r.n = 0 then 'Ни одна категория не превышена.'
        else 'Превышено категорий: ' || r.n || ', на ' || public.push_money(round(r.s)) || E' ₴.\nБольше всего: ' || r.name || ' +' || public.push_money(round(r.m)) || ' ₴' end);
  end if;
  return msgs;
end $$;

-- запускается расписанием; время киевское, поэтому летом и зимой часы UTC разные
create or replace function public.push_scheduled() returns void language plpgsql security definer set search_path = '' as $$
declare
  t timestamp := now() at time zone 'Europe/Kyiv';
  pref public.push_prefs;
  msgs jsonb := '[]';
begin
  if extract(hour from t) not in (9, 19) or not exists (select 1 from public.push_subscriptions) then return; end if;
  select * into pref from public.push_prefs where id = 1;
  if extract(hour from t) = 9 and pref.payments then msgs := public.push_payments(t::date); end if;
  if extract(hour from t) = 19 and extract(isodow from t) = 7 and pref.advice then msgs := public.push_advice(t::date); end if;
  if jsonb_array_length(msgs) > 0 then
    perform net.http_post(
      url := 'https://ozgorwowudjhyvdncilu.supabase.co/functions/v1/push',
      headers := '{"content-type": "application/json"}'::jsonb,
      body := jsonb_build_object('action', 'hook', 'secret', (select hook_secret from public.push_keys where id = 1), 'messages', msgs),
      timeout_milliseconds := 10000);
  end if;
end $$;

revoke execute on function public.push_flow(date, date), public.push_spent(bigint, date), public.push_payments(date), public.push_advice(date), public.push_scheduled() from public, anon, authenticated;

-- 09:00 и 19:00 по Киеву
select cron.schedule('push-plan', '0 6,7,16,17 * * *', 'select public.push_scheduled()');
