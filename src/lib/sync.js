// Синхронизация операций по изменениям: первый раз грузим всё, дальше только изменённое и удалённое.
// Здесь нет ничего реактивного и браузерного: клиент базы и хранилище передаются снаружи.

const FORMAT = 1;
const PAGE = 1000; // Supabase отдаёт не больше 1000 строк за раз
// запас назад от последней отметки: долгая запись могла получить время раньше, чем стала видна
const OVERLAP = 5 * 60 * 1000;
// раз в несколько дней сверяемся полной загрузкой, чтобы расхождения не копились
const FULL_EVERY = 3 * 86400000;

// чаще раза в минуту базу не спрашиваем, если приложение само не меняло операции
const FRESH = 60000;

export function createOpsSync({ sb, store, columns, now = Date.now, changes = () => 0 }) {
  const cols = columns + ',updated_at';
  let running = null, again = false, started = false, generation = 0;
  let memory = null; // последняя копия: работает, даже если хранилище устройства недоступно
  let checked = null; // когда в последний раз сверились и какой тогда был счётчик изменений

  async function pages(query) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const r = await query().range(from, from + PAGE - 1);
      if (r.error) throw r.error;
      rows.push(...r.data);
      if (r.data.length < PAGE) return rows;
    }
  }
  const later = (a, b) => (!a || Date.parse(b) > Date.parse(a) ? b : a);

  async function full() {
    // отметки удалений читаем до операций: удаление во время загрузки попадёт в следующий раз
    const last = await sb.from('transactions_deleted').select('deleted_at').order('deleted_at', { ascending: false }).limit(1);
    if (last.error) throw last.error;
    const list = await pages(() => sb.from('transactions').select(cols).order('id'));
    let cursor = last.data[0]?.deleted_at ?? null;
    const rows = {};
    for (const t of list) { rows[t.id] = t; cursor = later(cursor, t.updated_at); }
    return { format: FORMAT, rows, cursor, fullAt: now() };
  }

  async function delta(old) {
    const since = new Date(Date.parse(old.cursor) - OVERLAP).toISOString();
    const gone = await pages(() => sb.from('transactions_deleted').select('id,deleted_at').gte('deleted_at', since).order('deleted_at').order('id'));
    const changed = await pages(() => sb.from('transactions').select(cols).gte('updated_at', since).order('updated_at').order('id'));
    const rows = { ...old.rows };
    let cursor = old.cursor;
    for (const d of gone) {
      if (rows[d.id] && Date.parse(rows[d.id].updated_at) <= Date.parse(d.deleted_at)) delete rows[d.id];
      cursor = later(cursor, d.deleted_at);
    }
    for (const t of changed) { rows[t.id] = t; cursor = later(cursor, t.updated_at); }
    return { ...old, rows, cursor };
  }

  async function once() {
    const gen = generation;
    const old = await (memory ?? store.read().catch(() => null)); // await всегда: вызовы того же такта успевают присоединиться
    started = true; // дальше идут запросы: вызовам после этой точки нужен ещё один проход
    const at = now(), version = changes(); // запоминаем до запросов: запись во время сверки сделает её устаревшей
    if (old && checked && checked.version === version && at >= checked.at && at - checked.at < FRESH) {
      return { mode: 'fresh', count: Object.keys(old.rows).length, rows: old.rows };
    }
    const usable = old && old.format === FORMAT && old.cursor && now() - old.fullAt < FULL_EVERY;
    let next = usable ? await delta(old) : await full();
    let mode = usable ? 'delta' : 'full';
    if (usable) {
      // дешёвая проверка: число операций должно совпадать с базой, иначе грузим всё заново
      const c = await sb.from('transactions').select('id', { count: 'exact', head: true });
      if (c.error) throw c.error;
      if (c.count !== Object.keys(next.rows).length) { next = await full(); mode = 'repair'; }
    }
    if (gen !== generation) return null; // пока грузили, вышли из аккаунта
    memory = next;
    checked = { at, version };
    await store.write(next).catch(() => {});
    if (gen !== generation) { await store.clear().catch(() => {}); return null; }
    return { mode, count: Object.keys(next.rows).length, rows: next.rows };
  }

  // одновременно идёт только одна синхронизация; запрос во время неё запускает ещё один проход после
  function sync() {
    if (running) { if (started) again = true; return running; }
    running = (async () => {
      try {
        let res;
        do { again = false; started = false; res = await once(); } while (again);
        return res;
      } finally { running = null; again = false; started = false; }
    })();
    return running;
  }

  async function clear() { generation += 1; memory = null; checked = null; await store.clear(); }

  // все операции, не старее момента вызова
  async function rows() {
    const r = await sync();
    if (!r) throw new Error('Выполнен выход из аккаунта');
    return Object.values(r.rows);
  }

  return { sync, rows, clear };
}
