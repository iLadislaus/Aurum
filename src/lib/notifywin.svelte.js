// Окно «Уведомления»: открыто ли оно
export const nw = $state({ open: false });
export const openNotify = () => { nw.open = true; };
export const closeNotify = () => { nw.open = false; };
