// Проверка новой версии: сверяем версию сборки с version.json на сайте (без кэша)
export const update = $state({ available: false, version: '' });

const current = __APP_VERSION__;

export async function checkUpdate() {
  try {
    const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const { version } = await r.json();
    if (version && version !== current) {
      update.available = true;
      update.version = version;
    }
  } catch {
    // нет сети или dev-режим — молча пропускаем
  }
}

export function startUpdateWatch() {
  checkUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdate();
  });
  setInterval(checkUpdate, 5 * 60 * 1000);
}

// Новый адрес страницы обходит кэш браузера
export function applyUpdate() {
  location.replace('./?v=' + (update.version || Date.now()));
}
