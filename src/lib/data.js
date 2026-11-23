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
// Операции счёта из уже загруженных строк: со знаком для этого счёта, плюс итоги месяца
function buildAccountOps(id, rows, cm) {
  const now = new Date();
  const mk = now.getFullYear() * 12 + now.getMonth();
  let inc = 0, out = 0;
  const ops = rows.map((t) => {
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

const TX_COLS = 'id,date,action,amount,to_amount,category_id,note,account_id,from_account_id,to_account_id';

export async function loadAccountOps(id) {
  const [tx, cats] = await Promise.all([
    sb.from('transactions').select(TX_COLS)
      .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`)
      .order('date', { ascending: false }).limit(300),
    sb.from('categories').select('id,name,icon')
  ]);
  for (const r of [tx, cats]) if (r.error) throw r.error;
  return buildAccountOps(id, tx.data, new Map(cats.data.map((c) => [c.id, c])));
}

// Все операции одним заходом и раскладка по счетам: окно любого счёта открывается сразу с готовым списком
export async function loadOpsForAll(ids) {
  const pages = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb.from('transactions').select(TX_COLS).order('date', { ascending: false }).range(from, from + 999);
    if (r.error) throw r.error;
    pages.push(...r.data);
    if (r.data.length < 1000) break;
  }
  const cats = await sb.from('categories').select('id,name,icon');
  if (cats.error) throw cats.error;
  const cm = new Map(cats.data.map((c) => [c.id, c]));
  const out = new Map();
  for (const id of ids) {
    const rows = pages.filter((t) => t.account_id === id || t.from_account_id === id || t.to_account_id === id).slice(0, 300);
    out.set(id, buildAccountOps(id, rows, cm));
  }
  return out;
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

// ---- Операции за месяц (экран «Операции»)
const OP_COLS = 'id,date,action,amount,to_amount,category_id,note,account_id,from_account_id,to_account_id,currency,rate,mono_op_id';

export async function loadMonthOps(y, m) {
  const a = new Date(y, m, 1).toISOString(), b = new Date(y, m + 1, 1).toISOString();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await sb.from('transactions').select(OP_COLS).gte('date', a).lt('date', b)
      .order('date', { ascending: false }).range(from, from + 999);
    if (r.error) throw r.error;
    rows.push(...r.data);
    if (r.data.length < 1000) break;
  }
  const [cats, accs, spl] = await Promise.all([
    sb.from('categories').select('id,name,icon'),
    sb.from('accounts').select('id,name,currency,is_foreign'),
    sb.from('transaction_splits').select('transaction_id')
  ]);
  for (const r of [cats, accs, spl]) if (r.error) throw r.error;
  const sc = new Map();
  for (const x of spl.data) sc.set(x.transaction_id, (sc.get(x.transaction_id) ?? 0) + 1);
  const cm = new Map(cats.data.map((c) => [c.id, c]));
  const am = new Map(accs.data.map((x) => [x.id, x]));
  const SYM = { UAH: '₴', USD: '$', EUR: '€' };
  const ops = rows.map((t) => {
    const c = cm.get(t.category_id), acc = am.get(t.account_id), fa = am.get(t.from_account_id), ta = am.get(t.to_account_id);
    const tr = t.action === 'TRANSFER';
    const foreign = tr ? !!(fa?.is_foreign || ta?.is_foreign) : !!acc?.is_foreign;
    const cur = tr ? (fa?.is_foreign ? fa.currency : ta?.is_foreign ? ta.currency : 'UAH') : acc?.is_foreign ? acc.currency : 'UAH';
    const amount = Number(t.amount);
    return {
      id: t.id, date: t.date, action: t.action, amount, to_amount: t.to_amount == null ? null : Number(t.to_amount),
      note: t.note || '', category_id: t.category_id, account_id: t.account_id, from_account_id: t.from_account_id, to_account_id: t.to_account_id,
      currency: t.currency, rate: t.rate, mono: !!t.mono_op_id, splits: sc.get(t.id) ?? 0,
      v: t.action === 'INCOME' || t.action === 'RETURN' ? amount : t.action === 'EXPENSE' ? -amount : amount,
      foreign, sym: SYM[cur] ?? cur,
      name: clean(t.note) || clean(c?.name) || (tr ? 'Перевод' : 'Операция'),
      cat: tr ? 'Перевод' : sc.get(t.id) ? `${sc.get(t.id)} категории` : clean(c?.name) || 'Без категории',
      acc: tr ? `${clean(fa?.name) || '?'} → ${clean(ta?.name) || '?'}` : clean(acc?.name),
      icon: tr ? 'swap' : c?.icon || 'tag',
      uncat: !tr && t.category_id == null
    };
  });
  return { ops };
}

export async function deleteOp(id) {
  // страховка: операции банка удалять нельзя никогда
  const chk = await sb.from('transactions').select('mono_op_id').eq('id', id).limit(1);
  if (chk.error) throw chk.error;
  if (chk.data[0]?.mono_op_id) throw new Error('Банковские операции удалять нельзя');
  const r = await sb.from('transactions').delete().eq('id', id);
  if (r.error) throw r.error;
}

// Повтор операции: та же запись с сегодняшней датой
export async function repeatOp(o) {
  if (o.mono) throw new Error('Банковскую операцию повторить нельзя: в банке её не было');
  const row = {
    date: new Date().toISOString(), action: o.action, amount: o.amount, to_amount: o.to_amount, rate: o.rate, currency: o.currency,
    category_id: o.category_id, account_id: o.account_id, from_account_id: o.from_account_id, to_account_id: o.to_account_id, note: o.note || null
  };
  const r = await sb.from('transactions').insert(row);
  if (r.error) throw r.error;
}

// Категории для выбора в карточке и создании
export async function loadCategories() {
  const r = await sb.from('categories').select('id,name,type,icon,sort_order').order('sort_order');
  if (r.error) throw r.error;
  return { list: r.data.map((c) => ({ id: c.id, name: clean(c.name), type: c.type, icon: c.icon || 'tag' })) };
}

// Смена категории у операции
export async function setOpCategory(id, categoryId) {
  const r = await sb.from('transactions').update({ category_id: categoryId }).eq('id', id);
  if (r.error) throw r.error;
}

// «Запомнить»: правило «название → категория» (одно на пару действие + название)
export async function rememberRule(action, note, categoryId) {
  const n = (note || '').trim();
  if (!n) return;
  const f = await sb.from('rules').select('id').eq('action', action).eq('note', n).limit(1);
  if (f.error) throw f.error;
  const r = f.data.length
    ? await sb.from('rules').update({ category_id: categoryId }).eq('id', f.data[0].id)
    : await sb.from('rules').insert({ action, note: n, category_id: categoryId });
  if (r.error) throw r.error;
}

// Сколько прошлых операций без категории с таким же названием
export async function countUncat(action, note, exceptId) {
  const r = await sb.from('transactions').select('id', { count: 'exact', head: true })
    .eq('action', action).eq('note', note).is('category_id', null).neq('id', exceptId);
  if (r.error) throw r.error;
  return r.count ?? 0;
}
export async function applyUncat(action, note, categoryId) {
  const r = await sb.from('transactions').update({ category_id: categoryId }).eq('action', action).eq('note', note).is('category_id', null);
  if (r.error) throw r.error;
}

// Смена типа обычной операции (расход / доход / возврат); банковские и переводы не трогаем
export async function setOpType(id, action, categoryId) {
  if (!['EXPENSE', 'INCOME', 'RETURN'].includes(action)) throw new Error('Недопустимый тип');
  const chk = await sb.from('transactions').select('mono_op_id,action').eq('id', id).limit(1);
  if (chk.error) throw chk.error;
  if (chk.data[0]?.mono_op_id) throw new Error('У банковской операции тип менять нельзя');
  if (chk.data[0]?.action === 'TRANSFER') throw new Error('Перевод меняется в режиме «Изменить»');
  const r = await sb.from('transactions').update({ action, category_id: categoryId }).eq('id', id);
  if (r.error) throw r.error;
}

// Разделение суммы операции на несколько категорий
export async function loadSplits(id) {
  const r = await sb.from('transaction_splits').select('category_id,amount,sort_order').eq('transaction_id', id).order('sort_order');
  if (r.error) throw r.error;
  return r.data.map((x) => ({ category_id: x.category_id, amount: Number(x.amount) }));
}
export async function saveSplits(id, total, parts) {
  const sum = parts.reduce((t, p) => t + p.amount, 0);
  if (parts.length < 2 || Math.abs(sum - total) > 0.005) throw new Error('Сумма частей должна равняться сумме операции');
  const d = await sb.from('transaction_splits').delete().eq('transaction_id', id);
  if (d.error) throw d.error;
  const ins = await sb.from('transaction_splits').insert(parts.map((p, i) => ({ transaction_id: id, category_id: p.category_id, amount: p.amount, sort_order: i })));
  if (ins.error) throw ins.error;
  // основной категорией остаётся самая крупная часть
  const top = [...parts].sort((a, b) => b.amount - a.amount)[0];
  const u = await sb.from('transactions').update({ category_id: top.category_id }).eq('id', id);
  if (u.error) throw u.error;
}
export async function clearSplits(id) {
  const d = await sb.from('transaction_splits').delete().eq('transaction_id', id);
  if (d.error) throw d.error;
}
