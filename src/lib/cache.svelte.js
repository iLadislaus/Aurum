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
for (const k of ['home', 'accounts', 'cats', 'bcats']) box(k);
try { Object.keys(localStorage).filter((k) => k.startsWith(PFX)).forEach((k) => box(k.slice(PFX.length))); } catch { /* пусто */ }

export const peek = (key) => box(key).v;
export const cachedKeys = (prefix) => Object.keys(boxes).filter((k) => k.startsWith(prefix) && boxes[k].v != null);

// один и тот же запрос не летит дважды: экран подхватывает уже идущую загрузку
const inflight = {};
// force: идущая загрузка могла начаться до изменения данных, поэтому после неё грузим заново
export function refresh(key, loader, force = false) {
  if (inflight[key]) return force ? inflight[key].catch(() => {}).then(() => refresh(key, loader)) : inflight[key];
  inflight[key] = (async () => {
    try {
      const v = await loader();
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
  box(key).v = v;
  try { localStorage.setItem(PFX + key, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
}
