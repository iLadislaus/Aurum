// Данные для отчёта: один заход в базу, дальше любой период считается на месте
import { sb } from './supabase.js';
import { loadOpsRange } from './data.js';
import { loadRates } from './rate.js';

const clean = (s) => (s || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

// Supabase отдаёт не больше 1000 строк за раз
async function all(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await query().range(from, from + 999);
    if (r.error) throw r.error;
    rows.push(...r.data);
    if (r.data.length < 1000) return rows;
  }
}

export async function loadReportData() {
  const [{ ops }, cats, accounts, balances, splits, budgets, recurring, rates] = await Promise.all([
    loadOpsRange(null, null),
    all(() => sb.from('categories').select('id,name,type,icon,is_mandatory,is_debt').order('id')),
    all(() => sb.from('accounts').select('id,name,currency,block,is_foreign,is_monobank,is_debt').order('id')),
    all(() => sb.from('account_balances').select('id,balance').order('id')),
    all(() => sb.from('transaction_splits').select('transaction_id,category_id,amount').order('transaction_id').order('sort_order')),
    all(() => sb.from('budgets').select('category_id,month,amount').order('id')),
    all(() => sb.from('recurring_payments').select('name,amount,next_date').eq('active', true).eq('dismissed', false).order('id')),
    loadRates()
  ]);
  return {
    ops, splits, budgets, balances, rates,
    cats: cats.map((c) => ({ ...c, name: clean(c.name) })),
    accounts: accounts.map((a) => ({ ...a, name: clean(a.name) })),
    recurring: recurring.map((p) => ({ ...p, name: clean(p.name).split('\n')[0] }))
  };
}
