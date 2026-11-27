// Эмблемы магазинов: шаблоны названий лежат в Supabase (merchant_brands), картинки — в public/logos.
// Шаблон «=название» — выбор владельца: действует на платежи ровно с этим названием; пустая картинка значит «без логотипа»
import { sb } from './supabase.js';

const KEY = 'aurum.brands';
let saved = [];
try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* пусто */ }
const st = $state({ list: saved });
let started = false, version = 0;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const brandKey = (name) => (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
const fileOf = (r) => (r?.logo_url ? r.logo_url.split('/').pop() : null);
const build = (rows) => ({
  exact: new Map(rows.filter((r) => r.pattern?.startsWith('=')).map((r) => [r.pattern.slice(1), fileOf(r)])),
  list: rows
    .filter((r) => r.logo_url && r.pattern && !r.pattern.startsWith('='))
    .map((r) => ({ file: fileOf(r), re: new RegExp(`(^|[^\\p{L}\\p{N}])${esc(r.pattern.toLowerCase())}`, 'u'), n: r.pattern.length }))
    .sort((a, b) => b.n - a.n)
});

let rules = build(saved);

function apply(rows) {
  rules = build(rows);
  st.list = rows;
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* хранилище недоступно */ }
}

export async function loadBrands() {
  if (started) return;
  started = true;
  const v = version;
  const { data, error } = await sb.from('merchant_brands').select('pattern,logo_url,domain');
  if (error || !data) { started = false; return; }
  if (v === version) apply(data); // пока грузили, выбор могли поменять: старый ответ не применяем
}

export const logoSrc = (file) => `${import.meta.env.BASE_URL}logos/${file}?v=${__APP_VERSION__}`;
const standard = (key) => rules.list.find((x) => x.re.test(key))?.file ?? null;

// файл картинки для названия операции или null
export function logoFile(name) {
  void st.list;
  const s = brandKey(name);
  if (!s) return null;
  return rules.exact.has(s) ? rules.exact.get(s) : standard(s);
}
// адрес картинки для названия операции или null
export function logoFor(name) {
  const f = logoFile(name);
  return f ? logoSrc(f) : null;
}

// все имеющиеся логотипы по одному разу; words — по чему их искать
export function logoList() {
  const all = new Map();
  for (const r of st.list) {
    const f = fileOf(r);
    if (!f) continue;
    const words = [f.replace(/\.\w+$/, ''), r.domain ?? '', r.pattern.replace(/^=/, '')].join(' ').toLowerCase();
    all.set(f, all.has(f) ? all.get(f) + ' ' + words : words);
  }
  return [...all].map(([file, words]) => ({ file, words })).sort((a, b) => a.file.localeCompare(b.file));
}

// сохранить выбор для названия; file = null — убрать логотип
export async function setLogo(name, file) {
  const key = brandKey(name);
  if (!key) return;
  const pattern = '=' + key;
  // обычный значок и так без логотипа: тогда запись не нужна
  const drop = file === standard(key);
  const row = { pattern, logo_url: file ? `${import.meta.env.BASE_URL}logos/${file}` : null };
  const r = drop
    ? await sb.from('merchant_brands').delete().eq('pattern', pattern)
    : await sb.from('merchant_brands').upsert(row, { onConflict: 'pattern' });
  if (r.error) throw r.error;
  version++;
  const rest = st.list.filter((x) => x.pattern !== pattern);
  apply(drop ? rest : [...rest, row]);
}
