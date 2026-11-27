// Monobank: всё общение с банком идёт через edge-функцию mono; токен в приложении не хранится
import { sb } from './supabase.js';
import { plural } from './format.js';

export async function callMono(action, extra = {}) {
  const r = await sb.functions.invoke('mono', { body: { action, ...extra } });
  if (!r.error) return r.data;
  // текст ошибки функция присылает в теле ответа
  let body = null;
  try { body = await r.error.context.json(); } catch { /* ответа нет */ }
  const e = new Error(body?.message || 'Нет связи с Monobank');
  e.code = body?.error;
  throw e;
}

export const loadMono = () => callMono('status');

export const addedLabel = (n) => (n ? `${plural(n, 'Добавлена', 'Добавлено', 'Добавлено')} ${n} ${plural(n, 'операция', 'операции', 'операций')}` : 'Новых операций нет');
export const shortName = (name = '') => name.replace(/^monobank\s+/i, '') || name;
// название подключения; если вместо него одна-две буквы, берём имя из банка
export const connTitle = (c) => (c.label?.length > 2 ? c.label : c.clientName?.split(/\s+/)[1] || c.label || 'Monobank');
