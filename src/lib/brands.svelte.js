// Эмблемы магазинов: шаблоны названий лежат в Supabase (merchant_brands), картинки — в public/logos.
// Шаблон «=название» — выбор владельца: действует на платежи ровно с этим названием; пустая картинка значит «без логотипа».
// Шаблон «+файл» — свой загруженный логотип (лежит в ветке «logos» на GitHub): он только в списке выбора
import { sb } from './supabase.js';

const KEY = 'aurum.brands';
let saved = [];
try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* пусто */ }
const st = $state({ list: saved });
let started = false, version = 0;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const brandKey = (name) => (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
// у готовых логотипов — имя файла, у загруженных — полный адрес
const fileOf = (r) => (!r?.logo_url ? null : r.logo_url.startsWith('http') ? r.logo_url : r.logo_url.split('/').pop());
const build = (rows) => ({
  exact: new Map(rows.filter((r) => r.pattern?.startsWith('=')).map((r) => [r.pattern.slice(1), fileOf(r)])),
  list: rows
    .filter((r) => r.logo_url && r.pattern && !/^[=+]/.test(r.pattern))
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

export const logoSrc = (file) => (file.startsWith('http') ? file : `${import.meta.env.BASE_URL}logos/${file}?v=${__APP_VERSION__}`);
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
    const words = [f.replace(/^.*\//, '').replace(/\.\w+$/, ''), r.domain ?? '', r.pattern.replace(/^[=+]/, '')].join(' ').toLowerCase();
    all.set(f, all.has(f) ? all.get(f) + ' ' + words : words);
  }
  // свои загрузки первыми, новые раньше старых
  const own = (f) => f.startsWith('http');
  return [...all].map(([file, words]) => ({ file, words })).sort((a, b) => own(b.file) - own(a.file) || (own(a.file) ? b.file.localeCompare(a.file) : a.file.localeCompare(b.file)));
}

// сохранить выбор для названия; file = null — убрать логотип
export async function setLogo(name, file) {
  const key = brandKey(name);
  if (!key) return;
  const pattern = '=' + key;
  // обычный значок и так без логотипа: тогда запись не нужна
  const drop = file === standard(key);
  const row = { pattern, logo_url: !file ? null : file.startsWith('http') ? file : `${import.meta.env.BASE_URL}logos/${file}` };
  const r = drop
    ? await sb.from('merchant_brands').delete().eq('pattern', pattern)
    : await sb.from('merchant_brands').upsert(row, { onConflict: 'pattern' });
  if (r.error) throw r.error;
  version++;
  const rest = st.list.filter((x) => x.pattern !== pattern);
  apply(drop ? rest : [...rest, row]);
}

// отправить свою картинку (JPEG в base64); возвращает адрес, по которому она появится
export async function uploadLogo(name, image) {
  const r = await sb.functions.invoke('logo', { body: { name, image } });
  if (r.error) {
    let body = null;
    try { body = await r.error.context.json(); } catch { /* ответа нет */ }
    throw new Error(body?.message || 'Нет связи, логотип не загружен');
  }
  version++;
  apply([...st.list, r.data.row]);
  return r.data.row.logo_url;
}
