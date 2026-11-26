// Данные «Бюджета»: категории, конверты, связка категория → конверт
import { sb } from './supabase.js';
import { loadMonthSpend } from './spend.js';

const clean = (s) => (s || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍]/gu, '').replace(/\s+/g, ' ').trim();
export const MODE = { spread: 'Плавно', lump: 'Разово', chunks: 'Частями' };
export const MODE_KEY = { 'Плавно': 'spread', 'Разово': 'lump', 'Частями': 'chunks' };
// группа дохода пока определяется по названию (отдельного поля в базе нет)
export const incomeGroup = (name) => (/^advance|аванс/i.test(name) ? 'Аванс' : /^salary|зарплат/i.test(name) ? 'Зарплата' : 'Другое');

export async function loadBudgetCats() {
  const [c, a] = await Promise.all([
    sb.from('categories').select('id,name,type,icon,is_mandatory,spend_mode,spend_parts,target_account_id,sort_order,is_debt').order('sort_order'),
    sb.from('accounts').select('id,name,block,icon').eq('block', 'env')
  ]);
  if (c.error) throw c.error;
  if (a.error) throw a.error;
  const bal = await sb.from('account_balances').select('id,balance').in('id', a.data.map((x) => x.id));
  if (bal.error) throw bal.error;
  const bm = new Map(bal.data.map((b) => [b.id, Number(b.balance)]));
  const envs = a.data.map((e) => ({ id: e.id, name: clean(e.name), icon: e.icon || 'mail', balance: bm.get(e.id) ?? 0 })).sort((x, y) => x.name.localeCompare(y.name));
  const cats = c.data.filter((x) => !x.is_debt).map((x) => ({
    id: x.id, name: clean(x.name), income: x.type === 'INCOME', icon: x.icon || 'tag', mand: !!x.is_mandatory,
    mode: MODE[x.spend_mode] || 'Плавно', parts: x.spend_parts || 4, env: x.target_account_id, grp: x.type === 'INCOME' ? incomeGroup(x.name) : null, order: x.sort_order
  }));
  return { cats, envs };
}

export async function saveBudgetCat(d) {
  const row = { name: d.name.trim(), type: d.income ? 'INCOME' : 'EXPENSE', icon: d.icon, is_mandatory: d.income ? false : d.mand, spend_mode: MODE_KEY[d.mode] || 'spread', spend_parts: d.parts, target_account_id: d.income ? null : d.env ?? null };
  const r = d.id ? await sb.from('categories').update(row).eq('id', d.id) : await sb.from('categories').insert(row);
  if (r.error) throw r.error;
}
// связка нескольких категорий разом (исправление перепутанных конвертов)
export async function setCatEnv(pairs) {
  for (const [id, env] of pairs) { const r = await sb.from('categories').update({ target_account_id: env }).eq('id', id); if (r.error) throw r.error; }
}
export async function countCatOps(id) {
  const { count, error } = await sb.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id);
  if (error) throw error;
  return count || 0;
}
// удаление: операции, правила и платежи переезжают в выбранную категорию
export async function deleteBudgetCat(id, to) {
  for (const t of ['transactions', 'transaction_splits', 'rules', 'recurring_payments']) {
    const r = await sb.from(t).update({ category_id: to }).eq('category_id', id); if (r.error) throw r.error;
  }
  const b = await sb.from('budgets').delete().eq('category_id', id); if (b.error) throw b.error;
  const r = await sb.from('categories').delete().eq('id', id); if (r.error) throw r.error;
}

