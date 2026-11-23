// Формат сумм: «число, затем символ валюты», разряды неразрывным пробелом
const nf = (d) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmt = (n, d = 0) => nf(d).format(n).replace(/[  ]/g, ' ');
export const money = (v, d = 0) => fmt(v, d) + ' ₴';
export const signed = (v, d = 2) => (v >= 0 ? '+' : '−') + fmt(Math.abs(v), d);

const plural = (n, a, b, c) => {
  const m = n % 100, d = n % 10;
  if (m > 10 && m < 20) return c;
  return d === 1 ? a : d >= 2 && d <= 4 ? b : c;
};
export const daysLabel = (d) => (d <= 0 ? 'сегодня' : d === 1 ? 'завтра' : `через ${d} ${plural(d, 'день', 'дня', 'дней')}`);

const SYM = { UAH: '₴', USD: '$', EUR: '€' };
// «−1 313,04 ₴»: настоящий минус, символ валюты после числа
export const cash = (v, d = 2, cur = 'UAH') => (v < 0 ? '−' : '') + fmt(Math.abs(v), d) + ' ' + (SYM[cur] ?? cur);

// Карта Monobank BLACK / WHITE — для картинки карты в окнах операции
export const cardTheme = (name = '') => (/mono/i.test(name) ? (/\bblack\b/i.test(name) ? 'black' : /\bwhite\b/i.test(name) ? 'white' : null) : null);
