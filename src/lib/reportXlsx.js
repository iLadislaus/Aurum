// Отчёт → книга Excel: оформленные листы с карточками, таблицами, шкалами и диаграммами
import { buildXlsx, canvas, serial } from './xlsx.js';
import { ruDate, dayKey, addDays, daysIn, ymOf, ymStart, ymEnd, spanLabel, FULL, WEEK } from './report.js';

const C = {
  ink: '14161C', mut: '7C8191', page: 'F3F4F7', white: 'FFFFFF', line: 'E3E5EC', rowLine: 'ECEDF2', zebra: 'F8F9FB',
  dark: '12141A', head: '1F2330', gold: 'C99A2E', goldD: 'B8862B', goldL: 'F0CE7A', cream: 'FBF3DF',
  green: '1E8E5A', red: 'C8372D', amber: 'D98A00', blue: '3E7CB1', navy: '1F2A44', track: 'E9EAEF', grey: 'D5D8E0'
};
const PAL = ['C99A2E', '1F2A44', '3E7CB1', '1E8E5A', '8E5BA8', 'D9663B', '4FA6A0', 'B23A5E', '7C8191', 'A8B545', '5C6BC0', 'C7B299'];
const REST = 'C9CCD6';
const PILL = { g: ['DDF3E7', '146B43'], r: ['FBE2E0', 'A52A22'], a: ['FCEFD3', '9A6200'], n: ['E9EAF0', '555B6B'], b: ['DFEBF7', '255A88'] };
const TONE = { good: C.green, bad: C.red, warn: C.amber, info: C.blue };
const MONEY = '#,##0\\ "₴";−#,##0\\ "₴";0\\ "₴"';
const SIGNED = '+#,##0\\ "₴";−#,##0\\ "₴";0\\ "₴"';
const OUT = '−#,##0\\ "₴"';

