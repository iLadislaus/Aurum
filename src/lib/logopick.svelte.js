// Окно «Логотип»: для какого названия выбираем картинку и какой значок категории у операции
export const lp = $state({ open: false, name: '', icon: 'tag' });
export const openLogo = (name, icon) => { lp.name = name; lp.icon = icon; lp.open = true; };
export const closeLogo = () => { lp.open = false; };
