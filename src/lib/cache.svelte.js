// Кэш данных экранов: показываем сохранённое сразу, свежее подтягиваем тихо в фоне
const PFX = 'aurum.c1.';
const boxes = {};

function box(key) {
  if (!boxes[key]) {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(PFX + key) || 'null'); } catch { /* пусто */ }
    boxes[key] = $state({ v });
  }
  return boxes[key];
}

export const peek = (key) => box(key).v;

export async function refresh(key, loader) {
  const v = await loader();
  box(key).v = v;
  try { localStorage.setItem(PFX + key, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
  return v;
}

// при выходе из аккаунта чужие данные не остаются
export function dropCache() {
  for (const k of Object.keys(boxes)) boxes[k].v = null;
  try { Object.keys(localStorage).filter((k) => k.startsWith(PFX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ок */ }
}
