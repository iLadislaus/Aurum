// Примерный курс Monobank к гривне (открытый адрес, без токена). Кэш на час: у банка жёсткий лимит запросов.
const KEY = 'aurum.rates.v1';
const CODES = { 840: 'USD', 978: 'EUR' };

function readCache() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function cachedRates() { const c = readCache(); return c ? c.r : null; }

export async function loadRates() {
  const c = readCache();
  if (c && Date.now() - c.t < 3600_000) return c.r;
  try {
    const res = await fetch('https://api.monobank.ua/bank/currency');
    if (!res.ok) throw new Error('rate ' + res.status);
    const list = await res.json();
    const r = { UAH: 1 };
    for (const x of list) {
      if (x.currencyCodeB !== 980 || !CODES[x.currencyCodeA]) continue;
      // среднее между покупкой и продажей, либо кросс-курс
      r[CODES[x.currencyCodeA]] = x.rateBuy && x.rateSell ? (x.rateBuy + x.rateSell) / 2 : x.rateCross;
    }
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), r })); } catch { /* хранилище недоступно */ }
    return r;
  } catch {
    // нет сети или банк просит подождать: берём последний сохранённый курс, иначе курса нет
    return c ? c.r : null;
  }
}
