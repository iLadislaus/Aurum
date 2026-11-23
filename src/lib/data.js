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
  const mons = [m - 5, m - 4, m - 3, m - 2, m - 1, m].map((k) => new Date(Date.UTC(y, k, 1)));
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
  const cur = sums[sums.length - 1].data;
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

const nz = (x) => Number(x || 0);

// Экран «Счета»: карты Monobank одной группой, Wallet и Cash, конверты, валютные счета, долги
export async function loadAccounts() {
  const now = new Date();
  const [acc, bal, debts, sum] = await Promise.all([
    sb.from('accounts').select('id,name,block,currency,is_foreign,is_monobank'),
    sb.from('account_balances').select('id,balance,credit_limit'),
    sb.from('debts').select('id,name,currency,amount').order('id'),
    sb.rpc('month_summary', { p_month: first(now.getFullYear(), now.getMonth()) })
  ]);
  for (const r of [acc, bal, debts, sum]) if (r.error) throw r.error;

  const bm = new Map(bal.data.map((b) => [b.id, b]));
  const rows = acc.data.map((a) => ({
    id: a.id, name: clean(a.name), block: a.block, currency: a.currency,
    foreign: a.is_foreign, mono: a.is_monobank,
    balance: nz(bm.get(a.id)?.balance), limit: nz(bm.get(a.id)?.credit_limit)
  }));
  const home = rows.filter((a) => !a.foreign);
  const total = home.reduce((s, a) => s + a.balance, 0);
  const s = sum.data;
  const delta = nz(s.income) - (nz(s.expense) - nz(s.returns));
  const start = total - delta;

  // карты Monobank: показываем только с кредитным лимитом или с деньгами (белые без лимита и с нулём скрыты)
  const cards = home.filter((a) => a.mono && (a.limit > 0 || Math.abs(a.balance) > 0.004));
  const cashes = home.filter((a) => !a.mono && a.block === 'card');
  const envs = home.filter((a) => !a.mono && a.block === 'env').sort((a, b) => b.balance - a.balance);

  // валютные счета по валютам
  const fx = new Map();
  for (const a of rows.filter((x) => x.foreign)) {
    const g = fx.get(a.currency) || { currency: a.currency, balance: 0, names: [], list: [] };
    g.balance += a.balance;
    g.names.push(a.name);
    g.list.push({ id: a.id, name: a.name, balance: a.balance });
    fx.set(a.currency, g);
  }

  const sumOf = (l) => l.reduce((x, a) => x + a.balance, 0);
  return {
    total, delta, pct: start > 0 ? (delta / start) * 100 : 0,
    cards, cardsTotal: sumOf(cards),
    cashes, cardCashTotal: sumOf(cards) + sumOf(cashes),
    envs, envsTotal: sumOf(envs),
    foreign: [...fx.values()],
    debts: debts.data.map((d) => ({ id: d.id, name: clean(d.name), currency: d.currency, amount: nz(d.amount) }))
  };
}

// Операции одного счёта: со знаком для этого счёта, по дням, плюс итоги текущего месяца
export async function loadAccountOps(id) {
  const [tx, cats] = await Promise.all([
    sb.from('transactions')
      .select('id,date,action,amount,to_amount,category_id,note,account_id,from_account_id,to_account_id')
      .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`)
      .order('date', { ascending: false }).limit(300),
    sb.from('categories').select('id,name,icon')
  ]);
  for (const r of [tx, cats]) if (r.error) throw r.error;
  const cm = new Map(cats.data.map((c) => [c.id, c]));
  const now = new Date();
  const mk = now.getFullYear() * 12 + now.getMonth();
  let inc = 0, out = 0;
  const ops = tx.data.map((t) => {
    const c = cm.get(t.category_id);
    let v;
    if (t.action === 'INCOME' || t.action === 'RETURN') v = Number(t.amount);
    else if (t.action === 'EXPENSE') v = -Number(t.amount);
    else v = t.to_account_id === id ? Number(t.to_amount ?? t.amount) : -Number(t.amount);
    const d = new Date(t.date);
    if (d.getFullYear() * 12 + d.getMonth() === mk) { if (v > 0) inc += v; else out += v; }
    return {
      id: t.id, date: t.date, amount: v,
      name: clean(t.note) || clean(c?.name) || (t.action === 'TRANSFER' ? 'Перевод' : 'Операция'),
      cat: t.action === 'TRANSFER' ? 'Перевод' : clean(c?.name) || 'Без категории',
      icon: t.action === 'TRANSFER' ? 'swap' : c?.icon || 'tag'
    };
  });
  return { ops, inc, out };
}

// Новый счёт. Начальный остаток записывается операцией «Коррекция баланса» (категория 25), как уже сделано в базе
export async function createAccount({ type, name, icon, currency, budgetSource, balance }) {
  const { data, error } = await sb.from('accounts').insert({
    name, icon, currency,
    block: type === 'env' ? 'env' : type === 'cash' ? 'card' : null,
    is_foreign: type === 'fx', is_budget_source: budgetSource
  }).select('id').single();
  if (error) throw error;
  if (balance) {
    const { error: e2 } = await sb.from('transactions').insert({
      date: new Date().toISOString(), action: balance > 0 ? 'INCOME' : 'EXPENSE', amount: Math.abs(balance),
      category_id: 25, account_id: data.id, currency, note: 'Начальный остаток'
    });
    if (e2) throw e2;
  }
  return data.id;
}
