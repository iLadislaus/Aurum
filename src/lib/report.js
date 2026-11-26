// Расчёты финансового отчёта: чистые функции без базы и экрана (их же берёт выгрузка в Excel)
export const MON = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
export const FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' });
export const dayKey = (d) => dayFmt.format(new Date(d));
const utc = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const key = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (k, n) => key(utc(k) + n * 86400000);
export const daysIn = (a, b) => Math.round((utc(b) - utc(a)) / 86400000) + 1;
// месяц = год*12 + индекс
export const ymOf = (k) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1;
export const ymStart = (v) => key(Date.UTC(Math.floor(v / 12), v % 12, 1));
export const ymEnd = (v) => key(Date.UTC(Math.floor(v / 12), (v % 12) + 1, 0));
export const ruDate = (k) => `${k.slice(8, 10)}.${k.slice(5, 7)}.${k.slice(0, 4)}`;
const r2 = (v) => Math.round(v * 100) / 100;
const sum = (l, f = (x) => x) => r2(l.reduce((s, x) => s + f(x), 0));
const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const change = (now, was) => (was > 0 ? Math.round(((now - was) / was) * 100) : null);
const isCorr = (name) => /balanc|corect|correct|корректир/i.test(name || '');

// период: kind 'm' (v = месяц), 'q' (v = год*4 + квартал), 'y' (v = год), 'r' (from, to)
export function periodOf(kind, v, from, to) {
  if (kind === 'm') return { kind, v, from: ymStart(v), to: ymEnd(v), label: `${FULL[v % 12]} ${Math.floor(v / 12)}` };
  if (kind === 'q') return { kind, v, from: ymStart(Math.floor(v / 4) * 12 + (v % 4) * 3), to: ymEnd(Math.floor(v / 4) * 12 + (v % 4) * 3 + 2), label: `${(v % 4) + 1} квартал ${Math.floor(v / 4)}` };
  if (kind === 'y') return { kind, v, from: `${v}-01-01`, to: `${v}-12-31`, label: `${v} год` };
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { kind: 'r', from: a, to: b, label: `${ruDate(a)} – ${ruDate(b)}` };
}

// Предыдущий период той же длины; незаконченный сравниваем с таким же числом первых дней прошлого
function prevOf(p, today) {
  let q;
  if (p.kind === 'r') { const n = daysIn(p.from, p.to); q = { from: addDays(p.from, -n), to: addDays(p.from, -1) }; }
  else q = periodOf(p.kind, p.v - 1);
  if (today >= p.from && today < p.to) { const t = addDays(q.from, daysIn(p.from, today) - 1); if (t < q.to) q = { ...q, to: t }; }
  return q;
}

// Возвраты: каждый привязываем к списанию, которое он отменяет (тот же счёт и название, до полугода назад).
// Тратой считается только то, что не вернулось; такая трата остаётся в дне и категориях самого списания
const shopKey = (s) => (s || '').trim().replace(/^(скасування\.|повернення платежу|возврат\.?|платіж)\s*/i, '').trim().toLowerCase();
export function linkReturns(ops) {
  const spent = new Map();
  for (const o of ops) {
    if (o.action !== 'EXPENSE' || !shopKey(o.note)) continue;
    const k = o.account_id + '|' + shopKey(o.note);
    if (!spent.has(k)) spent.set(k, []);
    spent.get(k).push(o);
  }
  const back = new Map(), linked = new Map();
  const rets = ops.filter((o) => o.action === 'RETURN').sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const r of rets) {
    const t = new Date(r.date).getTime(), amount = Number(r.amount);
    const left = (e) => Number(e.amount) - (back.get(e.id) ?? 0);
    // сначала списание ровно на эту сумму, иначе самое позднее, из которого она помещается
    const fit = (spent.get(r.account_id + '|' + shopKey(r.note)) ?? [])
      .filter((e) => { const d = t - new Date(e.date).getTime(); return d >= -120000 && d <= 180 * 86400000 && left(e) + 0.005 >= amount; })
      .sort((a, b) => (Math.abs(left(b) - amount) < 0.005) - (Math.abs(left(a) - amount) < 0.005) || new Date(b.date) - new Date(a.date));
    if (fit[0]) { back.set(fit[0].id, r2((back.get(fit[0].id) ?? 0) + amount)); linked.set(r.id, fit[0]); }
  }
  return { back, linked };
}

const GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
// «за октябрь», «за 1–26 октября», «за 1 июля – 26 августа»: чтобы было видно, с чем сравниваем
export function spanLabel(a, b, today) {
  const va = ymOf(a), vb = ymOf(b), d = (k) => Number(k.slice(8, 10));
  const ya = Math.floor(va / 12), yb = Math.floor(vb / 12), now = Number(today.slice(0, 4));
  const yr = (y) => (y === now ? '' : ` ${y}`);
  const whole = a === ymStart(va) && b === ymEnd(vb);
  if (whole && va === vb) return `за ${FULL[va % 12].toLowerCase()}${yr(ya)}`;
  if (whole && va % 12 === 0 && vb === va + 11) return `за ${ya} год`;
  if (whole && va % 3 === 0 && vb === va + 2) return `за ${(va % 12) / 3 + 1} квартал${yr(ya)}`;
  if (a === b) return `за ${d(a)} ${GEN[va % 12]}${yr(ya)}`;
  if (va === vb) return `за ${d(a)}–${d(b)} ${GEN[va % 12]}${yr(ya)}`;
  return `за ${d(a)} ${GEN[va % 12]}${ya === yb ? '' : ' ' + ya} – ${d(b)} ${GEN[vb % 12]}${yr(yb)}`;
}

// Строки учёта: по одной на категорию (разделённые операции раскладываются на части)
function ledger(raw) {
  const cm = new Map(raw.cats.map((c) => [c.id, c]));
  const am = new Map(raw.accounts.map((a) => [a.id, a]));
  const parts = new Map();
  for (const s of raw.splits) { if (!parts.has(s.transaction_id)) parts.set(s.transaction_id, []); parts.get(s.transaction_id).push(s); }
  const { back, linked } = linkReturns(raw.ops);
  const rows = [];
  for (const o of raw.ops) {
    if (linked.has(o.id)) continue; // уже вычтен из своего списания
    const day = dayKey(o.date);
    const src = am.get(o.account_id ?? o.from_account_id);
    if (src?.is_foreign) continue; // отчёт в гривнах: валютные счета отдельно, в «Счетах»
    let list = parts.get(o.id) ?? [{ category_id: o.category_id, amount: o.amount }];
    const returned = back.get(o.id) ?? 0;
    if (returned) {
      const net = r2(Number(o.amount) - returned);
      if (net <= 0.005) continue; // вернули всё: траты не было
      // разделённую операцию уменьшаем по всем частям пропорционально, копейки уходят в последнюю
      let rest = net;
      list = list.map((x, i) => { const v = i === list.length - 1 ? rest : r2((Number(x.amount) * net) / Number(o.amount)); rest = r2(rest - v); return { ...x, amount: v }; });
    }
    for (const x of list) {
      const c = cm.get(x.category_id);
      if (isCorr(c?.name)) continue;
      const amount = Number(x.amount);
      const base = { op: returned ? { ...o, returned } : o, day, cat: x.category_id ?? 0, amount };
      if (c?.is_debt) {
        // долги не доход и не расход, показываются отдельной строкой
        if (c.type === 'EXPENSE' && (o.action === 'EXPENSE' || o.action === 'TRANSFER')) rows.push({ ...base, type: 'paid' });
        else if (c.type === 'INCOME' && (o.action === 'INCOME' || o.action === 'TRANSFER')) rows.push({ ...base, type: 'taken' });
      } else if (o.action === 'EXPENSE') rows.push({ ...base, type: 'exp' });
      else if (o.action === 'RETURN') rows.push({ ...base, type: 'exp', amount: -amount });
      else if (o.action === 'INCOME') rows.push({ ...base, type: 'inc' });
    }
  }
  return { rows, cm, am, back, linked };
}

