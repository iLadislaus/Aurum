// Окно «Правила»: открыто ли оно и форма нового правила
export const rl = $state({ open: false, add: false, kind: 'EXPENSE' });
export const openRules = () => { rl.open = true; };
export const closeRules = () => { rl.open = false; rl.add = false; };
export const openNewRule = (kind) => { rl.kind = kind; rl.add = true; };
export const closeNewRule = () => { rl.add = false; };
