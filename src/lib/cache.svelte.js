// Кэш данных экранов: показываем сохранённое сразу, свежее подтягиваем тихо в фоне
const PFX = 'aurum.c2.';
const boxes = {};

function box(key) {
  if (!boxes[key]) {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(PFX + key) || 'null'); } catch { /* пусто */ }
    const b = $state({ v });
    boxes[key] = b;
  }
  return boxes[key];
}

// коробки создаём заранее: создание при первом чтении внутри $derived ломает подписку
for (const k of ['home', 'accounts', 'cats', 'bcats', 'rules', 'mono']) box(k);
try { Object.keys(localStorage).filter((k) => k.startsWith(PFX)).forEach((k) => box(k.slice(PFX.length))); } catch { /* пусто */ }

export const peek = (key) => box(key).v;
export const cachedKeys = (prefix) => Object.keys(boxes).filter((k) => k.startsWith(prefix) && boxes[k].v != null);

// один и тот же запрос не летит дважды: экран подхватывает уже идущую загрузку
const inflight = {};
// версия данных ключа: любая ручная правка (put) увеличивает её, а загрузка, начатая до правки, устарела и результат не применяет
const ver = {};
// force: идущая загрузка могла начаться до изменения данных, поэтому после неё грузим заново
export function refresh(key, loader, force = false) {
  if (inflight[key]) return force ? inflight[key].catch(() => {}).then(() => refresh(key, loader)) : inflight[key];
  inflight[key] = (async () => {
    try {
      const started = ver[key] ?? 0;
      const v = await loader();
      if ((ver[key] ?? 0) !== started) return box(key).v ?? v; // за время загрузки данные поправили руками: ответ старый
      box(key).v = v;
      try { localStorage.setItem(PFX + key, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
      return v;
    } finally { delete inflight[key]; }
  })();
  return inflight[key];
}

// при выходе из аккаунта чужие данные не остаются
export function dropCache() {
  for (const k of Object.keys(boxes)) boxes[k].v = null;
  try { Object.keys(localStorage).filter((k) => k.startsWith(PFX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ок */ }
}

// положить готовые данные в кэш без запроса
export function put(key, v) {
  ver[key] = (ver[key] ?? 0) + 1;
  box(key).v = v;
  try { localStorage.setItem(PFX + key, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
}
