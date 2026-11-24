// Окно «Новый платёж» (плановый платёж для блока «На горизонте»); edit — платёж, который меняем
import { anchorTop } from './horizon.svelte.js';
export const np = $state({ open: false, top: 150, edit: null });
export const openNewPay = (edit = null) => { np.edit = edit; np.top = anchorTop(); np.open = true; };
export const closeNewPay = () => { np.open = false; };
