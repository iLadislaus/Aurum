import { landBack } from './fly.js';
// Окно операции: создание (edit = null) или правка обычной операции.
// acc — счёт, из которого открыли окно; type — стартовый тип (например TRANSFER)
export const no = $state({ open: false, edit: null, acc: null, type: null });
export function openNewOp(edit = null, opts = {}) { no.edit = edit; no.acc = opts.acc ?? null; no.type = opts.type ?? null; no.open = true; }
export const closeNewOp = () => { no.open = false; landBack(); };
