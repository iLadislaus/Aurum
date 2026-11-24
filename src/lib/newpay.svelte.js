// Окно «Новый платёж» (плановый платёж для блока «На горизонте»)
export const np = $state({ open: false });
export const openNewPay = () => { np.open = true; };
export const closeNewPay = () => { np.open = false; };
