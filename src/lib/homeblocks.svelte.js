// Блоки главной: порядок и видимость хранятся на телефоне
const KEY = 'aurum.homeBlocks', LESSON = 'aurum.hbLesson';
export const BLOCKS = [
  { id: 'balance', n: 'Баланс, бюджет, горизонт', i: 'wallet' },
  { id: 'recent', n: 'Последние операции', i: 'cards' },
  { id: 'flow', n: 'Денежный поток', i: 'swap' }
];

function load() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* пусто */ }
  const known = saved.filter((s) => BLOCKS.some((b) => b.id === s.id));
  const rest = BLOCKS.filter((b) => !known.some((s) => s.id === b.id)).map((b) => ({ id: b.id, on: true }));
  return [...known.map((s) => ({ id: s.id, on: s.on !== false })), ...rest];
}

export const hb = $state({ open: false, list: load(), lesson: false });

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(hb.list)); } catch { /* хранилище недоступно */ } };
export const meta = (id) => BLOCKS.find((b) => b.id === id);
export const isOn = (id) => hb.list.find((b) => b.id === id)?.on !== false;
export const order = (id) => hb.list.findIndex((b) => b.id === id);

export function openBlocks() {
  let seen = false;
  try { seen = !!localStorage.getItem(LESSON); } catch { /* пусто */ }
  hb.lesson = !seen;
  hb.open = true;
}
export const closeBlocks = () => { hb.open = false; };
export function endLesson() {
  hb.lesson = false;
  try { localStorage.setItem(LESSON, '1'); } catch { /* пусто */ }
}
export function toggle(id) {
  const b = hb.list.find((x) => x.id === id);
  if (b) { b.on = !b.on; save(); }
}
export function move(id, to) {
  const from = hb.list.findIndex((x) => x.id === id);
  if (from < 0 || from === to) return;
  const [it] = hb.list.splice(from, 1);
  hb.list.splice(to, 0, it);
  save();
}
