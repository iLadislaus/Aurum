// Окно «Изменить счёт»: какой счёт открыт и какого он вида (cash, env, fx, debt)
export const ea = $state({ open: false, acc: null });
export function openEdit(acc) { ea.acc = acc; ea.open = true; }
export const closeEdit = () => { ea.open = false; };
