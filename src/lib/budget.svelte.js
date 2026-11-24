// Окна «Бюджета»: открыты или нет
export const bg = $state({ cats: false });
export const openCats = () => { bg.cats = true; };
export const closeCats = () => { bg.cats = false; };
