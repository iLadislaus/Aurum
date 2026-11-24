// Окно «На горизонте»: открывается с Главной, лежит на уровне приложения, как остальные окна
export const hz = $state({ open: false });
export const openHorizon = () => { hz.open = true; };
export const closeHorizon = () => { hz.open = false; };
