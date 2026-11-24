// Окно «Удалить счёт»: какой счёт удаляем и какого он вида (cash, env, fx, debt)
export const da = $state({ open: false, acc: null });
export function openDelete(acc) { da.acc = acc; da.open = true; }
export const closeDelete = () => { da.open = false; };
