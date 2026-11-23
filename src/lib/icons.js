// Линейные иконки 24×24 (stroke)
export const ICONS = {
  plus: 'M12 5v14M5 12h14',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  film: 'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 5v14M16 5v14M4 10h4M4 14h4M16 10h4M16 14h4',
  digital: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM2 19.5h20',
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5',
  cart: 'M3 4h2l2.4 11h10.2L20 7H6M9 19.3h.01M17 19.3h.01',
  cash: 'M3.5 7h17a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v.01M18 14v.01',
  eat: 'M7 3v8a2 2 0 0 0 2 2v8M7 3v5M11 3v5a2 2 0 0 1-2 2M17 21V3c-2 1.5-3 4-3 7h3',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  tag: 'M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8zM8.5 8.5h.01'
};
export const iconPath = (k) => ICONS[k] ?? ICONS.tag;
