// Окно «На горизонте»: выезжает из карточки баланса; выбранный срок (14 дней или месяц) запоминается
const KEY = 'aurum.hzr';
const load = () => { try { return localStorage.getItem(KEY) === 'm' ? 'm' : 'd'; } catch { return 'd'; } };
export const hz = $state({ open: false, top: 150, range: load() });
export const RANGE_DAYS = { d: 14, m: 30 };
export const RANGE_NAME = { d: '14 дней', m: 'Месяц' };
export const setRange = (r) => { hz.range = r; try { localStorage.setItem(KEY, r); } catch { /* не страшно */ } };
// платежи, которые попадают в выбранный срок, по возрастанию даты
export const inRange = (items, r) => [...items].filter((p) => p.days >= 0 && p.days <= RANGE_DAYS[r]).sort((a, b) => a.days - b.days);
// где у экрана нижний край карточки баланса: окно появляется чуть ниже него
export function anchorTop() {
  const el = typeof document !== 'undefined' && document.getElementById('hz-anchor');
  const b = el ? el.getBoundingClientRect().bottom : 150;
  return Math.round(Math.min(Math.max(b + 10, 70), window.innerHeight * 0.45));
}
export const openHorizon = () => { hz.top = anchorTop(); hz.open = true; };
export const closeHorizon = () => { hz.open = false; };
