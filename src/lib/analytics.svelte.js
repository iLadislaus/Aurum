// Окно «Аналитика»: открыто ли и какой месяц выбран (месяц = год*12 + индекс)
const n = new Date();
export const an = $state({ open: false, ym: n.getFullYear() * 12 + n.getMonth() });
export const openAnalytics = (ym) => { if (ym != null) an.ym = ym; an.open = true; };
export const closeAnalytics = () => { an.open = false; };
