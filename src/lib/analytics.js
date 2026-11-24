import { sb } from './supabase.js';
import { monthKey, incomeGroup } from './budget.js';

const clean = (s) => (s || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}️‍]/gu, '').replace(/\s+/g, ' ').trim();

// Итоги по месяцам (6 штук, последний — ym) и разбивка выбранного месяца по категориям
export async function loadAnalytics(ym) {
  const yms = [-5, -4, -3, -2, -1, 0].map((k) => ym + k);
  const [c, ...t] = await Promise.all([
    sb.from('categories').select('id,name,type,icon,is_debt'),
    ...yms.map((v) => sb.rpc('month_category_totals', { p_month: monthKey(Math.floor(v / 12), v % 12) }))
  ]);
  if (c.error) throw c.error;
  for (const r of t) if (r.error) throw r.error;
  const cm = new Map(c.data.map((x) => [x.id, x]));
  const months = yms.map((v, i) => {
    let exp = 0, inc = 0;
    const byCat = {}, byGrp = {};
    for (const r of t[i].data) {
      const k = cm.get(r.category_id);
      if (!k || k.is_debt) continue;
      const s = Number(r.total);
      if (r.action === 'EXPENSE') { exp += s; byCat[k.id] = (byCat[k.id] || 0) + s; }
      else if (r.action === 'RETURN') { exp -= s; byCat[k.id] = (byCat[k.id] || 0) - s; }
      else if (r.action === 'INCOME') { inc += s; const g = incomeGroup(k.name); byGrp[g] = (byGrp[g] || 0) + s; }
    }
    return { ym: v, exp, inc, byCat, byGrp };
  });
  const cats = c.data.filter((x) => !x.is_debt).map((x) => ({ id: x.id, name: clean(x.name), icon: x.icon || 'tag', income: x.type === 'INCOME' }));
  return { months, cats };
}
