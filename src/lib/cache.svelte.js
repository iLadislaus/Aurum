// Кэш данных экранов: показываем сохранённое сразу, свежее подтягиваем тихо в фоне
const PFX = 'aurum.c1.';
const mem = $state({});

export function peek(key) {
  if (!(key in mem)) {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(PFX + key) || 'null'); } catch { /* пусто */ }
    mem[key] = v;
  }
  return mem[key];
}

export async function refresh(key, loader) {
  const v = await loader();
  mem[key] = v;
  try { localStorage.setItem(PFX + key, JSON.stringify(v)); } catch { /* хранилище недоступно */ }
  return v;
}

// при выходе из аккаунта чужие данные не остаются
export function dropCache() {
  for (const k of Object.keys(mem)) delete mem[k];
  try { Object.keys(localStorage).filter((k) => k.startsWith(PFX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ок */ }
}
