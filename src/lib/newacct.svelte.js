import { landBack } from './fly.js';
// Окно «Новый счёт»: открыто или нет, плюс флаг «кнопка «+» уже улетала» (чтобы при запуске не играла анимация возврата)
export const na = $state({ open: false, used: false });
export function openNew() { na.used = true; na.open = true; }
export const closeNew = () => { na.open = false; landBack(); };
