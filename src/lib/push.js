// Уведомления на это устройство: подписка в браузере + запись о ней через edge-функцию push
import { sb } from './supabase.js';

export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function call(body) {
  const r = await sb.functions.invoke('push', { body });
  if (!r.error) return r.data;
  let answer = null;
  try { answer = await r.error.context.json(); } catch { /* ответа нет */ }
  const e = new Error(answer?.message || 'Нет связи, попробуйте ещё раз');
  e.status = r.error.context?.status;
  throw e;
}
const bytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const keysOf = (sub) => { const j = sub.toJSON(); return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }; };

// всё нужное для кнопки готовим заранее: iPhone разрешает подписку только сразу по касанию, без ожидания сети
export async function prepare() {
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') return { reg, sub, key: null };
  return { reg, sub: null, key: bytes((await call({ action: 'key' })).key) };
}

export async function enable(reg, key) {
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try { await call({ action: 'on', ...keysOf(sub) }); }
  catch (e) { await sub.unsubscribe().catch(() => {}); throw e; }
  return sub;
}

export async function disable(sub) {
  await call({ action: 'off', endpoint: sub.endpoint });
  await sub.unsubscribe();
}

// что присылать: без аргумента только читает
export const prefs = async (change = {}) => (await call({ action: 'prefs', ...change })).prefs;

export async function sendTest(sub) {
  try { await call({ action: 'test', endpoint: sub.endpoint }); }
  catch (e) {
    if (e.status === 404 || e.status === 410) { await sub.unsubscribe().catch(() => {}); e.gone = true; }
    throw e;
  }
}