const r2 = (v) => Math.round(v * 100) / 100;
const addUp = (l, f) => r2(l.reduce((x, y) => x + f(y), 0));
const num = (v) => Math.round(v).toLocaleString('ru-RU');
const money = (v) => `${v < -0.5 ? '−' : ''}${num(Math.abs(v))} ₴`;
const signed = (v) => `${v > 0.5 ? '+' : ''}${money(v)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

// ---------- лист: сетка из 60 узких колонок, поля по краям ----------
const UNIT = 22, GRID = 60, WIDTH = GRID + 2;
const TABLE_ROW = 26;

function sheet(name, title, r, head) {
  const s = canvas(name, [18, ...Array(GRID).fill(UNIT), 18], C.page);
  s.height(0, 10); s.height(1, 32); s.height(2, 20); s.height(3, 10); s.height(4, 4); s.height(5, 14);
  s.paint(0, 0, WIDTH, 4, { fill: C.dark });
  s.paint(0, 4, WIDTH, 1, { fill: C.gold });
  s.put(1, 1, 2, 'Au', { fill: C.gold, color: C.dark, b: true, sz: 15, align: 'center' }, 2);
  s.put(4, 1, 34, title, { color: C.white, b: true, sz: 18 });
  s.put(4, 2, 34, `Aurum · финансовый отчёт · сформирован ${ruDate(r.today)} · суммы в гривнах`, { color: '9BA0B0', sz: 9 });
  s.put(39, 1, 22, head.period, { color: C.goldL, b: true, sz: 14, align: 'right' });
  s.put(39, 2, 22, head.compare, { color: '9BA0B0', sz: 9, align: 'right' });
  s.y = 6;
  return s;
}
const gap = (s) => { s.height(s.y, 14); s.y++; };

// шкала: подложка, заполнение и подпись поверх
function bar(s, c, r, w, share, color, label) {
  const px = w * UNIT - 16, h = Math.min(15, s.h(r) - 6), top = (s.h(r) - h) / 2, f = Math.max(0, Math.min(1, share || 0));
  const at = (x, dy) => [c, r, 8 + x, dy];
  s.shape(at(0, top), at(px, top + h), { color: C.track });
  if (f > 0.004) s.shape(at(0, top), at(Math.max(2, px * f), top + h), { color, grad: true });
  if (label) s.shape(at(0, top), at(px, top + h), { align: 'r', lines: [{ text: label, b: true, sz: 750, color: f > 0.93 ? C.white : C.ink }] });
}

// белый блок с заголовком; возвращает первую строку под заголовком
function box(s, c, r, w, h, title, hint) {
  s.paint(c, r, w, h, { fill: C.white });
  s.height(r, 32);
  s.put(c, r, hint ? w - Math.ceil(w * 0.45) : w, title, { b: true, sz: 11, indent: 1, bb: [C.line], bl: [C.gold, 'thick'] });
  if (hint) s.put(c + w - Math.ceil(w * 0.45), r, Math.ceil(w * 0.45), hint, { color: C.mut, sz: 8, align: 'right', indent: 1, bb: [C.line] });
  return r + 1;
}

// карточки показателей в один ряд
function kpis(s, cards) {
  const y = s.y, free = GRID - (cards.length - 1), base = Math.floor(free / cards.length);
  let c = 1;
  s.height(y, 24); s.height(y + 1, 36); s.height(y + 2, 26); s.height(y + 3, 4);
  cards.forEach((k, i) => {
    const w = base + (i < free % cards.length ? 1 : 0);
    s.paint(c, y, w, 4, { fill: C.white });
    s.put(c, y, w, k.label.toUpperCase(), { color: C.mut, b: true, sz: 8, indent: 1, bt: [k.color, 'thick'] });
    s.put(c, y + 1, w, k.value, { b: true, sz: 19, indent: 1, color: k.valueColor ?? C.ink, shrink: true });
    let x = c, left = w;
    if (k.pill) { const [t, tone] = k.pill, pw = Math.min(w - 1, Math.max(3, Math.ceil((t.length * 6.8 + 24) / UNIT))); s.shape([c, y + 2, 9, 4], [c, y + 2, pw * UNIT - 4, 22], { color: PILL[tone][0], lines: [{ text: t, b: true, sz: 800, color: PILL[tone][1] }] }); x = c + pw; left = w - pw; }
    if (k.bar != null) { bar(s, c, y + 2, 4, k.bar, k.color); x = c + 4; left = w - 4; }
    if (k.note) s.put(x, y + 2, left, k.note, { color: C.mut, sz: 8, indent: 1, shrink: true });
    c += w + 1;
  });
  s.y = y + 4;
  gap(s);
}

// таблица внутри блока: колонки [заголовок, ширина, выравнивание], ячейки — значения или { v, bar, pill, ...стиль }
function table(s, c, r, title, hint, cols, rows, total, minRows = 0) {
  const w = cols.reduce((a, x) => a + x[1], 0), count = Math.max(rows.length || 1, minRows);
  let y = box(s, c, r, w, 2 + count + (total ? 1 : 0), title, hint);
  const line = (yy, values, kind, odd) => {
    s.height(yy, kind === 'head' ? 24 : TABLE_ROW);
    let x = c;
    cols.forEach(([, span, align], i) => {
      const o = values[i] != null && typeof values[i] === 'object' ? values[i] : { v: values[i] };
      const { v, bar: b, pill, ...st } = o;
      const base = kind === 'head' ? { fill: C.head, color: C.goldL, b: true, sz: 8 }
        : kind === 'total' ? { fill: C.cream, b: true, bt: [C.gold, 'medium'] }
          : { fill: odd ? C.white : C.zebra, bb: [C.rowLine] };
      const look = { ...base, align: align === 'num' ? 'right' : align === 'cen' ? 'center' : 'left', indent: align === 'cen' ? 0 : 1, ...st };
      if (pill) {
        s.paint(x, yy, span, 1, look);
        s.put(x + 1, yy, span - 2, v, { fill: PILL[pill][0], color: PILL[pill][1], b: true, sz: 8, align: 'center', indent: 0, bt: [odd ? C.white : C.zebra, 'medium'], bb: [odd ? C.white : C.zebra, 'medium'] });
      } else s.put(x, yy, span, b ? null : v, look);
      if (b) bar(s, x, yy, span, b[0], b[1], b[2]);
      x += span;
    });
  };
  line(y++, cols.map((x) => x[0]), 'head');
  if (!rows.length) { s.height(y, TABLE_ROW); s.put(c, y, w, 'Нет данных', { color: C.mut, indent: 1 }); }
  rows.forEach((row, i) => line(y + i, row, 'row', i % 2 === 0));
  y += rows.length || 1;
  if (total) line(y++, total, 'total');
  for (let i = rows.length || 1; i < count; i++) s.height(y++, TABLE_ROW);
  return y;
}

// кольцо с суммой в центре и подписями справа
function donut(s, c, r, w, title, items, caption) {
  const side = 11, h = 14;
  const y = box(s, c, r, w, h, title);
  if (!items.length) { s.put(c, y + 1, w, 'Нет данных', { color: C.mut, indent: 1 }); return r + h; }
  const total = addUp(items, (i) => i.value);
  s.chart(c + 1, y + 1, side, side, { type: 'doughnut', cats: items.map((i) => i.name), series: [{ name: caption, values: items.map((i) => i.value), colors: items.map((i) => i.color) }] });
  const mid = y + 1 + side / 2;
  s.shape([c + 3, Math.floor(mid) - 1, 0, 0], [c + 1 + side - 2, Math.floor(mid) + 1, 0, 0], { lines: [{ text: num(total), b: true, sz: 1500 }, { text: caption, sz: 800, color: C.mut }] });
  const lx = c + side + 2, lw = w - side - 3;
  let ly = y + 1 + Math.max(0, Math.floor((side - items.length) / 2));
  for (const i of items) {
    s.put(lx, ly, 1, '■', { color: i.color, sz: 11, align: 'center', bb: [C.rowLine] });
    s.put(lx + 1, ly, lw - 4, i.name, { sz: 9, bb: [C.rowLine], shrink: true });
    s.put(lx + lw - 3, ly, 3, total ? i.value / total : 0, { sz: 9, b: true, align: 'right', fmt: '0%', bb: [C.rowLine] });
    ly++;
  }
  return r + h;
}

// диаграмма в белом блоке
function graph(s, c, r, w, h, title, hint, chart) {
  const y = box(s, c, r, w, h, title, hint);
  if (chart.cats.length && chart.series.length) s.chart(c, y, w, h - 1, chart);
  else s.put(c, y + 1, w, 'Нет данных', { color: C.mut, indent: 1 });
  return r + h;
}

// изменение к прошлому периоду: расти хорошо для доходов и плохо для расходов
function change(now, was, goodUp) {
  if (was == null) return null;
  if (!was) return now ? ['новое', 'n'] : ['0%', 'n'];
  const p = Math.round(((now - was) / Math.abs(was)) * 100);
  return p === 0 ? ['0%', 'n'] : [`${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`, (p > 0) === goodUp ? 'g' : 'r'];
}
const chgCell = (x) => (x ? { v: x[0], pill: x[1] } : '—');
const delta = (v, goodUp) => ({ v: r2(v), fmt: SIGNED, color: v === 0 || (v > 0) === goodUp ? C.green : C.red });

function ring(list, colors, keep) {
  const items = list.filter((x) => x.value > 0).map((x, i) => ({ name: x.name, value: x.value, color: colors[i % colors.length] }));
  if (items.length <= keep + 1) return items;
  return [...items.slice(0, keep), { name: 'Остальное', value: addUp(items.slice(keep), (x) => x.value), color: REST }];
}

export function reportSheets(r) {
  const today = r.today;
  const from = r.period.from > r.first ? r.period.from : r.first, to = r.period.to < today ? r.period.to : today;
  const head = {
    period: to < from ? r.period.label : cap(spanLabel(from, to, today).replace(/^за /, '')) + (from.slice(0, 4) === today.slice(0, 4) && !/\d{4}/.test(spanLabel(from, to, today)) ? ` ${from.slice(0, 4)}` : ''),
    compare: r.prevLabel ? `сравнение ${r.prevLabel.replace(/^за /, 'с периодом: ')}` : r.partial ? `данные с ${ruDate(r.first)}` : 'сравнивать не с чем: нет прошлых данных'
  };
  const was = r.prevLabel ? cap(r.prevLabel.replace(/^за /, '')) : 'Прошлый';
  const prevNote = (v) => (r.prev ? `было ${v}` : 'нет прошлого периода');
  const a = r.accounts;
  const savUah = r.savings?.uah ?? (r.savings ? null : 0);
  const net = savUah != null && a.debtKnown !== false ? r2(a.homeTotal + savUah - a.debtUah) : null;
  const capital = r.capital;
  const monthStar = (m, i) => (i === r.months.length - 1 && m.ym === ymOf(today) ? `${m.label}*` : m.label);
  const starHint = r.months.at(-1)?.ym === ymOf(today) ? `* по ${ruDate(today).slice(0, 5)}` : '';
  const book = [];
  const withNet = a.debtUah != null && net != null;

  // ===== Сводка =====
  const s1 = sheet('Сводка', 'Финансовый отчёт', r, head);
  const planPct = r.plan.any && r.plan.total > 0 ? r.plan.fact / r.plan.total : null;
  kpis(s1, [
    { label: 'Доходы', value: money(r.inc), color: C.green, pill: change(r.inc, r.prev?.inc, true), note: prevNote(money(r.prev?.inc ?? 0)) },
    { label: 'Расходы', value: money(r.exp), color: C.red, pill: change(r.exp, r.prev?.exp, false), note: prevNote(money(r.prev?.exp ?? 0)) },
    { label: 'Остаток', value: signed(r.saldo), valueColor: r.saldo >= 0 ? C.green : C.red, color: C.goldD, pill: change(r.saldo, r.prev?.saldo, true), note: prevNote(signed(r.prev?.saldo ?? 0)) },
    { label: 'Доля сбережений', value: r.rate == null ? '—' : `${r.rate}%`, color: r.rate >= 20 ? C.green : C.amber, bar: r.rate == null ? null : r.rate / 100, note: r.rate == null ? 'нет доходов' : r.rate >= 20 ? 'цель 20% выполнена' : 'цель 20%' },
    planPct != null
      ? { label: 'План расходов', value: `${Math.round(planPct * 100)}%`, color: planPct > 1 ? C.red : C.amber, bar: planPct, note: r.plan.total >= r.plan.fact ? `осталось ${money(r.plan.total - r.plan.fact)}` : `сверх на ${money(r.plan.fact - r.plan.total)}` }
      : { label: 'Расход в день', value: money(r.avgDay), color: C.goldD, note: 'плана на период нет' }
  ]);
  const top = s1.y;
  donut(s1, 1, top, 25, 'Куда ушли деньги', ring(r.cats, PAL, 6), 'расходы, ₴');
  s1.y = graph(s1, 27, top, 34, 14, 'Доходы и расходы по месяцам', starHint, {
    type: 'column', cats: r.months.map(monthStar), labels: r.months.length <= 6,
    series: [{ name: 'Доходы', values: r.months.map((m) => m.inc), color: C.green }, { name: 'Расходы', values: r.months.map((m) => m.exp), color: C.goldD }]
  });
  gap(s1);
  const low = s1.y;
  // здоровье
  const hr = Math.max(7, r.notes.length);
  for (let i = 1; i <= hr + 1; i++) s1.height(low + i, TABLE_ROW);
  let y = box(s1, 1, low, 20, hr + 2, 'Финансовое здоровье');
  if (r.health.score != null) {
    const tone = r.health.score >= 70 ? C.green : r.health.score >= 45 ? C.amber : C.red;
    s1.put(1, y, 6, r.health.score, { b: true, sz: 36, color: tone, align: 'center', valign: 'bottom' }, 4);
    s1.put(1, y + 4, 6, 'из 100', { color: C.mut, sz: 9, align: 'center', valign: 'top' });
    r.health.parts.forEach((p, i) => {
      s1.put(7, y + i * 2, 8, p.name, { sz: 9, valign: 'bottom' });
      s1.put(15, y + i * 2, 6, p.text, { sz: 9, color: C.mut, align: 'right', indent: 1, valign: 'bottom', shrink: true });
      bar(s1, 7, y + i * 2 + 1, 14, p.got / p.max, p.got / p.max >= 0.7 ? C.green : p.got / p.max >= 0.4 ? C.amber : C.red, `${p.got} / ${p.max}`);
    });
  }
  // выводы
  y = box(s1, 22, low, 23, hr + 2, 'Выводы');
  r.notes.forEach((n, i) => s1.put(22, y + i, 23, n.text, { sz: 9, indent: 1, bl: [TONE[n.tone] ?? C.blue, 'thick'], bb: [C.rowLine], shrink: true }));
  // деньги сейчас
  const now = [['Гривневые счета', { v: a.homeTotal, fmt: MONEY }]];
  if (r.savings) now.push(['Валюта ≈', savUah == null ? 'нет курса' : { v: savUah, fmt: MONEY }]);
  if (a.debts.length) now.push(['Долги ≈', a.debtUah == null || a.debtKnown === false ? 'нет курса' : { v: a.debtUah, fmt: OUT, color: C.red }]);
  if (r.paid) now.push(['Погашено долгов за период', { v: r.paid, fmt: MONEY }]);
  if (r.taken) now.push(['Взято в долг за период', { v: r.taken, fmt: MONEY }]);
  table(s1, 46, low, 'Деньги сейчас', '', [['Где', 8, ''], ['Сумма', 7, 'num']], now, withNet ? ['Чистый капитал ≈', { v: net, fmt: MONEY }] : null, hr - (withNet ? 1 : 0));
  s1.y = low + hr + 2;
  gap(s1);
  for (const p of r.health.parts) { s1.put(1, s1.y, GRID, `${p.name}: ${p.rule}`, { color: C.mut, sz: 8 }); s1.y++; }
  book.push(s1);

  // ===== Расходы =====
  const s2 = sheet('Расходы', 'Расходы', r, head);
  const share = (v) => (r.exp > 0 ? Math.round((v / r.exp) * 100) : 0);
  kpis(s2, [
    { label: 'Всего расходов', value: money(r.exp), color: C.red, pill: change(r.exp, r.prev?.exp, false), note: r.prev ? 'к прошлому периоду' : '' },
    { label: 'В среднем в день', value: money(r.avgDay), color: C.goldD, note: `за ${r.days.length} ${plural(r.days.length, 'день', 'дня', 'дней')}` },
    { label: 'Обязательные', value: money(r.mand), color: C.navy, bar: share(r.mand) / 100, note: `${share(r.mand)}% расходов` },
    { label: 'Необязательные', value: money(r.opt), color: C.amber, bar: share(r.opt) / 100, note: `${share(r.opt)}% расходов` }
  ]);
  const max = Math.max(1, ...r.cats.map((c) => c.value));
  const catRows = [...r.cats.map((c, i) => ({ ...c, color: PAL[i % PAL.length], count: c.ops.length })), ...r.gone.map((g, i) => ({ ...g, value: 0, share: 0, count: 0, color: PAL[(r.cats.length + i) % PAL.length] }))];
  s2.y = table(s2, 1, s2.y, 'Категории', r.prevLabel ? `${head.period} против: ${was.toLowerCase()}` : '', [['', 1, 'cen'], ['Категория', 11, ''], ['Сумма', 7, 'num'], ['Доля', 17, ''], ['Опер.', 4, 'num'], [was, 7, 'num'], ['Разница', 7, 'num'], ['Изменение', 6, 'cen']],
    catRows.map((c) => [{ v: '■', color: c.color, sz: 11 }, c.name, { v: c.value, fmt: MONEY, b: true }, { bar: [c.value / max, c.color, `${c.share ?? 0}%`] }, c.count,
      r.prev ? { v: c.prev, fmt: MONEY } : '—', r.prev ? delta(c.value - c.prev, false) : '—', chgCell(r.prev ? change(c.value, c.prev, false) : null)]),
    catRows.length ? ['', 'Итого', { v: r.exp, fmt: MONEY }, '', addUp(catRows, (c) => c.count), r.prev ? { v: r.prev.exp, fmt: MONEY } : '—', r.prev ? delta(r.exp - r.prev.exp, false) : '—', chgCell(change(r.exp, r.prev?.exp, false))] : null);
  gap(s2);
  const mid = s2.y, mm = Math.max(1, ...r.merchants.map((m) => m.value)), rowsN = Math.max(r.merchants.length, r.top.length);
  const e1 = table(s2, 1, mid, 'Топ магазинов', '', [['#', 2, 'cen'], ['Магазин', 10, ''], ['Сумма', 6, 'num'], ['Покупок', 4, 'num'], ['', 7, '']],
    r.merchants.map((m, i) => [{ v: i + 1, b: true, color: i < 3 ? C.goldD : C.mut }, m.name, { v: m.value, fmt: MONEY }, m.count, { bar: [m.value / mm, C.goldD] }]), null, rowsN);
  const e2 = table(s2, 31, mid, 'Самые крупные траты', 'с учётом возвратов', [['Дата', 5, ''], ['Операция', 11, ''], ['Категория', 8, ''], ['Сумма', 6, 'num']],
    r.top.map((o) => [ruDate(dayKey(o.date)).slice(0, 5), o.note || o.cat, o.cat, { v: o.part, fmt: OUT, color: C.red }]), null, rowsN);
  s2.y = Math.max(e1, e2);
  book.push(s2);

  // ===== Доходы =====
  const s3 = sheet('Доходы', 'Доходы', r, head);
  const incColors = [C.green, '7FC29B', C.blue, C.goldD, '8E5BA8', 'D9663B'];
  const incShare = (v) => (r.inc > 0 ? `${Math.round((v / r.inc) * 100)}% дохода` : '');
  const lead = r.incCats.slice(0, 2), rest = addUp(r.incCats.slice(2), (c) => c.value);
  kpis(s3, [
    { label: 'Всего доходов', value: money(r.inc), color: C.green, pill: change(r.inc, r.prev?.inc, true), note: r.prev ? 'к прошлому периоду' : '' },
    ...[0, 1].map((i) => ({ label: lead[i]?.name ?? 'Источник', value: lead[i] ? money(lead[i].value) : '—', color: incColors[i * 2], note: lead[i] ? incShare(lead[i].value) : '' })),
    { label: 'Остальные источники', value: money(rest), color: C.goldD, note: incShare(rest) }
  ]);
  const known = r.incCats.map((c) => c.name);
  const spare = incColors.slice(Math.min(known.length, incColors.length));
  const incColor = (name, i) => incColors[known.indexOf(name)] ?? spare[i % Math.max(1, spare.length)] ?? 'A8B545';
  const iTop = s3.y, iRows = Math.max(11, r.incCats.length);
  donut(s3, 1, iTop, 25, 'Откуда пришли деньги', ring(r.incCats, incColors, 5), 'доходы, ₴');
  const iEnd = table(s3, 27, iTop, 'Источники', '', [['', 1, 'cen'], ['Категория', 10, ''], ['Сумма', 8, 'num'], ['Доля', 15, '']],
    r.incCats.map((c, i) => [{ v: '■', color: incColors[i] ?? REST, sz: 11 }, c.name, { v: c.value, fmt: SIGNED, color: C.green, b: true }, { bar: [(c.share ?? 0) / 100, incColors[i] ?? REST, `${c.share ?? 0}%`] }]),
    r.incCats.length ? ['', 'Итого', { v: r.inc, fmt: MONEY }, ''] : null, r.incCats.length ? 0 : 1);
  s3.y = Math.max(iTop + 14, iEnd, iTop + Math.min(iRows, 11));
  gap(s3);
  s3.y = graph(s3, 1, s3.y, GRID, 15, 'Доходы по месяцам', starHint, {
    type: 'column', cats: r.months.map(monthStar), labels: r.months.length <= 6, gap: 60,
    series: r.incMonths.map((x, i) => ({ name: x.name, values: x.values, color: x.name === 'Прочее' ? REST : incColor(x.name, i) }))
  });
  gap(s3);
  s3.y = table(s3, 1, s3.y, 'Поступления за период', '', [['Дата', 6, ''], ['От кого / что', 28, ''], ['Категория', 16, ''], ['Сумма', 10, 'num']],
    r.incOps.map((o) => [ruDate(o.day).slice(0, 5), o.note || '—', o.cat, { v: o.amount, fmt: SIGNED, color: C.green, b: true }]), null);
  book.push(s3);

  // ===== Динамика =====
  const s4 = sheet('Динамика', 'Динамика', r, head);
  const avg = r.avgDay, below = r.days.filter((d) => d.value < avg).length, zero = r.days.filter((d) => d.value <= 0).length;
  const tone = (v) => (v > avg * 2 ? C.red : v > avg ? C.amber : C.green);
  const wdName = (k) => ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][new Date(k + 'T00:00:00Z').getUTCDay()];
  kpis(s4, [
    { label: 'Среднее в день', value: money(avg), color: C.goldD, note: `${r.days.length} ${plural(r.days.length, 'день', 'дня', 'дней')}` },
    { label: 'Самый дорогой день', value: r.topDay ? money(r.topDay.value) : '—', color: C.red, note: r.topDay ? `${wdName(r.topDay.day)}, ${ruDate(r.topDay.day).slice(0, 5)}` : '' },
    { label: 'Дней дешевле среднего', value: `${below} из ${r.days.length}`, color: C.green, pill: ['спокойные дни', 'g'] },
    { label: 'Дней без трат', value: String(zero), color: C.blue, note: to === today ? 'включая сегодня' : '' }
  ]);
  s4.y = graph(s4, 1, s4.y, GRID, 15, 'Расходы по дням', 'зелёный — ниже среднего, оранжевый — выше, красный — вдвое', {
    type: 'column', cats: r.days.map((d) => (r.days.length <= 31 ? d.day.slice(8) : ruDate(d.day).slice(0, 5))), labels: r.days.length <= 31, gap: 40,
    series: [{ name: 'Расход', values: r.days.map((d) => Math.max(0, Math.round(d.value))), color: C.goldD, colors: r.days.map((d) => tone(d.value)) }]
  });
  gap(s4);
  const dTop = s4.y, wMax = Math.max(...r.weekdays.map((w) => w.value)), dH = Math.max(12, r.months.length + 3);
  const g1 = graph(s4, 1, dTop, 25, dH, 'В какие дни тратится больше', 'средний расход', {
    type: 'column', cats: WEEK, labels: true,
    series: [{ name: 'В среднем', values: r.weekdays.map((w) => Math.round(w.value)), color: C.goldD, colors: r.weekdays.map((w) => (w.value === wMax && wMax > 0 ? C.red : C.goldD)) }]
  });
  const g2 = table(s4, 27, dTop, 'По месяцам', starHint, [['Месяц', 5, ''], ['Доходы', 7, 'num'], ['Расходы', 7, 'num'], ['Остаток', 7, 'num'], ['Расходы / доходы', 8, '']],
    r.months.map((m, i) => [monthStar(m, i), { v: m.inc, fmt: MONEY }, { v: m.exp, fmt: MONEY }, { ...delta(m.saldo, true), b: true }, m.inc > 0 ? { bar: [m.exp / m.inc, m.exp > m.inc ? C.red : C.green, `${Math.round((m.exp / m.inc) * 100)}%`] } : '—']),
    ['Всего', { v: addUp(r.months, (m) => m.inc), fmt: MONEY }, { v: addUp(r.months, (m) => m.exp), fmt: MONEY }, delta(addUp(r.months, (m) => m.saldo), true), '']);
  s4.y = Math.max(g1, g2);
  // календарь расходов: для периодов до трёх месяцев
  const first = ymOf(r.period.from), last = ymOf(r.period.to);
  if (r.days.length && daysIn(r.period.from, r.period.to) <= 93) {
    const byDay = new Map(r.days.map((d) => [d.day, d.value]));
    const dear = Math.max(1, [...r.days.map((d) => d.value)].sort((x, y) => x - y)[Math.floor((r.days.length - 1) * 0.9)]);
    const mix = (t) => [[255, 200], [255, 55], [255, 45]].map(([a0, b0]) => Math.round(a0 + (b0 - a0) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
    for (let v = first; v <= last; v++) {
      const start = ymStart(v) > r.period.from ? ymStart(v) : r.period.from, end = ymEnd(v) < r.period.to ? ymEnd(v) : r.period.to;
      if (end < from || start > to) continue;
      gap(s4);
      const offset = (new Date(start + 'T00:00:00Z').getUTCDay() + 6) % 7, n = daysIn(start, end), weeks = Math.ceil((offset + n) / 7);
      const yy = box(s4, 1, s4.y, GRID, weeks + 3, `Календарь расходов: ${FULL[v % 12].toLowerCase()}`, 'чем краснее, тем дороже день');
      s4.height(yy, 22);
      WEEK.forEach((w, i) => s4.put(2 + i * 8 + 1, yy, 8, w, { color: C.mut, b: true, sz: 8, align: 'center' }));
      for (let i = 0; i < n; i++) {
        const day = addDays(start, i), pos = offset + i, row = yy + 1 + Math.floor(pos / 7), x = 3 + (pos % 7) * 8, val = byDay.get(day);
        s4.height(row, 28);
        const edge = { bt: [C.white, 'medium'], bb: [C.white, 'medium'] };
        if (val == null) { s4.put(x, row, 8, Number(day.slice(8)), { color: 'B0B4C0', sz: 8, indent: 1, bl: [C.grey], br: [C.grey], bt: [C.grey], bb: [C.grey] }); continue; }
        const t = Math.min(1, Math.max(0, val) / dear), color = mix(0.06 + t * 0.84), ink = t > 0.6 ? C.white : C.ink;
        s4.put(x, row, 2, Number(day.slice(8)), { fill: color, color: ink, sz: 8, indent: 1, bl: [C.white, 'thick'], ...edge });
        s4.put(x + 2, row, 6, Math.round(val), { fill: color, color: ink, b: true, sz: 9, align: 'right', indent: 1, fmt: '#,##0', br: [C.white, 'thick'], ...edge });
      }
      s4.height(yy + weeks + 1, 10);
      s4.y += weeks + 3;
    }
  }
  book.push(s4);

  // ===== План и факт =====
  const s5 = sheet('План и факт', 'План и факт', r, head);
  const planned = r.plan.rows.filter((p) => p.plan > 0).sort((x, y2) => y2.fact / y2.plan - x.fact / x.plan);
  const over = planned.filter((p) => p.left < -0.5);
  const passed = r.period.kind === 'm' && today >= r.period.from && today <= r.period.to ? Math.round((Number(today.slice(8)) / daysIn(r.period.from, r.period.to)) * 100) : null;
  kpis(s5, [
    { label: 'План на период', value: money(r.plan.total), color: C.navy, note: `${planned.length} ${plural(planned.length, 'категория', 'категории', 'категорий')}` },
    { label: 'Потрачено по плану', value: money(r.plan.fact), color: C.amber, bar: planPct, note: planPct == null ? 'плана нет' : `${Math.round(planPct * 100)}% плана${passed != null ? `, прошло ${passed}% месяца` : ''}` },
    { label: 'Сэкономлено', value: money(r.plan.saved), valueColor: C.green, color: C.green, pill: ['остаток по категориям', 'g'] },
    { label: 'Перерасход', value: money(r.plan.over), valueColor: r.plan.over ? C.red : C.ink, color: C.red, pill: over.length ? [`${over.length} ${plural(over.length, 'категория', 'категории', 'категорий')}`, 'r'] : ['нет', 'g'] }
  ]);
  const status = (p) => { const u = p.fact / p.plan; return u > 1.005 ? ['Перерасход', 'r', C.red] : u >= 0.995 ? ['Выполнен', 'b', C.blue] : u >= 0.8 ? ['Впритык', 'a', C.amber] : ['В норме', 'g', C.green]; };
  const planRows = planned.map((p) => { const [t, pill, color] = status(p); return [p.name, { v: p.plan, fmt: MONEY }, { v: p.fact, fmt: MONEY, b: true }, delta(p.left, true), { bar: [p.fact / p.plan, color, `${Math.round((p.fact / p.plan) * 100)}%`] }, { v: t, pill }]; });
  const offRows = r.plan.rows.filter((p) => !p.plan).map((p) => [p.name, '—', { v: p.fact, fmt: MONEY, b: true }, '—', '', { v: 'Вне плана', pill: 'n' }]);
  s5.y = table(s5, 1, s5.y, 'Выполнение плана по категориям', 'сначала самые напряжённые', [['Категория', 12, ''], ['План', 7, 'num'], ['Факт', 7, 'num'], ['Остаток', 7, 'num'], ['Шкала выполнения', 20, ''], ['Статус', 7, 'cen']],
    [...planRows, ...offRows], planned.length ? ['Итого', { v: r.plan.total, fmt: MONEY }, { v: r2(r.plan.fact + r.plan.off), fmt: MONEY }, delta(r2(r.plan.total - r.plan.fact), true), { bar: [planPct, C.amber, `${Math.round(planPct * 100)}% плана`] }, ''] : null);
  const big8 = [...planned].sort((x, y2) => y2.plan - x.plan).slice(0, 8);
  if (big8.length) {
    gap(s5);
    s5.y = graph(s5, 1, s5.y, GRID, 15, 'План против факта', 'крупнейшие категории', {
      type: 'column', cats: big8.map((p) => p.name), labels: true,
      series: [{ name: 'План', values: big8.map((p) => Math.round(p.plan)), color: C.grey }, { name: 'Факт', values: big8.map((p) => Math.round(p.fact)), color: C.goldD }]
    });
  }
  book.push(s5);

  // ===== Счета =====
  const s6 = sheet('Счета', 'Счета и капитал', r, { period: `на ${ruDate(today)}`, compare: 'остатки на сегодня' });
  const moved = capital.length > 1 && r.months.at(-1)?.ym === ymOf(today) ? r2(capital.at(-1).value - capital.at(-2).value) : null;
  const sym = (c) => ({ USD: '$', EUR: '€', UAH: '₴' })[c] ?? c;
  const assets = a.homeTotal + (savUah ?? 0);
  kpis(s6, [
    { label: 'Гривневые счета', value: money(a.homeTotal), color: C.goldD, pill: moved == null ? null : [`${moved >= 0 ? '▲ +' : '▼ −'}${num(Math.abs(moved))} за месяц`, moved >= 0 ? 'g' : 'r'] },
    { label: 'Валюта ≈', value: savUah == null ? 'нет курса' : money(savUah), color: C.green, note: r.savings ? r.savings.byCurrency.map((x) => `${num(x.balance)} ${sym(x.currency)}`).join(' · ') : 'валютных счетов нет' },
    { label: 'Долги ≈', value: !a.debts.length ? 'нет' : a.debtKnown === false ? 'нет курса' : money(-a.debtUah), valueColor: a.debts.length ? C.red : C.green, color: C.red, note: a.debts.map((x) => `${num(x.amount)} ${sym(x.currency)}`).join(' · ') },
    { label: 'Чистый капитал ≈', value: withNet ? money(net) : '—', color: C.navy, bar: savUah != null && assets > 0 ? savUah / assets : null, note: savUah != null && assets > 0 ? `валюта ${Math.round(Math.max(0, Math.min(1, savUah / assets)) * 100)}% активов` : '' }
  ]);
  const aTop = s6.y;
  const hMax = Math.max(1, ...a.list.map((x) => Math.abs(x.balance))), pos = addUp(a.list.filter((x) => x.balance > 0), (x) => x.balance);
  const h1 = table(s6, 1, aTop, 'Гривневые счета', '', [['Счёт', 10, ''], ['Остаток', 7, 'num'], ['Доля', 12, '']],
    a.list.map((x) => [x.name, { v: x.balance, fmt: MONEY, b: true, color: x.balance < 0 ? C.red : C.ink }, { bar: [Math.abs(x.balance) / hMax, x.balance < 0 ? C.red : C.goldD, x.balance > 0 && pos ? `${Math.round((x.balance / pos) * 100)}%` : ''] }]),
    ['Итого', { v: a.homeTotal, fmt: MONEY }, '']);
  const fxCols = [['Счёт', 9, ''], ['Валюта', 5, 'cen'], ['Сумма', 7, 'num'], ['≈ в гривнах', 9, 'num']];
  const fxRow = (x, amount, debt) => [x.name, { v: x.currency, pill: x.currency === 'USD' ? 'g' : x.currency === 'EUR' ? 'b' : 'n' }, { v: debt ? -amount : amount, fmt: `#,##0\\ "${sym(x.currency)}";−#,##0\\ "${sym(x.currency)}"`, color: debt ? C.red : C.ink }, x.uah == null ? 'нет курса' : { v: debt ? -x.uah : x.uah, fmt: MONEY, color: debt ? C.red : C.ink }];
  let right = aTop;
  if (a.foreign.length) { right = table(s6, 31, right, 'Валютные сбережения', '', fxCols, a.foreign.map((x) => fxRow(x, x.balance)), savUah == null ? null : ['Итого', '', '', { v: savUah, fmt: MONEY }]); right++; }
  if (a.debts.length) right = table(s6, 31, right, 'Долги', '', [['Кому', 9, ''], ...fxCols.slice(1)], a.debts.map((x) => fxRow(x, x.amount, true)));
  s6.y = Math.max(h1, right);
  gap(s6);
  const cTop = s6.y, cH = Math.max(15, r.upcoming.length + 3);
  const c1 = graph(s6, 1, cTop, 31, cH, 'Гривневые деньги на конец месяца', r.months.at(-1)?.ym === ymOf(today) ? 'последний месяц — на сегодня' : '', {
    type: 'line', cats: capital.map((c) => c.label), labels: capital.length <= 12,
    series: [{ name: 'Остаток', values: capital.map((c) => Math.round(c.value)), color: C.goldD, colors: capital.map((c) => (c.value < 0 ? C.red : C.goldD)) }]
  });
  const c2 = table(s6, 33, cTop, 'Платежи на 30 дней', '', [['Дата', 5, ''], ['Платёж', 15, ''], ['Сумма', 8, 'num']],
    r.upcoming.map((p) => [ruDate(p.date).slice(0, 5), p.name.replace(/\s+/g, ' '), { v: p.amount, fmt: MONEY }]),
    r.upcoming.length ? ['', 'Всего', { v: addUp(r.upcoming, (p) => p.amount), fmt: MONEY }] : null, r.upcoming.length ? 0 : cH - 2);
  s6.y = Math.max(c1, c2);
  book.push(s6);

  // нижнее поле каждого листа
  for (const s of book) { s.height(s.y, 16); s.paint(0, s.y, WIDTH, 1, { fill: C.page }); }
  for (const s of book) s.onePage = s.y <= 75;
  book.push(journal(r, head));
  return book;
}

