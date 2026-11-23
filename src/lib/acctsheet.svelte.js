// Окно счёта: какой счёт открыт
export const acct = $state({ open: false, id: 0, name: '', kind: '', balance: 0, limit: 0, currency: 'UAH' });

export function openAcct(a) {
  Object.assign(acct, { limit: 0, currency: 'UAH', ...a });
  acct.open = true;
}
export const closeAcct = () => { acct.open = false; };
