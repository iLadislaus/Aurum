// Окно «Monobank»: открыто ли оно, настройки подключения и подключение новых карт
export const mw = $state({ open: false, conn: null, connect: false });
export const openMono = () => { mw.open = true; };
export const closeMono = () => { mw.open = false; mw.conn = null; mw.connect = false; };