// Траты месяца по категориям, как в отчёте: Map категория → сумма. Их же берут «Бюджет» и Главная
export function monthSpend(raw, ym) {
  const m = new Map();
  for (const x of ledger(raw).rows) if (x.type === 'exp' && ymOf(x.day) === ym) m.set(x.cat, r2((m.get(x.cat) ?? 0) + x.amount));
  return m;
}

const within = (rows, a, b) => rows.filter((x) => x.day >= a && x.day <= b);
const totals = (rows) => ({
  inc: sum(rows.filter((x) => x.type === 'inc'), (x) => x.amount),
  exp: sum(rows.filter((x) => x.type === 'exp'), (x) => x.amount),
  paid: sum(rows.filter((x) => x.type === 'paid'), (x) => x.amount),
  taken: sum(rows.filter((x) => x.type === 'taken'), (x) => x.amount)
});
const group = (rows, f) => { const m = new Map(); for (const x of rows) { const k = f(x); m.set(k, r2((m.get(k) ?? 0) + x.amount)); } return m; };

export function buildReport(raw, period, now = new Date()) {
  const today = dayKey(now);
  const { rows, cm, am, back, linked } = ledger(raw);
  const first = raw.ops.reduce((m, o) => { const d = dayKey(o.date); return d < m ? d : m; }, today);
  const cur = within(rows, period.from, period.to);
  const t = totals(cur);
  const pq = prevOf(period, today);
  // сравнение честное только если за прошлый период есть вся история
  const comparable = pq.from >= addDays(first, -4);
  const pr = comparable ? within(rows, pq.from, pq.to) : [];
  const pt = totals(pr);
  const lastDay = period.to < today ? period.to : today;
  const firstDay = period.from > first ? period.from : first;
  const elapsed = lastDay >= firstDay ? daysIn(firstDay, lastDay) : 0;

  const prevLabel = comparable ? spanLabel(pq.from, pq.to, today) : null;
  const saldo = r2(t.inc - t.exp);
  const rate = t.inc > 0 ? Math.round((saldo / t.inc) * 100) : null;

  // категории расходов
  const catName = (id) => cm.get(id)?.name || 'Без категории';
  const exp = cur.filter((x) => x.type === 'exp');
  const byCat = group(exp, (x) => x.cat), prevCat = group(pr.filter((x) => x.type === 'exp'), (x) => x.cat);
  const cats = [...byCat].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({
    id, name: catName(id), icon: cm.get(id)?.icon || 'tag', value: v, share: pctOf(v, t.exp),
    prev: comparable ? prevCat.get(id) ?? 0 : null, change: comparable ? change(v, prevCat.get(id) ?? 0) : null,
    mand: !!cm.get(id)?.is_mandatory,
    ops: exp.filter((x) => x.cat === id).sort((a, b) => (a.op.date < b.op.date ? 1 : -1)).map((x) => ({ ...x.op, part: x.amount }))
  }));
  const mand = sum(cats.filter((c) => c.mand), (c) => c.value), opt = sum(cats.filter((c) => !c.mand), (c) => c.value);

  // магазины и крупные траты (по операциям целиком)
  const seen = new Map();
  for (const x of exp) { const e = seen.get(x.op.id) ?? { op: x.op, value: 0 }; e.value = r2(e.value + x.amount); seen.set(x.op.id, e); }
  const shop = new Map();
  for (const e of seen.values()) {
    const n = (e.op.note || '').replace(/^скасування\.\s*/i, '').trim();
    if (!n) continue;
    const s = shop.get(n) ?? { name: n, value: 0, count: 0 };
    s.value = r2(s.value + e.value); if (e.value > 0) s.count++; shop.set(n, s);
  }
  const merchants = [...shop.values()].filter((s) => s.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
  const big = [...seen.values()].filter((e) => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 5).map((e) => ({ ...e.op, part: e.value }));

  // доходы
  const inc = cur.filter((x) => x.type === 'inc');
  const grpName = (id) => { const n = catName(id); return /^advance|аванс/i.test(n) ? 'Аванс' : /^salary|зарплат/i.test(n) ? 'Зарплата' : 'Другое'; };
  const sources = ['Аванс', 'Зарплата', 'Другое'].map((g) => ({ name: g, value: sum(inc.filter((x) => grpName(x.cat) === g), (x) => x.amount) })).filter((s) => s.value > 0);
  const incCats = [...group(inc, (x) => x.cat)].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ id, name: catName(id), value: v, share: pctOf(v, t.inc) }));

  // динамика по месяцам: до 12 месяцев, заканчивая концом периода
  const endYm = ymOf(lastDay >= first ? lastDay : today);
  const months = [];
  for (let v = Math.max(ymOf(first), endYm - 11); v <= endYm; v++) {
    const m = totals(within(rows, ymStart(v), ymEnd(v)));
    months.push({ ym: v, label: `${MON[v % 12]} ${String(Math.floor(v / 12)).slice(2)}`, inc: m.inc, exp: m.exp, saldo: r2(m.inc - m.exp) });
  }
  const dayMap = group(exp, (x) => x.day);
  const days = [];
  if (elapsed) for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) days.push({ day: d, value: dayMap.get(d) ?? 0 });
  const topDay = days.reduce((m, d) => (d.value > (m?.value ?? 0) ? d : m), null);
  const wd = WEEK.map((name) => ({ name, total: 0, n: 0 }));
  for (const d of days) { const i = (new Date(utc(d.day)).getUTCDay() + 6) % 7; wd[i].total += d.value; wd[i].n++; }
  const weekdays = wd.map((w) => ({ name: w.name, value: w.n ? r2(w.total / w.n) : 0 }));

  // план и факт: планы всех месяцев, которые задевает период
  const a = ymOf(period.from), z = ymOf(period.to);
  const plans = new Map();
  for (const b of raw.budgets) {
    const v = ymOf(b.month), c = cm.get(b.category_id);
    if (v < a || v > z || !c || c.is_debt || c.type !== 'EXPENSE') continue;
    plans.set(b.category_id, r2((plans.get(b.category_id) ?? 0) + Number(b.amount)));
  }
  const planRows = [...new Set([...plans.keys(), ...cats.map((c) => c.id)])].map((id) => {
    const plan = plans.get(id) ?? 0, fact = Math.max(0, byCat.get(id) ?? 0);
    return { id, name: catName(id), plan, fact, left: r2(plan - fact), used: pctOf(fact, plan) };
  }).filter((p) => p.plan > 0 || p.fact > 0).sort((x, y) => y.plan - x.plan || y.fact - x.fact);
  const planned = planRows.filter((p) => p.plan > 0);
  const plan = {
    rows: planRows, any: planned.length > 0,
    total: sum(planned, (p) => p.plan), fact: sum(planned, (p) => p.fact),
    saved: sum(planned.filter((p) => p.left > 0), (p) => p.left),
    over: sum(planned.filter((p) => p.left < 0), (p) => -p.left),
    off: sum(planRows.filter((p) => !p.plan), (p) => p.fact)
  };

  // счета: остатки на сегодня
  const bal = new Map(raw.balances.map((b) => [b.id, Number(b.balance)]));
  const acc = raw.accounts.map((x) => ({ ...x, balance: bal.get(x.id) ?? 0 }));
  const home = acc.filter((x) => !x.is_foreign);
  const homeTotal = sum(home, (x) => x.balance);
  const cardsCash = sum(home.filter((x) => x.is_monobank || x.block === 'card'), (x) => x.balance);
  const envs = sum(home.filter((x) => x.block === 'env' && !x.is_monobank), (x) => x.balance);
  const rates = raw.rates ?? {};
  const foreign = acc.filter((x) => x.is_foreign && !x.is_debt && Math.abs(x.balance) > 0.004)
    .map((x) => ({ name: x.name, currency: x.currency, balance: x.balance, uah: rates[x.currency] ? r2(x.balance * rates[x.currency]) : null }));
  const debts = acc.filter((x) => x.is_debt && x.balance < -0.004)
    .map((x) => ({ name: x.name, currency: x.currency, amount: -x.balance, uah: x.currency === 'UAH' ? -x.balance : rates[x.currency] ? r2(-x.balance * rates[x.currency]) : null }));
  const list = home.filter((x) => Math.abs(x.balance) > 0.004).sort((x, y) => y.balance - x.balance).map((x) => ({ name: x.name, balance: x.balance }));

  // валютные сбережения: отдельно от гривны, в доходы и расходы не входят
  const SYMS = [...new Set(foreign.map((x) => x.currency))];
  const known = foreign.every((x) => x.uah != null);
  const savingsUah = known ? sum(foreign, (x) => x.uah) : null;
  const savings = foreign.length ? {
    list: foreign, uah: savingsUah,
    byCurrency: SYMS.map((c) => ({ currency: c, balance: sum(foreign.filter((x) => x.currency === c), (x) => x.balance) })),
    all: known ? r2(homeTotal + savingsUah) : null,
    share: known && homeTotal + savingsUah > 0 ? Math.max(0, Math.min(100, Math.round((savingsUah / (homeTotal + savingsUah)) * 100))) : null
  } : null;

  // остаток гривневых счетов на конец каждого месяца: от сегодняшнего остатка отматываем движения назад
  const flows = raw.ops.map((o) => {
    const mine = (id) => id != null && am.has(id) && !am.get(id).is_foreign;
    let v = 0;
    if ((o.action === 'INCOME' || o.action === 'RETURN') && mine(o.account_id)) v = o.amount;
    else if (o.action === 'EXPENSE' && mine(o.account_id)) v = -o.amount;
    else if (o.action === 'TRANSFER') v = (mine(o.to_account_id) ? Number(o.to_amount ?? o.amount) : 0) - (mine(o.from_account_id) ? o.amount : 0);
    return { day: dayKey(o.date), v };
  });
  const capital = months.map((m) => ({ label: m.label, value: r2(homeTotal - sum(flows.filter((f) => f.day > ymEnd(m.ym)), (f) => f.v)) }));

  // обычный расход: среднее за последние полные месяцы (до трёх)
  const nowYm = ymOf(today);
  const full = [];
  for (let v = nowYm - 1; v >= ymOf(first) && full.length < 3; v--) if (ymStart(v) >= addDays(first, -4)) full.push(totals(within(rows, ymStart(v), ymEnd(v))).exp);
  const since = first > addDays(today, -89) ? first : addDays(today, -89);
  const perDayUsual = sum(within(rows, since, today).filter((x) => x.type === 'exp'), (x) => x.amount) / daysIn(since, today);
  const avgMonth = full.length ? r2(sum(full) / full.length) : r2(perDayUsual * 30);

  // финансовое здоровье: три части, формула показана на экране и в Excel
  const cushion = avgMonth > 0 ? Math.max(0, homeTotal) / avgMonth : null;
  const debtKnown = debts.every((d) => d.uah != null);
  const debtUah = sum(debts, (d) => d.uah ?? 0);
  const parts = [];
  const clamp = (v) => Math.max(0, Math.min(1, v));
  if (cushion != null) parts.push({ name: 'Запас без дохода', text: `${cushion.toFixed(1).replace('.', ',')} мес`, max: 40, got: clamp(cushion / 6) * 40, rule: 'деньги на гривневых счетах ÷ средний расход за месяц; 6 месяцев = 40 баллов' });
  if (rate != null) parts.push({ name: 'Сбережения', text: `${rate}%`, max: 35, got: clamp(rate / 20) * 35, rule: '(доходы − расходы) ÷ доходы за период; 20% и выше = 35 баллов' });
  if (debtKnown) parts.push({ name: 'Долги', text: debtUah ? `≈ ${Math.round(debtUah).toLocaleString('ru-RU')} ₴` : 'нет', max: 25, got: debtUah ? clamp(1 - debtUah / Math.max(1, homeTotal)) * 25 : 25, rule: '25 баллов без долгов; чем больше долг относительно денег, тем меньше' });
  const maxSum = sum(parts, (p) => p.max);
  const health = { parts: parts.map((p) => ({ ...p, got: Math.round(p.got) })), score: maxSum ? Math.round((parts.reduce((s, p) => s + p.got, 0) / maxSum) * 100) : null };

  // прогноз: только для периода, который идёт сейчас
  let forecast = null;
  if (today >= period.from && today < period.to && elapsed) {
    const left = daysIn(today, period.to) - 1;
    const total = r2(t.exp + perDayUsual * left);
    forecast = { left, total, rest: r2(t.inc - total), perDay: left ? r2(Math.max(0, t.inc - t.exp) / left) : null, usual: r2(perDayUsual) };
  }
  const upcoming = raw.recurring.map((p) => ({ name: p.name, amount: Number(p.amount), date: p.next_date }))
    .filter((p) => p.date >= today && p.date <= addDays(today, 30)).sort((x, y) => (x.date < y.date ? -1 : 1));

  // выводы
  const money = (v) => Math.round(v).toLocaleString('ru-RU') + ' ₴';
  const notes = [];
  if (comparable && pt.exp > 0) { const c = change(t.exp, pt.exp); notes.push({ tone: c > 0 ? 'bad' : 'good', text: c === 0 ? `Расходы как ${prevLabel}` : `Расходы на ${Math.abs(c)}% ${c > 0 ? 'выше' : 'ниже'}, чем ${prevLabel}` }); }
  if (comparable) cats.map((c) => ({ ...c, diff: c.value - c.prev })).filter((c) => c.diff > Math.max(300, t.exp * 0.03)).sort((x, y) => y.diff - x.diff).slice(0, 3)
    .forEach((c) => notes.push({ tone: 'bad', text: `${c.name}: на ${money(c.diff)} больше, чем ${prevLabel}` }));
  if (comparable) cats.map((c) => ({ ...c, diff: c.prev - c.value })).filter((c) => c.diff > Math.max(300, t.exp * 0.03)).sort((x, y) => y.diff - x.diff).slice(0, 2)
    .forEach((c) => notes.push({ tone: 'good', text: `${c.name}: на ${money(c.diff)} меньше, чем ${prevLabel}` }));
  if (plan.over > 0) notes.push({ tone: 'bad', text: `Перерасход плана ${money(plan.over)}: ${planned.filter((p) => p.left < 0).sort((x, y) => x.left - y.left).slice(0, 3).map((p) => p.name).join(', ')}` });
  if (plan.any && plan.off > 0) notes.push({ tone: 'warn', text: `Траты вне плана: ${money(plan.off)}` });
  const un = sum(cats.filter((c) => !c.id || /^uncategorized/i.test(c.name)), (c) => c.value);
  if (un > 0) notes.push({ tone: 'warn', text: `Без категории ${money(un)}: разбери их, чтобы отчёт был точнее` });
  if (opt > 0 && t.exp > 0) notes.push({ tone: 'warn', text: `Необязательные траты ${pctOf(opt, t.exp)}%: сокращение на пятую часть сберегло бы ${money(opt * 0.2)}` });
  if (topDay) notes.push({ tone: 'info', text: `Самый дорогой день ${ruDate(topDay.day)}: ${money(topDay.value)}` });
  if (upcoming.length) notes.push({ tone: 'info', text: `Платежи за 30 дней: ${upcoming.length} на ${money(sum(upcoming, (p) => p.amount))}` });

  const ops = raw.ops.filter((o) => { const d = dayKey(o.date); return d >= period.from && d <= period.to; }).map((o) => {
    const e = linked.get(o.id);
    return { ...o, memo: e ? `вычтен из списания от ${ruDate(dayKey(e.date))}` : back.has(o.id) ? `возвращено ${back.get(o.id).toLocaleString('ru-RU')} ₴` : '' };
  });

  return {
    period, today, first, partial: period.from < first, empty: !cur.length,
    ...t, saldo, rate, comparable, prevLabel,
    prev: comparable ? { ...pt, saldo: r2(pt.inc - pt.exp), from: pq.from, to: pq.to } : null,
    expChange: comparable ? change(t.exp, pt.exp) : null, incChange: comparable ? change(t.inc, pt.inc) : null,
    avgDay: elapsed ? r2(t.exp / elapsed) : 0,
    savings, cats, mand, opt, merchants, big, sources, incCats, months, days, topDay, weekdays, plan,
    accounts: { homeTotal, cardsCash, envs, list, foreign, debts, debtUah, debtKnown }, capital,
    health, forecast, upcoming, notes, ops
  };
}
