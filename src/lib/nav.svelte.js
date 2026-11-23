// Вкладки нижнего меню и текущее состояние навигации
export const tabs = [
  { id: 'home', label: 'Главная' },
  { id: 'accounts', label: 'Счета' },
  { id: 'ops', label: 'Операции' },
  { id: 'budget', label: 'Бюджет' },
  { id: 'more', label: 'Ещё' }
];

export const nav = $state({ tab: 'home' });