// ── План на месяц ──
export const monthKey = (y, m) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
export async function loadPlan(month) {
  const [b, t] = await Promise.all([
    sb.from('budgets').select('id,category_id,amount').eq('month', month),
    sb.rpc('month_category_totals', { p_month: month })
  ]);
  if (b.error) throw b.error;
  if (t.error) throw t.error;
  const plan = {}, ids = {}, got = {};
  for (const r of b.data) { plan[r.category_id] = Number(r.amount); ids[r.category_id] = r.id; }
  for (const r of t.data) if (r.action === 'INCOME') got[r.category_id] = (got[r.category_id] || 0) + Number(r.total);
  return { plan, ids, got };
}
// сохраняем только изменённое: есть строка — обновляем, нет и сумма больше нуля — добавляем
export async function savePlan(month, vals, ids, prev) {
  for (const [cid, v] of Object.entries(vals)) {
    const was = prev[cid] || 0;
    if (was === v) continue;
    const r = ids[cid] ? await sb.from('budgets').update({ amount: v }).eq('id', ids[cid]) : v > 0 ? await sb.from('budgets').insert({ category_id: Number(cid), month, amount: v }) : { error: null };
    if (r.error) throw r.error;
  }
}

// ── Разложить деньги ──
const INC_KEYS = ['advance', 'salary', 'other'];
// корректировки баланса — не доход, в «Получено» не считаются
export const isCorr = (name) => /balanc|corect|correct|корректир/i.test(name || '');
// Что реально лежит на Cash и его можно разложить: доходы, пришедшие на Cash, и переводы на Cash с карт (сняли деньги)
export async function loadCashIn(month, cash) {
  if (!cash) return { got: {}, xfer: 0 };
  const [y, m] = month.split('-').map(Number);
  const a = new Date(y, m - 1, 1).toISOString(), z = new Date(y, m, 1).toISOString();
  const [inc, xf, env] = await Promise.all([
    sb.from('transactions').select('category_id,amount').eq('action', 'INCOME').eq('account_id', cash).gte('date', a).lt('date', z),
    sb.from('transactions').select('amount,from_account_id').eq('action', 'TRANSFER').eq('to_account_id', cash).gte('date', a).lt('date', z),
    sb.from('accounts').select('id').eq('block', 'env')
  ]);
  for (const r of [inc, xf, env]) if (r.error) throw r.error;
  const got = {}; for (const r of inc.data) got[r.category_id] = (got[r.category_id] || 0) + Number(r.amount);
  const envIds = new Set(env.data.map((e) => e.id));
  const xfer = xf.data.filter((r) => !envIds.has(r.from_account_id)).reduce((s, r) => s + Number(r.amount), 0);
  return { got, xfer };
}
export async function loadDist(month) {
  const [d, m, a] = await Promise.all([
    sb.from('budget_distribution').select('category_id,advance,salary,other').eq('month', month),
    sb.from('budget_distribution_month').select('*').eq('month', month).maybeSingle(),
    sb.from('accounts').select('id').eq('is_budget_source', true).limit(1)
  ]);
  for (const r of [d, m, a]) if (r.error) throw r.error;
  const rows = {}; for (const r of d.data) rows[r.category_id] = INC_KEYS.map((k) => Number(r[k] || 0));
  const done = [0, 0, 0]; for (const v of Object.values(rows)) v.forEach((x, i) => (done[i] += x));
  return { rows, done, cash: a.data[0]?.id ?? null, batches: m.data?.batches ?? [] };
}
// items: [{ cat, env, name, a: [аванс, зарплата, другое] }] → по одному переводу Cash → конверт на каждый конверт
export async function formDist(month, label, cash, items) {
  if (!cash) throw new Error('Не найден счёт Cash (источник бюджета)');
  const now = new Date().toISOString();
  const tx = items.map((i) => ({ date: now, action: 'TRANSFER', amount: i.a.reduce((s, v) => s + v, 0), from_account_id: cash, to_account_id: i.env, note: `Бюджет ${label}: ${i.name}` }));
  const ins = await sb.from('transactions').insert(tx).select('id');
  if (ins.error) throw ins.error;
  const ids = ins.data.map((r) => r.id);
  const cur = await loadDist(month);
  for (const i of items) {
    const old = cur.rows[i.cat] || [0, 0, 0], v = old.map((x, k) => x + i.a[k]);
    const r = await sb.from('budget_distribution').upsert({ category_id: i.cat, month, advance: v[0], salary: v[1], other: v[2] }, { onConflict: 'category_id,month' });
    if (r.error) throw r.error;
  }
  const batch = { id: ids[0], ts: now, ids, items: items.map((i) => ({ cat: i.cat, a: i.a })) };
  const tot = items.reduce((s, i) => i.a.map((v, k) => (s[k] || 0) + v), []);
  const mr = await sb.from('budget_distribution_month').upsert({ month, advance_total: cur.done[0] + tot[0], salary_total: cur.done[1] + tot[1], formed_at: now, transfer_ids: ids, batches: [...cur.batches, batch] }, { onConflict: 'month' });
  if (mr.error) throw mr.error;
  return batch;
}
export async function undoDist(month, batch) {
  const del = await sb.from('transactions').delete().in('id', batch.ids);
  if (del.error) throw del.error;
  const cur = await loadDist(month);
  for (const i of batch.items) {
    const old = cur.rows[i.cat] || [0, 0, 0], v = old.map((x, k) => Math.max(0, x - i.a[k]));
    const r = await sb.from('budget_distribution').upsert({ category_id: i.cat, month, advance: v[0], salary: v[1], other: v[2] }, { onConflict: 'category_id,month' });
    if (r.error) throw r.error;
  }
  const left = cur.batches.filter((b) => b.id !== batch.id);
  const done = [0, 0, 0]; for (const i of batch.items) i.a.forEach((v, k) => (done[k] += v));
  const mr = await sb.from('budget_distribution_month').upsert({ month, advance_total: Math.max(0, cur.done[0] - done[0]), salary_total: Math.max(0, cur.done[1] - done[1]), batches: left }, { onConflict: 'month' });
  if (mr.error) throw mr.error;
}

