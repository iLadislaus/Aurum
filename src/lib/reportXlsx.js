// Отчёт → книга Excel: листы с таблицами и диаграммами
import { buildXlsx, serial } from './xlsx.js';
import { ruDate, dayKey } from './report.js';

const title = (text, sub) => [[{ v: text, s: 'title' }], [{ v: sub, s: 'muted' }], []];
const head = (...n) => n.map((v) => ({ v, s: 'head' }));
const pct = (v) => ({ v: v == null ? null : v / 100, s: 'pct' });
const TYPE = { EXPENSE: 'Расход', INCOME: 'Доход', RETURN: 'Возврат', TRANSFER: 'Перевод' };

// Лист из блоков: add возвращает номера первой и последней строк данных таблицы
function sheet(name, cols, text, sub) {
  const s = { name, cols, rows: title(text, sub), charts: [] };
  s.table = (caption, header, rows) => {
    if (caption) s.rows.push([{ v: caption, s: 'bold' }]);
    s.rows.push(head(...header));
    const from = s.rows.length;
    s.rows.push(...(rows.length ? rows : [[{ v: 'Нет данных', s: 'muted' }]]));
    const to = s.rows.length - 1;
    s.rows.push([]);
    return { from, to, n: rows.length };
  };
  // диаграммы идут столбиком справа от таблиц
  let top = 3;
  s.chart = (t, c, h = 18) => { if (!t.n) return; s.charts.push({ ...c, from: t.from, to: t.to, at: [cols.length + 1, top, 9, h] }); top += h + 1; };
  return s;
}
// сумма по колонке формулой, чтобы при правке строк итог пересчитывался
const total = (s, t, col, value) => (t.n ? { v: value, f: `SUM(${col}${t.from + 1}:${col}${t.to + 1})`, s: 'moneyBold' } : { v: 0, s: 'moneyBold' });
const closeTotal = (s, row) => { s.rows.splice(s.rows.length - 1, 0, row); };
const r2 = (v) => Math.round(v * 100) / 100;
const addUp = (l, f) => r2(l.reduce((x, y) => x + f(y), 0));

