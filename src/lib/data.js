import { sb } from './supabase.js';

const first = (y, m) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MON_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// Убираем эмодзи из названий («Groceries 🥦» → «Groceries»)
const clean = (s) => (s || '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
const ymd = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });

function whenLabel(iso) {
  const today = ymd(new Date());
  const day = ymd(new Date(iso));
  const diff = Math.round((new Date(today) - new Date(day)) / 86400000);
  if (diff <= 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Kyiv' });
}

const PERIOD = { week: 'каждую неделю', month: 'каждый месяц', year: 'каждый год' };

export async function loadHome() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  // три месяца: два прошлых и текущий
  const mons = [m - 2, m - 1, m].map((k) => new Date(Date.UTC(y, k, 1)));
  const [bal, cats, ops, rec, ...sums] = await Promise.all([
    sb.from('account_balances').select('balance,is_foreign'),
    sb.from('categories').select('id,name,icon'),
    sb.from('transactions').select('id,date,action,amount,category_id,note,account_id,from_account_id,to_account_id').order('date', { ascending: false }).limit(5),
    sb.from('recurring_payments').select('id,name,amount,period,next_date,category_id').eq('active', true).eq('dismissed', false).order('next_date'),
    ...mons.map((d) => sb.rpc('month_summary', { p_month: first(d.getUTCFullYear(), d.getUTCMonth()) }))
  ]);
  for (const r of [bal, cats, ops, rec, ...sums]) if (r.error) throw r.error;

  const catMap = new Map(cats.data.map((c) => [c.id, c]));
  const total = bal.data.filter((a) => !a.is_foreign).reduce((s, a) => s + Number(a.balance), 0);

  const months = sums.map((r, i) => {
    const d = mons[i], s = r.data;
    return {
      label: MON[d.getUTCMonth()][0].toUpperCase() + MON[d.getUTCMonth()].slice(1),
      name: MON_FULL[d.getUTCMonth()],
      income: Number(s.income),
      expense: Number(s.expense) - Number(s.returns)
    };
  });
  const cur = sums[2].data;
  const delta = Number(cur.income) - (Number(cur.expense) - Number(cur.returns));
  const start = total - delta;
  const pct = start > 0 ? (delta / start) * 100 : 0;

  const today = ymd(now);
  const horizon = rec.data.map((p) => ({
    id: p.id,
    name: clean(p.name).split('\n')[0],
    cat: clean(catMap.get(p.category_id)?.name) || 'Без категории',
    period: PERIOD[p.period] ?? '',
    amount: Number(p.amount),
    days: Math.round((new Date(p.next_date) - new Date(today)) / 86400000),
    icon: catMap.get(p.category_id)?.icon || 'tag'
  }));

  const recent = ops.data.map((t) => {
    const c = catMap.get(t.category_id);
    const sign = t.action === 'EXPENSE' ? -1 : t.action === 'TRANSFER' ? 0 : 1;
    return {
      id: t.id,
      name: clean(t.note) || clean(c?.name) || (t.action === 'TRANSFER' ? 'Перевод' : 'Операция'),
      cat: t.action === 'TRANSFER' ? 'Перевод' : clean(c?.name) || 'Без категории',
      when: whenLabel(t.date),
      amount: sign * Number(t.amount),
      icon: t.action === 'TRANSFER' ? 'swap' : c?.icon || 'tag'
    };
  });

  return {
    total, delta, pct,
    budget: { plan: Number(cur.budget), spent: Number(cur.expense) - Number(cur.returns) },
    months, horizon, recent
  };
}
