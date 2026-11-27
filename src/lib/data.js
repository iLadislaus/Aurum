import { sb } from './supabase.js';
import { loadMonthSpend } from './spend.js';
import { OP_COLS } from './opcols.js';
import { opsRows, opsFreshSince } from './opsstore.js';

const first = (y, m) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MON_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// на какой момент верны загруженные данные: ответы могли прийти из памяти с последней сверки
const asOf = (started) => Math.min(started, opsFreshSince() ?? started);

// Убираем эмодзи из названий («Groceries 🥦» → «Groceries»)
const clean = (s) => (s || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍]/gu, '').replace(/\s+/g, ' ').trim();
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
  const rows = opsRows(); // одна копия операций на всю Главную
  const [list, spend, bal, cats, accs, rec, plans, ...sums] = await Promise.all([
    rows.then(newestFirst),
    loadMonthSpend(y, m, rows),
    sb.from('account_balances').select('id,balance,is_foreign'),
    sb.from('categories').select('id,name,icon,type,is_debt'),
    sb.from('accounts').select('id,name,currency,is_foreign,block,is_monobank'),
    sb.from('recurring_payments').select('id,name,amount,period,next_date,category_id').eq('active', true).eq('dismissed', false).order('next_date'),
    sb.from('budgets').select('category_id,amount').eq('month', first(y, m)),
    ...mons.map((d) => sb.rpc('month_summary', { p_month: first(d.getUTCFullYear(), d.getUTCMonth()) }))
  ]);
  for (const r of [bal, cats, accs, rec, plans, ...sums]) if (r.error) throw r.error;
  const latest = list.slice(0, 12);

  const catMap = new Map(cats.data.map((c) => [c.id, c]));
  const total = bal.data.filter((a) => !a.is_foreign).reduce((s, a) => s + Number(a.balance), 0);
  // показатели карточки: карты и наличные, конверты, траты за сегодня (только гривна)
  const kind = new Map(accs.data.map((a) => [a.id, a]));
  const homeBal = bal.data.filter((a) => !a.is_foreign);
  const cardsCash = homeBal.filter((a) => { const k = kind.get(a.id); return k && (k.is_monobank || k.block === 'card'); }).reduce((s, a) => s + Number(a.balance), 0);
  const envs = homeBal.filter((a) => kind.get(a.id)?.block === 'env').reduce((s, a) => s + Number(a.balance), 0);
  const day0 = ymd(now);
  const today = list.filter((t) => t.action === 'EXPENSE' && ymd(new Date(t.date)) === day0 && !kind.get(t.account_id)?.is_foreign).reduce((s, t) => s + Number(t.amount), 0);

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

  const horizon = rec.data.map((p) => ({
    id: p.id,
    name: clean(p.name).split('\n')[0],
    cat: clean(catMap.get(p.category_id)?.name) || 'Без категории',
    period: PERIOD[p.period] ?? '',
    amount: Number(p.amount),
    days: Math.round((new Date(p.next_date) - new Date(day0)) / 86400000),
    icon: catMap.get(p.category_id)?.icon || 'tag',
    catId: p.category_id ?? null,
    periodKey: p.period,
    date: p.next_date
  }));

  const ids = latest.map((t) => t.id);
  const spl = ids.length ? await sb.from('transaction_splits').select('transaction_id,category_id,amount').in('transaction_id', ids) : { data: [] };
  if (spl.error) throw spl.error;
  const sc = new Map(), sp = new Map();
  for (const x of spl.data) { sc.set(x.transaction_id, (sc.get(x.transaction_id) ?? 0) + 1); if (!sp.has(x.transaction_id)) sp.set(x.transaction_id, []); sp.get(x.transaction_id).push({ category_id: x.category_id, amount: Number(x.amount) }); }
  const am = new Map(accs.data.map((x) => [x.id, x]));
  const recent = latest.filter((t) => !isMarker(t)).slice(0, 5).map((t) => mapOp(t, catMap, am, sc, sp));
  flagPaired(latest, recent);

  // нераспределённые операции за всё время: без категории или в категории Uncategorized
  const unIds = cats.data.filter((c) => UNCAT.test(c.name || '')).map((c) => c.id);
  const un = list.filter((t) => t.action !== 'TRANSFER' && (t.category_id == null || unIds.includes(t.category_id)));
  const uncat = { n: un.length, first: un[0] ? mapOp(un[0], catMap, am, new Map()) : null };

  return {
    at: asOf(now.getTime()),
    total, delta, pct, cardsCash, envs, today,
    budget: planTotals(plans.data, catMap, spend),
    months, horizon, recent, uncat
  };
}

