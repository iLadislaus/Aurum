// Данные «Бюджета»: категории, конверты, связка категория → конверт
import { sb } from './supabase.js';

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
