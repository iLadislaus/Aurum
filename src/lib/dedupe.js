// Одинаковые запросы справочников и итогов, идущие почти одновременно, отправляются в базу один раз.
// Пока сверка операций свежая, повторно берётся и ответ, запрошенный после её начала: балансы не отстают от списка операций.
// Любой другой запрос, кроме чтения, сразу забывает всё запомненное: после изменения данные запрашиваются заново.
// Операции здесь не участвуют: их сверяет своя синхронизация, а проверки перед записью должны быть свежими.

const TABLES = /\/rest\/v1\/(categories|accounts|account_balances|budgets|transaction_splits|recurring_payments|budget_distribution|budget_distribution_month)$/;
const TOTALS = /\/rest\/v1\/rpc\/(month_summary|month_category_totals)$/;

// запись в эти таблицы операции не меняет (удаление считаем изменением всегда)
const NOT_OPS = /\/rest\/v1\/(budgets|budget_distribution|budget_distribution_month|rules|recurring_payments|merchant_brands)$/;

export function createDedupeFetch(send, { ttl = 2000, onOpsChange = () => {}, freshSince = () => null, now = Date.now } = {}) {
  const saved = new Map(); // ключ запроса → ответ, когда запрошен и когда получен

  return async function dedupeFetch(input, init = {}) {
    const url = String(input?.url ?? input);
    const method = (init.method ?? input?.method ?? 'GET').toUpperCase();
    const path = url.split('?')[0];
    const read = method === 'GET' || method === 'HEAD';
    const totals = method === 'POST' && TOTALS.test(path);

    // состояние Monobank и список карт в базе операции не меняют
    const monoRead = method === 'POST' && /\/functions\/v1\/mono$/.test(path) && /"action":"(status|accounts)"/.test(String(init.body ?? ''));
    // загрузка логотипа и настройка уведомлений операции тоже не меняют
    if (monoRead || (method === 'POST' && /\/functions\/v1\/(logo|push)$/.test(path))) return send(input, init);

    if (!read && !totals) {
      // вход и обновление токена данные не меняют
      const ops = !path.includes('/auth/v1/') && !((method === 'POST' || method === 'PATCH') && NOT_OPS.test(path));
      const changed = () => { saved.clear(); if (ops) onOpsChange(); };
      changed(); // до отправки: чтения, начатые раньше, больше не раздаём
      try { return await send(input, init); } finally { changed(); } // и после: начатые во время записи тоже
    }
    if (!(totals || TABLES.test(path)) || init.signal) return send(input, init);

    const key = [method, url, init.body ?? '', ...[...new Headers(init.headers)].map((h) => h.join(':'))].join('\n');
    let hit = saved.get(key);
    if (hit && hit.done !== null) {
      const since = freshSince();
      if (!(now() - hit.done < ttl || (since !== null && hit.sent >= since))) hit = null;
    }
    if (!hit) {
      const entry = { sent: now(), done: null };
      entry.answer = (async () => {
        const r = await send(input, init);
        const empty = method === 'HEAD' || r.status === 204 || r.status === 304;
        return { ok: r.ok, body: empty ? null : await r.text(), init: { status: r.status, statusText: r.statusText, headers: [...r.headers] } };
      })();
      saved.set(key, entry);
      const drop = () => { if (saved.get(key) === entry) saved.delete(key); };
      entry.answer.then((x) => (x.ok ? (entry.done = now()) : drop()), drop); // ошибки не запоминаем
      hit = entry;
    }
    const x = await hit.answer;
    return new Response(x.body, x.init); // каждому свой ответ: тело читается один раз
  };
}