// «Бюджет на месяц» на Главной: только категории с планом, как на экране «Бюджет»
function planTotals(rows, cm, spend) {
  let plan = 0, spent = 0;
  for (const r of rows) {
    const c = cm.get(r.category_id), v = Number(r.amount);
    if (!c || c.type === 'INCOME' || c.is_debt || !(v > 0)) continue;
    plan += v; spent += Math.max(0, spend.get(r.category_id) || 0);
  }
  return { plan, spent };
}

const nz = (x) => Number(x || 0);

// Экран «Счета»: карты Monobank одной группой, Wallet и Cash, конверты, валютные счета, долги
export async function loadAccounts() {
  const now = new Date();
  const [acc, bal, sum] = await Promise.all([
    sb.from('accounts').select('id,name,icon,is_budget_source,block,currency,is_foreign,is_monobank,is_debt'),
    sb.from('account_balances').select('id,balance,credit_limit'),
    sb.rpc('month_summary', { p_month: first(now.getFullYear(), now.getMonth()) })
  ]);
  for (const r of [acc, bal, sum]) if (r.error) throw r.error;

  const bm = new Map(bal.data.map((b) => [b.id, b]));
  const rows = acc.data.map((a) => ({
    id: a.id, name: clean(a.name), icon: a.icon, src: a.is_budget_source, block: a.block, currency: a.currency,
    foreign: a.is_foreign, mono: a.is_monobank, debt: a.is_debt,
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
  for (const a of rows.filter((x) => x.foreign && !x.debt)) {
    const g = fx.get(a.currency) || { currency: a.currency, balance: 0, names: [], list: [] };
    g.balance += a.balance;
    g.names.push(a.name);
    g.list.push({ id: a.id, name: a.name, icon: a.icon, balance: a.balance });
    fx.set(a.currency, g);
  }

  const sumOf = (l) => l.reduce((x, a) => x + a.balance, 0);
  return {
    at: asOf(now.getTime()),
    total, delta, pct: start > 0 ? (delta / start) * 100 : 0,
    cards, cardsTotal: sumOf(cards),
    cashes, cardCashTotal: sumOf(cards) + sumOf(cashes),
    envs, envsTotal: sumOf(envs),
    foreign: [...fx.values()],
    // долговые счета: баланс отрицательный, сумма долга — по модулю
    debts: rows.filter((x) => x.debt).map((x) => ({ id: x.id, icon: x.icon, name: x.name, currency: x.currency, amount: Math.max(0, -x.balance), balance: x.balance }))
  };
}

// Изменение счёта: название, значок и (для наличных и конвертов) «Источник бюджета». Остаток и валюта не трогаются
export async function updateAccount(id, { name, icon, budgetSource, withSource }) {
  const { error } = await sb.from('accounts').update({ name, icon }).eq('id', id);
  if (error) throw error;
  if (!withSource) return;
  // источник бюджета в базе только один: включаем через функцию, она снимает метку с остальных
  const r = budgetSource ? await sb.rpc('set_budget_source', { p_id: id }) : await sb.from('accounts').update({ is_budget_source: false }).eq('id', id);
  if (r.error) throw r.error;
}

// Удаление счёта: все его операции переезжают на счёт to (переводы между ними получают пометку «Счёт удалён»)
export async function countAccountOps(id) {
  const { count, error } = await sb.from('transactions').select('id', { count: 'exact', head: true }).or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`);
  if (error) throw error;
  return count || 0;
}
export async function deleteAccount(id, to) {
  const { error } = await sb.rpc('delete_account', { p_id: id, p_to: to ?? null });
  if (error) throw error;
}

// Операции одного счёта: со знаком для этого счёта, по дням, плюс итоги текущего месяца
// Операции счёта из уже загруженных строк: со знаком для этого счёта, плюс итоги месяца
function buildAccountOps(id, rows, { cm, am, sc, sp }) {
  const now = new Date();
  const mk = now.getFullYear() * 12 + now.getMonth();
  let inc = 0, out = 0;
  // op — та же операция в общем виде: по тапу открывается обычная карточка операции
  const full = rows.filter((t) => !isMarker(t)).map((t) => mapOp(t, cm, am, sc, sp));
  pairRefunds(full);
  const ops = rows.filter((t) => !isMarker(t)).map((t, i) => {
    const c = cm.get(t.category_id);
    let v;
    if (t.action === 'INCOME' || t.action === 'RETURN') v = Number(t.amount);
    else if (t.action === 'EXPENSE') v = -Number(t.amount);
    else v = t.to_account_id === id ? Number(t.to_amount ?? t.amount) : -Number(t.amount);
    const d = new Date(t.date);
    if (d.getFullYear() * 12 + d.getMonth() === mk) { if (v > 0) inc += v; else out += v; }
    return {
      id: t.id, date: t.date, amount: v, raw: Number(t.amount), action: t.action, note: t.note || '', account_id: t.account_id,
      name: clean(t.note) || clean(c?.name) || (t.action === 'TRANSFER' ? 'Перевод' : 'Операция'),
      cat: t.action === 'TRANSFER' ? 'Перевод' : clean(c?.name) || 'Без категории',
      icon: t.action === 'TRANSFER' ? 'swap' : c?.icon || 'tag',
      op: full[i]
    };
  });
  pairRefunds(ops);
  return { ops, inc, out };
}

// Операции для экранов берутся из копии на устройстве (перед выдачей она сверяется с базой), новые сверху
const newestFirst = (rows) => [...rows].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : 1));
const allOps = async () => newestFirst(await opsRows());

// справочники для списков операций: категории, счета и разделения.
// Загрузчики, стартующие одновременно, делят один запрос справочников; более поздний вызов запрашивает заново
let refsNow = null;
function loadRefs() {
  if (!refsNow) { refsNow = fetchRefs(); setTimeout(() => { refsNow = null; }, 0); }
  return refsNow;
}

async function fetchRefs() {
  const [cats, accs, spl] = await Promise.all([
    sb.from('categories').select('id,name,icon,type,is_debt'),
    sb.from('accounts').select('id,name,currency,is_foreign'),
    sb.from('transaction_splits').select('transaction_id,category_id,amount')
  ]);
  for (const r of [cats, accs, spl]) if (r.error) throw r.error;
  const sc = new Map();
  const sp = new Map();
  for (const x of spl.data) { sc.set(x.transaction_id, (sc.get(x.transaction_id) ?? 0) + 1); if (!sp.has(x.transaction_id)) sp.set(x.transaction_id, []); sp.get(x.transaction_id).push({ category_id: x.category_id, amount: Number(x.amount) }); }
  return { cm: new Map(cats.data.map((c) => [c.id, c])), am: new Map(accs.data.map((x) => [x.id, x])), sc, sp };
}

const ofAccount = (rows, id) => rows.filter((t) => t.account_id === id || t.from_account_id === id || t.to_account_id === id).slice(0, 300);

export async function loadAccountOps(id) {
  const [all, refs] = await Promise.all([allOps(), loadRefs()]);
  return buildAccountOps(id, ofAccount(all, id), refs);
}

// Все операции одним заходом и раскладка по счетам: окно любого счёта открывается сразу с готовым списком
export async function loadOpsForAll(ids, rows = opsRows()) {
  const all = newestFirst(await rows);
  const refs = await loadRefs();
  const out = new Map();
  for (const id of ids) out.set(id, buildAccountOps(id, ofAccount(all, id), refs));
  return out;
}

// Новый счёт. Начальный остаток записывается операцией «Коррекция баланса» (категория 25), как уже сделано в базе
export async function createAccount({ type, name, icon, currency, budgetSource, balance }) {
  const debt = type === 'debt';
  const { data, error } = await sb.from('accounts').insert({
    name, icon, currency,
    block: type === 'env' ? 'env' : type === 'cash' ? 'card' : null,
    is_foreign: type === 'fx' || debt, is_debt: debt, is_budget_source: budgetSource
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
// Пустышка объединённой пары: перевод «со счёта на тот же счёт», в списках не показывается, баланс не меняет
const isMarker = (t) => t.action === 'TRANSFER' && t.from_account_id != null && t.from_account_id === t.to_account_id;

// Помечает переводы, собранные из пары банковских операций (у них есть скрытая пустышка): их можно разъединить свайпом
function flagPaired(raw, ops) {
  const ms = raw.filter(isMarker);
  if (!ms.length) return;
  for (const o of ops) {
    if (!o.mono || o.action !== 'TRANSFER' || o.from_account_id == null || o.from_account_id === o.to_account_id) continue;
    const t = new Date(o.date).getTime();
    o.paired = ms.some((m) => m.to_account_id === o.to_account_id && Number(m.amount) === o.amount && Math.abs(new Date(m.date) - t) <= 10 * 60 * 1000);
  }
}


// Одна операция для списков (Операции и «Последние операции» на Главной)
export const UNCAT = /^uncategorized/i;
const OP_SYM = { UAH: '₴', USD: '$', EUR: '€' };
// подпись разделённой операции: самая крупная категория первой, затем остальные
function splitLabel(parts, cm, n) {
  if (!parts?.length) return `${n} категории`;
  const nm = [...parts].sort((a, b) => b.amount - a.amount).map((p) => clean(cm.get(p.category_id)?.name) || 'Без категории');
  return nm.length > 2 ? `${nm[0]} + ещё ${nm.length - 1}` : nm.join(' + ');
}
function mapOp(t, cm, am, sc, sp) {
  const c = cm.get(t.category_id), acc = am.get(t.account_id), fa = am.get(t.from_account_id), ta = am.get(t.to_account_id);
  const tr = t.action === 'TRANSFER';
  const foreign = tr ? !!(fa?.is_foreign || ta?.is_foreign) : !!acc?.is_foreign;
  const cur = tr ? (fa?.is_foreign ? fa.currency : ta?.is_foreign ? ta.currency : 'UAH') : acc?.is_foreign ? acc.currency : 'UAH';
  const amount = Number(t.amount);
  const un = !tr && !sc.get(t.id) && (t.category_id == null || UNCAT.test(c?.name || ''));
  const dc = tr && c?.is_debt ? c : null; // перевод по долгу: берём долг («Debt taken») или гасим («Debt repayment»)
  return {
    id: t.id, date: t.date, action: t.action, amount, to_amount: t.to_amount == null ? null : Number(t.to_amount),
    note: t.note || '', category_id: t.category_id, account_id: t.account_id, from_account_id: t.from_account_id, to_account_id: t.to_account_id,
    currency: t.currency, rate: t.rate, mono: !!t.mono_op_id, splits: sc.get(t.id) ?? 0,
    v: dc ? (dc.type === 'EXPENSE' ? -amount : amount) : t.action === 'INCOME' || t.action === 'RETURN' ? amount : t.action === 'EXPENSE' ? -amount : amount,
    foreign, sym: OP_SYM[cur] ?? cur,
    name: clean(t.note) || clean(c?.name) || (tr ? 'Перевод' : 'Операция'),
    cat: dc ? clean(dc.name) : tr ? 'Перевод' : sc.get(t.id) ? splitLabel(sp?.get(t.id), cm, sc.get(t.id)) : un ? 'Без категории' : clean(c?.name) || 'Без категории',
    acc: tr ? `${clean(fa?.name) || '?'} → ${clean(ta?.name) || '?'}` : clean(acc?.name),
    icon: tr && !dc ? 'swap' : sc.get(t.id) ? 'split' : c?.icon || 'tag',
    uncat: un
  };
}

// Операции за любой период: a и b — границы (ISO), без границы — до края; страницами по 1000
export async function loadOpsRange(a, b) {
  const from = a ? Date.parse(a) : -Infinity, to = b ? Date.parse(b) : Infinity;
  const rows = (await allOps()).filter((t) => { const d = Date.parse(t.date); return d >= from && d < to; });
  const { cm, am, sc, sp } = await loadRefs();
  const ops = rows.filter((t) => !isMarker(t)).map((t) => mapOp(t, cm, am, sc, sp));
  flagPaired(rows, ops);
  pairRefunds(ops);
  return { ops };
}

// Возврат «Скасування. X» привязываем к списанию X на том же счёте (не позже 3 суток до возврата),
// чтобы у списания показать итог: списано минус возвращено (заправка WOG: полный бак, потом возврат остатка)
function pairRefunds(ops) {
  const mag = (o) => o.raw ?? o.amount;
  const key = (s) => (s || '').trim().toLowerCase();
  const rets = ops.filter((o) => o.action === 'RETURN' && /^скасування\.\s*\S/i.test(o.note)).sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const r of rets) {
    const name = key(r.note.replace(/^скасування\.\s*/i, '')), t = new Date(r.date).getTime();
    let best = null;
    for (const e of ops) {
      if (e.action !== 'EXPENSE' || e.account_id !== r.account_id || key(e.note) !== name) continue;
      const te = new Date(e.date).getTime();
      if (te > t || t - te > 3 * 86400000) continue;
      const left = mag(e) - (e.back ?? []).reduce((s, x) => s + x.amount, 0);
      if (left + 0.005 < mag(r)) continue;
      if (!best || te > new Date(best.date).getTime()) best = e;
    }
    if (best) (best.back ??= []).push({ id: r.id, amount: mag(r) });
  }
  for (const e of ops) if (e.back) e.net = Math.round((mag(e) - e.back.reduce((s, x) => s + x.amount, 0)) * 100) / 100;
}

export const loadMonthOps = (y, m) => loadOpsRange(new Date(y, m, 1).toISOString(), new Date(y, m + 1, 1).toISOString());

// Загрузчик по ключу кэша: ops.m.2026-10, ops.y.2026, ops.all, ops.r.2026-11-18.2026-11-24
const dayStart = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function opsLoader(key) {
  const p = key.split('.');
  if (p[1] === 'm') { const [y, m] = p[2].split('-').map(Number); return () => loadMonthOps(y, m); }
  if (p[1] === 'y') { const y = Number(p[2]); return () => loadOpsRange(new Date(y, 0, 1).toISOString(), new Date(y + 1, 0, 1).toISOString()); }
  if (p[1] === 'r') { const f = dayStart(p[2]), t = dayStart(p[3]); t.setDate(t.getDate() + 1); return () => loadOpsRange(f.toISOString(), t.toISOString()); }
  return () => loadOpsRange(null, null);
}

// Месяцы, в которых есть операции: «2026-10» → сколько операций (для выпадающих списков периода)
export async function loadOpsMonths() {
  const out = {};
  for (const t of await opsRows()) { const d = new Date(t.date); const k = d.getFullYear() + '-' + d.getMonth(); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

// Счета для фильтра «Операций»: все, кроме долговых
export async function loadAccList() {
  const r = await sb.from('accounts').select('id,name,currency,is_foreign,is_debt,is_monobank').order('name');
  if (r.error) throw r.error;
  return { list: r.data.filter((a) => !a.is_debt).map((a) => ({ id: a.id, name: clean(a.name), cur: a.currency, foreign: !!a.is_foreign, mono: !!a.is_monobank })) };
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
  const r = await sb.from('categories').select('id,name,type,icon,sort_order,is_debt').order('sort_order');
  if (r.error) throw r.error;
  return { list: r.data.map((c) => ({ id: c.id, name: clean(c.name), type: c.type, icon: c.icon || 'tag', debt: !!c.is_debt })) };
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

// Окно «Правила»: список вместе с названиями счетов для переводов, новые сверху
export async function loadRules() {
  const [r, a] = await Promise.all([
    sb.from('rules').select('id,action,note,category_id,from_account_id,to_account_id').order('id', { ascending: false }),
    sb.from('accounts').select('id,name')
  ]);
  if (r.error) throw r.error;
  if (a.error) throw a.error;
  const acc = new Map(a.data.map((x) => [x.id, clean(x.name)]));
  return { list: r.data.map((x) => ({ id: x.id, action: x.action, note: x.note || '', catId: x.category_id, from: acc.get(x.from_account_id) ?? '', to: acc.get(x.to_account_id) ?? '' })) };
}
export async function setRuleCategory(id, categoryId) {
  const r = await sb.from('rules').update({ category_id: categoryId }).eq('id', id);
  if (r.error) throw r.error;
}
export async function deleteRule(id) {
  const r = await sb.from('rules').delete().eq('id', id);
  if (r.error) throw r.error;
}

// Сколько прошлых операций без категории с таким же названием
const uncatFilter = async () => {
  const c = await sb.from('categories').select('id,name');
  if (c.error) throw c.error;
  const ids = c.data.filter((x) => UNCAT.test(x.name || '')).map((x) => x.id);
  return ids.length ? `category_id.is.null,category_id.in.(${ids.join(',')})` : 'category_id.is.null';
};
export async function countUncat(action, note, exceptId) {
  const r = await sb.from('transactions').select('id', { count: 'exact', head: true })
    .eq('action', action).eq('note', note).or(await uncatFilter()).neq('id', exceptId);
  if (r.error) throw r.error;
  return r.count ?? 0;
}
export async function applyUncat(action, note, categoryId) {
  const r = await sb.from('transactions').update({ category_id: categoryId }).eq('action', action).eq('note', note).or(await uncatFilter());
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

// Создание и правка операции (вручную; банковские операции сюда не попадают)
export async function saveOp(id, f) {
  const row = {
    date: f.date, action: f.action, amount: f.amount, note: f.note || null, category_id: f.category_id ?? null,
    account_id: f.action === 'TRANSFER' ? null : f.account_id, from_account_id: f.action === 'TRANSFER' ? f.from_account_id : null,
    to_account_id: f.action === 'TRANSFER' ? f.to_account_id : null, currency: f.currency || 'UAH',
    to_amount: f.action === 'TRANSFER' ? f.to_amount ?? null : null, rate: f.action === 'TRANSFER' ? f.rate ?? null : null
  };
  if (id) {
    const chk = await sb.from('transactions').select('mono_op_id').eq('id', id).limit(1);
    if (chk.error) throw chk.error;
    if (chk.data[0]?.mono_op_id) throw new Error('Банковскую операцию править нельзя, только категорию');
    const r = await sb.from('transactions').update(row).eq('id', id);
    if (r.error) throw r.error;
    return id;
  }
  const r = await sb.from('transactions').insert(row).select('id').limit(1);
  if (r.error) throw r.error;
  return r.data[0].id;
}

// Плановый платёж («На горизонте»): новый или (с id) изменённый
export async function savePlanned({ id, name, amount, categoryId, period, nextDate }) {
  const row = { name, pattern: name.toLowerCase(), amount, period, next_date: nextDate, category_id: categoryId ?? null };
  const r = id
    ? await sb.from('recurring_payments').update(row).eq('id', id)
    : await sb.from('recurring_payments').insert({ ...row, active: true, dismissed: false });
  if (r.error) throw r.error;
}

export async function deletePlanned(id) {
  const r = await sb.from('recurring_payments').delete().eq('id', id);
  if (r.error) throw r.error;
}

// ---- Перевод между своими счетами из двух банковских операций (минус на одном, плюс на другом)
const PAIR_MS = 10 * 60 * 1000;
async function accName(ids) {
  const r = await sb.from('accounts').select('id,name').in('id', ids);
  if (r.error) throw r.error;
  return new Map(r.data.map((a) => [a.id, clean(a.name)]));
}

// Ищет вторую половину: та же сумма, обратное направление, другой банковский счёт, в пределах 10 минут
export async function findBankPair(o) {
  if (!o?.mono || !['EXPENSE', 'INCOME'].includes(o.action) || o.account_id == null) return null;
  const t = new Date(o.date).getTime();
  const r = await sb.from('transactions').select('id,date,note,account_id,action,amount').not('mono_op_id', 'is', null)
    .eq('action', o.action === 'EXPENSE' ? 'INCOME' : 'EXPENSE').eq('amount', o.amount)
    .gte('date', new Date(t - PAIR_MS).toISOString()).lte('date', new Date(t + PAIR_MS).toISOString());
  if (r.error) throw r.error;
  const c = r.data.filter((x) => x.account_id != null && x.account_id !== o.account_id).sort((a, b) => Math.abs(new Date(a.date) - t) - Math.abs(new Date(b.date) - t))[0];
  if (!c) return null;
  const n = await accName([o.account_id, c.account_id]);
  const exp = o.action === 'EXPENSE';
  return { id: c.id, note: c.note || '', date: c.date, accId: c.account_id, acc: n.get(c.account_id) || '?', mine: n.get(o.account_id) || '?', from: exp ? o.account_id : c.account_id, to: exp ? c.account_id : o.account_id };
}

export async function mergeBankPair(o, pair) {
  const expId = o.action === 'EXPENSE' ? o.id : pair.id, incId = o.action === 'EXPENSE' ? pair.id : o.id;
  const cl = await sb.from('transaction_splits').delete().eq('transaction_id', expId);
  if (cl.error) throw cl.error;
  const a = await sb.from('transactions').update({ action: 'TRANSFER', account_id: null, category_id: null, from_account_id: pair.from, to_account_id: pair.to }).eq('id', expId);
  if (a.error) throw a.error;
  const b = await sb.from('transactions').update({ action: 'TRANSFER', account_id: null, category_id: null, from_account_id: pair.to, to_account_id: pair.to }).eq('id', incId);
  if (b.error) throw b.error;
}

// Пустышка этого перевода (если он собран из пары), иначе null: тогда разъединять нечего
export async function findMarker(o) {
  if (!o?.mono || o.action !== 'TRANSFER' || o.from_account_id == null || o.from_account_id === o.to_account_id) return null;
  const t = new Date(o.date).getTime();
  const r = await sb.from('transactions').select('id,date').not('mono_op_id', 'is', null).eq('action', 'TRANSFER')
    .eq('from_account_id', o.to_account_id).eq('to_account_id', o.to_account_id).eq('amount', o.amount)
    .gte('date', new Date(t - PAIR_MS).toISOString()).lte('date', new Date(t + PAIR_MS).toISOString());
  if (r.error) throw r.error;
  return r.data[0] ?? null;
}

export async function splitBankPair(o, marker) {
  const a = await sb.from('transactions').update({ action: 'EXPENSE', account_id: o.from_account_id, from_account_id: null, to_account_id: null, category_id: null }).eq('id', o.id);
  if (a.error) throw a.error;
  const b = await sb.from('transactions').update({ action: 'INCOME', account_id: o.to_account_id, from_account_id: null, to_account_id: null, category_id: null }).eq('id', marker.id);
  if (b.error) throw b.error;
}

// Разъединение прямо из списка (свайп): находит пустышку и возвращает расход и доход
export async function unmergeOp(o) {
  const m = await findMarker(o);
  if (!m) throw new Error('Пара не найдена');
  await splitBankPair(o, m);
}
