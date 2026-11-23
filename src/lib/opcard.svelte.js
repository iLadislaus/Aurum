// Карточка операции: какая операция открыта и из какого списка (ключ кэша)
export const oc = $state({ open: false, op: null, key: '' });

export function openOp(op, key) {
  oc.op = op; oc.key = key; oc.open = true;
}
export const closeOp = () => { oc.open = false; };