// ── Экран «Бюджет» ──
export async function loadBudgetMonth(month) {
  const [c, p, ds] = await Promise.all([
    sb.from('categories').select('id,name,type,icon,is_mandatory,spend_mode,spend_parts,is_debt,sort_order').order('sort_order'),
    loadPlan(month),
    loadDist(month)
  ]);
  if (c.error) throw c.error;
  const t = await sb.rpc('month_category_totals', { p_month: month });
  if (t.error) throw t.error;
  // долги берём из базы (там и переводы по долгу), остальные траты — по правилам отчёта
  const debts = {};
  for (const r of t.data) { if (r.action === 'EXPENSE') debts[r.category_id] = (debts[r.category_id] || 0) + Number(r.total); else if (r.action === 'RETURN') debts[r.category_id] = (debts[r.category_id] || 0) - Number(r.total); }
  const [yy, mm] = month.split('-').map(Number);
  const spent = await loadMonthSpend(yy, mm - 1);
  const cats = c.data.map((x) => ({
    id: x.id, name: clean(x.name), income: x.type === 'INCOME', icon: x.icon || 'tag', mand: !!x.is_mandatory, debt: !!x.is_debt,
    mode: x.spend_mode || 'spread', parts: x.spend_parts || 4, grp: x.type === 'INCOME' ? incomeGroup(x.name) : null,
    plan: p.plan[x.id] || 0, fact: x.type === 'INCOME' ? p.got[x.id] || 0 : Math.max(0, (x.is_debt ? debts[x.id] : spent.get(x.id)) || 0)
  }));
  // свободно для раскладки — только то, что физически лежит на Cash (как в окне «Разложить»)
  const gk = { 'Аванс': 0, 'Зарплата': 1, 'Другое': 2 };
  const ci = await loadCashIn(month, ds.cash);
  const got = [0, 0, 0]; for (const x of cats) if (x.income && !isCorr(x.name)) got[gk[x.grp]] += ci.got[x.id] || 0;
  got[2] += ci.xfer;
  const free = got.map((g, i) => Math.max(0, g - ds.done[i]));
  return { cats, free, at: Date.now() };
}
