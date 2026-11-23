// Как в старом приложении: после входа грузим все экраны заранее, поэтому вкладки открываются мгновенно
import { refresh } from './cache.svelte.js';
import { loadHome, loadAccounts } from './data.js';
import { loadRates } from './rate.js';

let last = 0;
export function prefetchAll(force = false) {
  const now = Date.now();
  if (!force && now - last < 30000) return;
  last = now;
  refresh('home', loadHome).catch(() => {});
  refresh('accounts', loadAccounts).catch(() => {});
  loadRates().catch(() => {});
}