// ===== Операции: обычные колонки, чтобы работали фильтры и сортировка =====
const KIND = { EXPENSE: ['Расход', 'r'], INCOME: ['Доход', 'g'], RETURN: ['Возврат', 'b'], TRANSFER: ['Перевод', 'n'] };
function journal(r, head) {
  const cols = [['Дата', 96], ['Тип', 92], ['Название', 300], ['Категория', 180], ['Счёт', 290], ['Сумма', 140], ['Примечание', 290]];
  const s = canvas('Операции', [18, ...cols.map((c) => c[1]), 18], C.page);
  const W = cols.length + 2;
  s.height(0, 10); s.height(1, 32); s.height(2, 20); s.height(3, 10); s.height(4, 4); s.height(5, 14);
  s.paint(0, 0, W, 4, { fill: C.dark });
  s.paint(0, 4, W, 1, { fill: C.gold });
  s.put(1, 1, 1, 'Aurum', { fill: C.gold, color: C.dark, b: true, sz: 15, align: 'center' }, 2);
  s.put(2, 1, 3, 'Операции', { color: C.white, b: true, sz: 18, indent: 2 });
  s.put(2, 2, 3, `${r.ops.length} ${plural(r.ops.length, 'операция', 'операции', 'операций')} за период · переводы и возвраты в итоги не входят`, { color: '9BA0B0', sz: 9, indent: 3 });
  s.put(5, 1, 3, head.period, { color: C.goldL, b: true, sz: 14, align: 'right' });
  s.put(5, 2, 3, `доходы ${money(r.inc)} · расходы ${money(r.exp)}`, { color: '9BA0B0', sz: 9, align: 'right' });
  const H = 6;
  s.height(H, 28);
  cols.forEach(([t], i) => s.put(i + 1, H, 1, t, { fill: C.head, color: C.goldL, b: true, sz: 9, align: t === 'Сумма' ? 'right' : t === 'Тип' ? 'center' : 'left', indent: t === 'Тип' ? 0 : 1 }));
  r.ops.forEach((o, i) => {
    const y = H + 1 + i, fillColor = i % 2 ? C.zebra : C.white;
    const base = { fill: fillColor, sz: 9, bb: [C.rowLine], indent: 1, align: 'left' };
    const [kind, pill] = KIND[o.action] ?? [o.action, 'n'];
    const cur = o.sym && o.sym !== '₴' ? o.sym : '₴';
    const value = Math.abs(Number(o.v ?? o.amount));
    const sign = o.action === 'EXPENSE' ? '−' : o.action === 'TRANSFER' ? '' : '+';
    const color = o.full ? C.mut : o.action === 'EXPENSE' ? C.red : o.action === 'INCOME' ? C.green : o.action === 'RETURN' ? '2E6DA4' : C.mut;
    s.height(y, 23);
    s.put(1, y, 1, serial(dayKey(o.date)), { ...base, fmt: 'dd.mm.yyyy' });
    s.put(2, y, 1, kind, { ...base, fill: PILL[pill][0], color: PILL[pill][1], b: true, sz: 8, align: 'center', indent: 0, bl: [fillColor, 'thick'], br: [fillColor, 'thick'], bt: [fillColor, 'medium'], bb: [fillColor, 'medium'] });
    s.put(3, y, 1, o.note || o.cat, base);
    s.put(4, y, 1, o.cat || '—', base);
    s.put(5, y, 1, o.acc ?? '', base);
    s.put(6, y, 1, o.action === 'EXPENSE' ? -value : value, { ...base, align: 'right', color, b: o.action !== 'TRANSFER', strike: !!o.full, fmt: `${sign === '+' ? '+' : ''}#,##0.00\\ "${cur}";−#,##0.00\\ "${cur}"` });
    s.put(7, y, 1, o.memo ?? '', { ...base, color: C.mut });
  });
  const lastRow = H + 1 + r.ops.length;
  s.freeze = H + 1;
  s.filter = `B${H + 1}:H${Math.max(lastRow, H + 2)}`;
  return s;
}

export const reportName = (r) => `Aurum_отчёт_${r.period.label.replace(/\s*–\s*/, '-').replace(/\s+/g, '_')}.xlsx`;
export const reportFile = (r) => buildXlsx(reportSheets(r));
