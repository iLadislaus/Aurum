// Окна «Бюджета»: открыты или нет
export const bg = $state({ cats: false, plan: false, dist: false });
export const openCats = () => { bg.cats = true; };
export const closeCats = () => { bg.cats = false; };
export const openPlan = () => { bg.plan = true; };
export const closePlan = () => { bg.plan = false; };
export const openDist = () => { bg.dist = true; };
export const closeDist = () => { bg.dist = false; };
