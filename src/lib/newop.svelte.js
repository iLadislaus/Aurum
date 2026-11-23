// Окно операции: создание (edit = null) или правка обычной операции
export const no = $state({ open: false, edit: null });
export function openNewOp(edit = null) { no.edit = edit; no.open = true; }
export const closeNewOp = () => { no.open = false; };
