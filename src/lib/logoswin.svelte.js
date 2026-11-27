// Окно «Логотипы»: открыто ли оно
export const lw = $state({ open: false });
export const openLogos = () => { lw.open = true; };
export const closeLogos = () => { lw.open = false; };
