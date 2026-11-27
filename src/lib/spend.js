// Траты месяца для «Бюджета» и Главной: те же правила, что в «Аналитике».
// Возврат уменьшает траты того месяца, когда была покупка
import { sb } from './supabase.js';
import { monthSpend } from './report.js';
import { opsRows } from './opsstore.js';

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

const COLS = ['id', 'date', 'action', 'amount', 'category_id', 'note', 'account_id', 'from_account_id'];
// траты и возвраты начиная с даты, по порядку
function spendOps(rows, since) {
  const from = Date.parse(since);
  return rows.filter((t) => (t.action === 'EXPENSE' || t.action === 'RETURN') && Date.parse(t.date) >= from)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || (a.id < b.id ? -1 : 1))
    .map((t) => Object.fromEntries(COLS.map((c) => [c, t[c]])));
}

// y, m — год и месяц с нуля. Берём год до начала месяца: возврат может относиться к давней покупке.
// rows — операции из копии на устройстве, если вызывающий уже их запросил
export async function loadMonthSpend(y, m, rows = opsRows()) {
  const since = new Date(y - 1, m, 1).toISOString();
  const [list, cats, accounts, splits] = await Promise.all([
    rows,
    all(() => sb.from('categories').select('id,name,type,is_debt').order('id')),
    all(() => sb.from('accounts').select('id,is_foreign').order('id')),
    all(() => sb.from('transaction_splits').select('transaction_id,category_id,amount').order('transaction_id').order('sort_order'))
  ]);
  return monthSpend({ ops: spendOps(list, since), cats, accounts, splits }, y * 12 + m);
}
