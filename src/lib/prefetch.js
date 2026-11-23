// Как в старом приложении: после входа грузим все экраны заранее, поэтому вкладки открываются мгновенно
import { refresh, put } from './cache.svelte.js';
import { loadHome, loadAccounts, loadOpsForAll, loadMonthOps } from './data.js';
import { loadRates } from './rate.js';

let last = 0;
export function prefetchAll(force = false) {
  const now = Date.now();
  if (!force && now - last < 30000) return;
  last = now;
  refresh('home', loadHome).catch(() => {});
  refresh('accounts', loadAccounts).then((d) => {
    const ids = [...d.cards, ...d.cashes, ...d.envs, ...d.foreign.flatMap((f) => f.list)].map((a) => a.id);
    return loadOpsForAll(ids).then((m) => m.forEach((v, id) => put('ops.' + id, v)));
  }).catch(() => {});
  { const n = new Date(); refresh(`ops.m.${n.getFullYear()}-${n.getMonth()}`, () => loadMonthOps(n.getFullYear(), n.getMonth())).catch(() => {}); }
  loadRates().catch(() => {});
}
