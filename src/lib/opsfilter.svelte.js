// Период и фильтры «Операций» живут здесь, чтобы переживать перерисовку страницы (смена вкладки, правка операции)
const SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const pad = (n) => String(n).padStart(2, '0');
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const now = new Date();
// mode: all — всё время, month — месяц (y, m), year — год (yr), custom — свой период (from, to; name — «Сегодня», «7 дней»…)
export const per = $state({ mode: 'month', y: now.getFullYear(), m: now.getMonth(), yr: now.getFullYear(), from: '', to: '', name: '' });
export const fl = $state({ types: [], accs: [], cats: [], mers: [], sum: -1, src: [], flags: [] });
// окно «Свой период»
export const cal = $state({ open: false });

export const TYPES = [['EXPENSE', 'Расход', 'arrowup'], ['INCOME', 'Доход', 'arrowdown'], ['RETURN', 'Возврат', 'back'], ['TRANSFER', 'Перевод', 'swap']];
export const SUMR = [['до 100', 0, 100], ['100–1 000', 100, 1000], ['1 000–10 000', 1000, 10000], ['от 10 000', 10000, 1e12]];
export const SRC = [['bank', 'Из банка', 'bank'], ['manual', 'Вручную', 'pen']];
export const FLAGS = [['uncat', 'Без категории', 'tag'], ['split', 'Разделённые', 'split'], ['note', 'С заметкой', 'pen']];

// быстрые периоды в окне «Свой период»
export function quick(name) {
  const t = new Date(); const to = new Date(t);
  const from = new Date(t);
  if (name === 'Вчера') { from.setDate(t.getDate() - 1); to.setDate(t.getDate() - 1); }
  else if (name === '7 дней') from.setDate(t.getDate() - 6);
  else if (name === '14 дней') from.setDate(t.getDate() - 13);
  else if (name === '30 дней') from.setDate(t.getDate() - 29);
  return [isoDay(from), isoDay(to)];
}
export const QUICK = ['Сегодня', 'Вчера', '7 дней', '14 дней', '30 дней'];

export function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT[m - 1]}${y !== now.getFullYear() ? ' ' + y : ''}`;
}
export function rangeLabel(a, b) {
  if (!a) return '';
  if (!b || a === b) return dayLabel(a);
  const [ya, ma, da] = a.split('-').map(Number), [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da}–${db} ${SHORT[ma - 1]}`;
  return `${dayLabel(a)} – ${dayLabel(b)}`;
}
export const customLabel = () => per.name || rangeLabel(per.from, per.to);

// ключ кэша списка за выбранный период
export function perKey() {
  if (per.mode === 'all') return 'ops.all';
  if (per.mode === 'year') return 'ops.y.' + per.yr;
  if (per.mode === 'custom' && per.from) return `ops.r.${per.from}.${per.to || per.from}`;
  return `ops.m.${per.y}-${per.m}`;
}
export const perWord = () => (per.mode === 'all' ? 'за всё время' : per.mode === 'year' ? `за ${per.yr} год` : per.mode === 'custom' ? 'за период' : 'за месяц');

// снять свой период: возвращаемся на текущий месяц
export function resetPeriod() {
  const t = new Date();
  per.mode = 'month'; per.y = t.getFullYear(); per.m = t.getMonth(); per.yr = t.getFullYear(); per.from = ''; per.to = ''; per.name = '';
}

export const filterCount = () => fl.types.length + fl.accs.length + fl.cats.length + fl.mers.length + (fl.sum >= 0 ? 1 : 0) + fl.src.length + fl.flags.length;
export const activeCount = () => filterCount() + (per.mode === 'custom' ? 1 : 0);
export function clearFilters() {
  fl.types = []; fl.accs = []; fl.cats = []; fl.mers = []; fl.sum = -1; fl.src = []; fl.flags = [];
}
export function toggle(key, v) {
  const a = fl[key]; const i = a.indexOf(v);
  fl[key] = i < 0 ? [...a, v] : a.filter((x) => x !== v);
}

// фильтры: внутри одной группы «или», между группами «и»; skip — группа, которую не учитываем (для подсчёта вариантов)
export function applyFilters(ops, skip = '') {
  return ops.filter((t) => {
    if (skip !== 'types' && fl.types.length && !fl.types.includes(t.action)) return false;
    if (skip !== 'accs' && fl.accs.length && !fl.accs.some((id) => id === t.account_id || id === t.from_account_id || id === t.to_account_id)) return false;
    if (skip !== 'cats' && fl.cats.length && !fl.cats.some((c) => (c === 'none' ? t.uncat : t.category_id === c))) return false;
    if (skip !== 'mers' && fl.mers.length && !fl.mers.includes(t.name)) return false;
    if (skip !== 'sum' && fl.sum >= 0) { const v = Math.abs(t.amount), r = SUMR[fl.sum]; if (v < r[1] || v >= r[2]) return false; }
    if (skip !== 'src' && fl.src.length && !fl.src.some((s) => (s === 'bank' ? t.mono : !t.mono))) return false;
    if (skip !== 'flags' && fl.flags.length && !fl.flags.some((f) => (f === 'uncat' ? t.uncat : f === 'split' ? t.splits > 0 : !!(t.note || '').trim()))) return false;
    return true;
  });
}
