// Эмблемы магазинов: шаблоны названий лежат в Supabase (merchant_brands), картинки — в public/logos
import { sb } from './supabase.js';

const KEY = 'aurum.brands';
let saved = [];
try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* пусто */ }
const st = $state({ list: saved });
let started = false;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const build = (rows) => rows
  .filter((r) => r.logo_url && r.pattern)
  .map((r) => ({ file: r.logo_url.split('/').pop(), re: new RegExp(`(^|[^\\p{L}\\p{N}])${esc(r.pattern.toLowerCase())}`, 'u'), n: r.pattern.length }))
  .sort((a, b) => b.n - a.n);

let rules = build(saved);

export async function loadBrands() {
  if (started) return;
  started = true;
  const { data, error } = await sb.from('merchant_brands').select('pattern,logo_url');
  if (error || !data) { started = false; return; }
  rules = build(data);
  st.list = data;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* хранилище недоступно */ }
}

// адрес картинки для названия операции или null
export function logoFor(name) {
  void st.list;
  const s = (name || '').toLowerCase();
  if (!s) return null;
  const r = rules.find((x) => x.re.test(s));
  return r ? `${import.meta.env.BASE_URL}logos/${r.file}?v=${__APP_VERSION__}` : null;
}
