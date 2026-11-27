// Как в старом приложении: после входа грузим все экраны заранее, поэтому вкладки открываются мгновенно
import { refresh, put, cachedKeys } from './cache.svelte.js';
import { loadHome, loadAccounts, loadOpsForAll, loadMonthOps, opsLoader } from './data.js';
import { loadRates } from './rate.js';
import { loadBrands } from './brands.svelte.js';
import { syncOps } from './opsstore.js';

let last = 0;
export function prefetchAll(force = false) {
  const now = Date.now();
  if (!force && now - last < 30000) return;
  last = now;
  refresh('home', loadHome, force).catch(() => {});
  refresh('accounts', loadAccounts, force).then((d) => {
    const ids = [...d.cards, ...d.cashes, ...d.envs, ...d.debts, ...d.foreign.flatMap((f) => f.list)].map((a) => a.id);
    return loadOpsForAll(ids).then((m) => m.forEach((v, id) => put('ops.' + id, v)));
  }).catch(() => {});
  { const n = new Date(); refresh(`ops.m.${n.getFullYear()}-${n.getMonth()}`, () => loadMonthOps(n.getFullYear(), n.getMonth()), force).catch(() => {}); }
  // после изменения операции остальные уже открытые месяцы тоже могли поменяться (дата, перенос в другой месяц)
  if (force) for (const k of cachedKeys('ops.m.')) { const [y, m] = k.slice(6).split('-').map(Number); const n = new Date(); if (y === n.getFullYear() && m === n.getMonth()) continue; refresh(k, () => loadMonthOps(y, m), true).catch(() => {}); }
  // то же для года, «Все» и своих периодов
  if (force) for (const k of [...cachedKeys('ops.y.'), ...cachedKeys('ops.r.'), ...cachedKeys('ops.all')]) refresh(k, opsLoader(k), true).catch(() => {});
  loadRates().catch(() => {});
  loadBrands().catch(() => {});
  // копия операций на устройстве: из неё читаются списки операций, окна счетов, Главная и Бюджет
  syncOps().catch((e) => console.warn('Синхронизация операций не удалась', e));
}