export function reportSheets(r) {
  const sub = `${r.period.label} · сформирован ${ruDate(r.today)} · суммы в гривнах${r.partial ? ` · данные с ${ruDate(r.first)}` : ''}`;
  const book = [];

  const s1 = sheet('Сводка', [34, 18, 18, 14], 'Aurum · Финансовый отчёт', sub);
  s1.table('Итоги периода', ['Показатель', 'Период', 'Прошлый', 'Изменение'], [
    ['Доходы', r.inc, r.prev?.inc ?? { v: '—', s: 'text' }, pct(r.incChange)],
    ['Расходы', r.exp, r.prev?.exp ?? { v: '—', s: 'text' }, pct(r.expChange)],
    ['Остаток (доходы − расходы)', r.saldo, r.prev?.saldo ?? { v: '—', s: 'text' }],
    ['Доля сбережений', pct(r.rate)],
    ['Средний расход в день', r.avgDay],
    ['Погашено долгов', r.paid],
    ['Взято в долг', r.taken],
    ['Деньги на гривневых счетах сегодня', r.accounts.homeTotal]
  ]);
  const flow = s1.table('Доходы и расходы', ['Показатель', 'Сумма'], [['Доходы', r.inc], ['Расходы', r.exp]]);
  s1.chart(flow, { type: 'column', title: 'Доходы и расходы периода', cat: 0, series: [{ name: 'Сумма', col: 1 }] }, 15);
  if (r.health.score != null) s1.table(`Финансовое здоровье: ${r.health.score} из 100`, ['Часть', 'Значение', 'Баллы', 'Максимум'],
    r.health.parts.map((p) => [p.name, { v: p.text, s: 'text' }, { v: p.got, s: 'int' }, { v: p.max, s: 'int' }]));
  r.health.parts.forEach((p) => s1.rows.push([{ v: `${p.name}: ${p.rule}`, s: 'muted' }]));
  s1.rows.push([]);
  if (r.forecast) s1.table('Прогноз до конца периода', ['Показатель', 'Сумма'], [
    ['Расходы составят примерно', r.forecast.total],
    ['Останется от полученных доходов', r.forecast.rest],
    ['Можно тратить в день', r.forecast.perDay ?? 0],
    ['Обычный расход в день (до 90 дней)', r.forecast.usual]
  ]);
  s1.table('Выводы', ['Что видно'], r.notes.map((n) => [{ v: n.text, s: 'text' }]));
  if (r.upcoming.length) s1.table('Платежи на 30 дней', ['Платёж', 'Сумма', 'Дата'], r.upcoming.map((p) => [p.name, p.amount, { v: serial(p.date), s: 'date' }]));
  book.push(s1);

  const s2 = sheet('Расходы', [34, 18, 12, 18, 12], 'Расходы', sub);
  const cats = s2.table('По категориям', ['Категория', 'Сумма', 'Доля', 'Прошлый период', 'Изменение'],
    r.cats.map((c) => [c.name, c.value, pct(c.share), c.prev ?? { v: '—', s: 'text' }, pct(c.change)]));
  closeTotal(s2, [{ v: 'Итого', s: 'bold' }, total(s2, cats, 'B', addUp(r.cats, (c) => c.value))]);
  // для круговой: шесть крупнейших и «Остальное», иначе кольцо не читается
  const ring = r.cats.length > 7 ? [...r.cats.slice(0, 6), { name: 'Остальное', value: addUp(r.cats.slice(6), (c) => c.value) }] : r.cats;
  const pie = s2.table('Для диаграммы', ['Категория', 'Сумма'], ring.map((c) => [c.name, c.value]));
  const shops = s2.table('Топ магазинов', ['Магазин', 'Сумма', 'Покупок'], r.merchants.map((m) => [m.name, m.value, { v: m.count, s: 'int' }]));
  const kind = s2.table('Характер трат', ['Вид', 'Сумма'], r.exp > 0 ? [['Обязательные', r.mand], ['Необязательные', r.opt]] : []);
  s2.table('Самые крупные траты', ['Операция', 'Сумма', 'Дата'], r.big.map((o) => [o.note || o.cat, o.part, { v: serial(dayKey(o.date)), s: 'date' }]));
  s2.chart(pie, { type: 'doughnut', title: 'Куда уходят деньги', cat: 0, series: [{ name: 'Расходы', col: 1 }] });
  s2.chart(shops, { type: 'bar', title: 'Топ магазинов', cat: 0, series: [{ name: 'Сумма', col: 1 }] });
  s2.chart(kind, { type: 'doughnut', title: 'Обязательные и необязательные', cat: 0, series: [{ name: 'Расходы', col: 1 }] }, 15);
  book.push(s2);

  const s3 = sheet('Доходы', [34, 18, 12], 'Доходы', sub);
  const src = s3.table('Источники', ['Источник', 'Сумма'], r.sources.map((x) => [x.name, x.value]));
  const ic = s3.table('По категориям', ['Категория', 'Сумма', 'Доля'], r.incCats.map((c) => [c.name, c.value, pct(c.share)]));
  closeTotal(s3, [{ v: 'Итого', s: 'bold' }, total(s3, ic, 'B', addUp(r.incCats, (c) => c.value))]);
  const im = s3.table('По месяцам', ['Месяц', 'Доход'], r.months.map((m) => [m.label, m.inc]));
  s3.chart(src, { type: 'doughnut', title: 'Источники дохода', cat: 0, series: [{ name: 'Доход', col: 1 }] });
  s3.chart(im, { type: 'column', title: 'Доход по месяцам', cat: 0, series: [{ name: 'Доход', col: 1, color: '3E9B6C' }] });
  book.push(s3);

  const s4 = sheet('Динамика', [16, 18, 18, 18], 'Динамика', sub);
  const mon = s4.table('По месяцам', ['Месяц', 'Доходы', 'Расходы', 'Остаток'], r.months.map((m) => [m.label, m.inc, m.exp, m.saldo]));
  const wk = s4.table('Средний расход по дням недели', ['День', 'Сумма'], r.weekdays.map((w) => [w.name, w.value]));
  const days = s4.table('Расходы по дням', ['Дата', 'Сумма'], r.days.map((d) => [ruDate(d.day), d.value]));
  s4.chart(mon, { type: 'column', title: 'Доходы и расходы по месяцам', cat: 0, series: [{ name: 'Доходы', col: 1, color: '3E9B6C' }, { name: 'Расходы', col: 2, color: 'C9992E' }] });
  s4.chart(days, { type: 'column', title: 'Расходы по дням', cat: 0, series: [{ name: 'Расход', col: 1 }] });
  s4.chart(wk, { type: 'column', title: 'В какие дни тратится больше', cat: 0, series: [{ name: 'В среднем', col: 1, color: '8A6212' }] }, 15);
  book.push(s4);

  const s5 = sheet('План и факт', [34, 18, 18, 18, 14], 'План и факт', sub + ' · план за все месяцы периода');
  const withPlan = r.plan.rows.filter((p) => p.plan > 0);
  const pf = s5.table('Категории с планом', ['Категория', 'План', 'Факт', 'Остаток', 'Выполнено'], withPlan.map((p) => [p.name, p.plan, p.fact, p.left, pct(p.used)]));
  if (pf.n) closeTotal(s5, [{ v: 'Итого', s: 'bold' }, total(s5, pf, 'B', r.plan.total), total(s5, pf, 'C', r.plan.fact), total(s5, pf, 'D', r2(r.plan.total - r.plan.fact))]);
  s5.table('Вне плана', ['Категория', 'Факт'], r.plan.rows.filter((p) => !p.plan).map((p) => [p.name, p.fact]));
  s5.chart(pf, { type: 'bar', title: 'План и факт', cat: 0, series: [{ name: 'План', col: 1, color: 'D8CFBD' }, { name: 'Факт', col: 2, color: 'C9992E' }] }, Math.max(16, withPlan.length * 2));
  book.push(s5);

  const a = r.accounts;
  const s6 = sheet('Счета', [34, 18, 14, 20], 'Счета и капитал', sub + ' · остатки на сегодня');
  const list = s6.table('Гривневые счета', ['Счёт', 'Остаток'], a.list.map((x) => [x.name, x.balance]));
  closeTotal(s6, [{ v: 'Итого', s: 'bold' }, total(s6, list, 'B', a.homeTotal)]);
  const money = (v) => ({ v, s: 'text' });
  if (a.foreign.length) s6.table('Валюта', ['Счёт', 'Сумма', 'Валюта', '≈ в гривнах'], a.foreign.map((x) => [x.name, money(x.balance), { v: x.currency, s: 'text' }, x.uah ?? { v: 'нет курса', s: 'text' }]));
  if (a.debts.length) s6.table('Долги', ['Долг', 'Сумма', 'Валюта', '≈ в гривнах'], a.debts.map((x) => [x.name, money(x.amount), { v: x.currency, s: 'text' }, x.uah ?? { v: 'нет курса', s: 'text' }]));
  const cap = s6.table('Гривневые счета на конец месяца', ['Месяц', 'Остаток'], r.capital.map((c) => [c.label, c.value]));
  s6.chart(list, { type: 'bar', title: 'Где лежат деньги', cat: 0, series: [{ name: 'Остаток', col: 1 }] }, Math.max(16, a.list.length * 2));
  s6.chart(cap, { type: 'line', title: 'Деньги по месяцам', cat: 0, series: [{ name: 'Остаток', col: 1 }] });
  book.push(s6);

  const rows = r.ops.map((o) => [
    { v: serial(dayKey(o.date)), s: 'date' }, TYPE[o.action] ?? o.action, { v: o.note || o.cat, s: 'text' }, o.cat, o.acc ?? '',
    o.sym === '₴' ? o.v : { v: o.v, s: 'text' }, o.sym
  ]);
  book.push({ name: 'Операции', cols: [13, 11, 44, 28, 30, 18, 9], rows: [head('Дата', 'Тип', 'Название', 'Категория', 'Счёт', 'Сумма', 'Валюта'), ...rows], freeze: 1, filter: `A1:G${rows.length + 1}` });
  return book;
}

export const reportName = (r) => `Aurum_отчёт_${r.period.label.replace(/\s*–\s*/, '-').replace(/\s+/g, '_')}.xlsx`;
export const reportFile = (r) => buildXlsx(reportSheets(r));
