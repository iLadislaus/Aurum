// Окна «Бюджета»: открыты или нет; последние загруженные данные экрана по месяцам (чтобы показывать сразу)
const n = new Date();
// ym — месяц, выбранный на экране «Бюджет» (год × 12 + месяц); «План» открывается на нём же
export const bg = $state({ cats: false, plan: false, dist: false, ym: n.getFullYear() * 12 + n.getMonth() });
export const bd = $state({});
export const openCats = () => { bg.cats = true; };
export const closeCats = () => { bg.cats = false; };
export const openPlan = () => { bg.plan = true; };
export const closePlan = () => { bg.plan = false; };
export const openDist = () => { bg.dist = true; };
export const closeDist = () => { bg.dist = false; };
