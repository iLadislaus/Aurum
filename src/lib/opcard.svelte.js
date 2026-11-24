// Карточка операции: какая операция открыта и из какого списка (ключ кэша)
// act: действие, которое нужно сразу выполнить при открытии ('split' — разделение, 'del' — подтверждение удаления)
export const oc = $state({ open: false, op: null, key: '', act: '' });

export function openOp(op, key, act = '') {
  oc.op = op; oc.key = key; oc.act = act; oc.open = true;
}
export const closeOp = () => { oc.open = false; };
