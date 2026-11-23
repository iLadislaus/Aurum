// ВРЕМЕННЫЕ примерные данные для проверки вида «Главной».
// Следующим шагом заменим их данными из существующей базы Supabase.
export const sample = {
  total: 48250,
  delta: 3120,
  pct: 6.9,
  budget: { plan: 30000, spent: 18450 },
  months: [
    { label: 'Сен', name: 'сентябрь', income: 29000, expense: 24800 },
    { label: 'Окт', name: 'октябрь', income: 36000, expense: 28200 },
    { label: 'Ноя', name: 'ноябрь', income: 31500, expense: 28380 }
  ],
  horizon: [
    { id: 1, name: 'Megogo', cat: 'Развлечения', period: 'каждый месяц', amount: 199, days: 1, icon: 'film' },
    { id: 2, name: 'Kyivstar', cat: 'Связь', period: 'каждый месяц', amount: 250, days: 4, icon: 'digital' },
    { id: 3, name: 'Аренда', cat: 'Жильё', period: 'каждый месяц', amount: 12000, days: 9, icon: 'home' },
    { id: 4, name: 'Интернет', cat: 'Связь', period: 'каждый месяц', amount: 180, days: 20, icon: 'bolt' }
  ],
  recent: [
    { id: 1, name: 'АТБ', cat: 'Продукты', when: 'сегодня', amount: -432.8, icon: 'cart' },
    { id: 2, name: 'Glovo', cat: 'Еда', when: 'сегодня', amount: -356, icon: 'eat' },
    { id: 3, name: 'Зарплата', cat: 'Доход', when: 'вчера', amount: 28000, icon: 'cash' }
  ]
};
