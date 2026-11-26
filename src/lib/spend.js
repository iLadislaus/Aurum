// Траты месяца для «Бюджета» и Главной: те же правила, что в «Аналитике».
// Возврат уменьшает траты того месяца, когда была покупка
import { sb } from './supabase.js';
import { monthSpend } from './report.js';

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

// y, m — год и месяц с нуля. Берём год до начала месяца: возврат может относиться к давней покупке
export async function loadMonthSpend(y, m) {
  const since = new Date(y - 1, m, 1).toISOString();
  const [ops, cats, accounts, splits] = await Promise.all([
    all(() => sb.from('transactions').select('id,date,action,amount,category_id,note,account_id,from_account_id').in('action', ['EXPENSE', 'RETURN']).gte('date', since).order('date').order('id')),
    all(() => sb.from('categories').select('id,name,type,is_debt').order('id')),
    all(() => sb.from('accounts').select('id,is_foreign').order('id')),
    all(() => sb.from('transaction_splits').select('transaction_id,category_id,amount').order('transaction_id').order('sort_order'))
  ]);
  return monthSpend({ ops, cats, accounts, splits }, y * 12 + m);
}
