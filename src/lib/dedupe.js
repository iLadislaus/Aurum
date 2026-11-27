// Одинаковые запросы справочников и итогов, идущие почти одновременно, отправляются в базу один раз.
// Любой другой запрос, кроме чтения, сразу забывает всё запомненное: после изменения данные запрашиваются заново.
// Операции здесь не участвуют: их сверяет своя синхронизация, а проверки перед записью должны быть свежими.

const TABLES = /\/rest\/v1\/(categories|accounts|account_balances|budgets|transaction_splits|recurring_payments|budget_distribution|budget_distribution_month)$/;
const TOTALS = /\/rest\/v1\/rpc\/(month_summary|month_category_totals)$/;

export function createDedupeFetch(send, { ttl = 2000 } = {}) {
  const saved = new Map(); // ключ запроса → обещание ответа

  return async function dedupeFetch(input, init = {}) {
    const url = String(input?.url ?? input);
    const method = (init.method ?? input?.method ?? 'GET').toUpperCase();
    const path = url.split('?')[0];
    const read = method === 'GET' || method === 'HEAD';
    const totals = method === 'POST' && TOTALS.test(path);

    if (!read && !totals) {
      saved.clear(); // до отправки: чтения, начатые раньше, больше не раздаём
      try { return await send(input, init); } finally { saved.clear(); } // и после: начатые во время записи тоже
    }
    if (!(totals || TABLES.test(path)) || init.signal) return send(input, init);

    const key = [method, url, init.body ?? '', ...[...new Headers(init.headers)].map((h) => h.join(':'))].join('\n');
    let hit = saved.get(key);
    if (!hit) {
      hit = (async () => {
        const r = await send(input, init);
        const empty = method === 'HEAD' || r.status === 204 || r.status === 304;
        return { ok: r.ok, body: empty ? null : await r.text(), init: { status: r.status, statusText: r.statusText, headers: [...r.headers] } };
      })();
      saved.set(key, hit);
      const drop = () => { if (saved.get(key) === hit) saved.delete(key); };
      hit.then((x) => (x.ok ? setTimeout(drop, ttl) : drop()), drop);
    }
    const x = await hit;
    return new Response(x.body, x.init); // каждому свой ответ: тело читается один раз
  };
}
