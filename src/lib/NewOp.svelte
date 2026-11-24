<script>
  import { untrack } from 'svelte';
  import { no, closeNewOp } from './newop.svelte.js';
  import { peek, refresh, put } from './cache.svelte.js';
  import { loadAccounts, loadCategories, createAccount, saveOp, saveSplits, clearSplits, loadSplits, rememberRule } from './data.js';
  import { prefetchAll } from './prefetch.js';
  import { fmt } from './format.js';
  import Sheet from './Sheet.svelte';
  import SwipeRow from './SwipeRow.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import Icon from './Icon.svelte';
  import { envIcon } from './icons.js';
  import CardFace from './CardFace.svelte';
  import { cardTheme } from './format.js';

  const TYPES = [['EXPENSE', 'Расход'], ['INCOME', 'Доход'], ['RETURN', 'Возврат'], ['TRANSFER', 'Перевод']];
  const SYM = { UAH: '₴', USD: '$', EUR: '€' };
  let type = $state('EXPENSE'), note = $state(''), amt = $state(''), amt2 = $state('');
  let accId = $state(null), fromId = $state(null), toId = $state(null), catId = $state(null);
  let when = $state(''), split = $state(false), parts = $state([]), remember = $state(true);
  let debtId = $state(null), newName = $state(''), newCur = $state(null), payCur = $state(null), fxCur = $state(null), rateIn = $state(null), pendDebt = $state(null);
  const CUR = ['UAH', 'USD', 'EUR'];
  // свежие данные держим и локально: если кэш создали до загрузки, окно всё равно обновится
  let accLive = $state(null), catLive = $state(null);
  const acctData = () => accLive ?? peek('accounts');
  const catData = () => catLive ?? peek('cats');
  let busy = $state(false), ok = $state(false), err = $state(''), menu = $state(null), fsEdit = $state(null);

  const accs = $derived.by(() => {
    const d = acctData();
    if (!d) return [];
    const l = [];
    const add = (a, grp, icon, currency) => l.push({ id: a.id, name: a.name, currency: currency || a.currency || 'UAH', grp, icon, mono: !!a.mono });
    for (const a of d.cards) add(a, 'Карты и наличные', 'card');
    for (const a of d.cashes) add(a, 'Карты и наличные', /cash/i.test(a.name) ? 'cash' : 'wallet');
    for (const a of d.envs) add(a, 'Конверты', envIcon(a.name));
    for (const g of d.foreign ?? []) for (const a of g.list ?? []) add(a, 'Валютные', g.currency === 'EUR' ? 'euro' : 'dollar', g.currency);
    for (const x of d.debts ?? []) add(x, 'Долги', 'user', x.currency);
    return l;
  });
  const groups = $derived.by(() => {
    const m = new Map();
    for (const a of pool) { if (!m.has(a.grp)) m.set(a.grp, []); m.get(a.grp).push(a); }
    return [...m].map(([t, l]) => ({ t, l }));
  });
  const cats = $derived((catData()?.list ?? []).filter((c) => (type === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE' && (type !== 'RETURN' || !c.debt))));
  const plainCats = $derived(cats.filter((c) => !c.debt && c.name !== 'FX income'));
  const acc = (id) => accs.find((a) => a.id === id);
  const num = (v) => Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0;
  const total = $derived(num(amt));
  // первая часть — основная: из неё вычитаются остальные; если поправить её, меняется сумма операции
  const rest = $derived(parts.slice(1).reduce((t, p) => t + num(p.s), 0));
  const first = $derived(Math.max(0, +(total - rest).toFixed(2)));
  const eff = $derived(parts.map((p, i) => ({ id: p.id, v: i === 0 ? first : num(p.s) })));
  const left = $derived(+(total - eff.reduce((t, p) => t + p.v, 0)).toFixed(2));
  const isTr = $derived(type === 'TRANSFER');
  const debts = $derived(acctData()?.debts ?? []);
  const debt = $derived(debts.find((d) => d.id === debtId) ?? null);
  const mode = $derived.by(() => {
    // обычную операцию (в т.ч. «Начальный остаток» по долгу) при правке не превращаем в долговой перевод
    if (isTr || split || (no.edit && no.edit.action !== 'TRANSFER')) return 'op';
    const c = cats.find((x) => x.id === catId);
    if (c?.debt) return type === 'INCOME' ? 'taken' : type === 'EXPENSE' ? 'repay' : 'op';
    return c?.name === 'FX income' && type === 'INCOME' ? 'fxin' : 'op';
  });
  const debtC = $derived(debtId === 'new' ? newCur : debt?.currency ?? null);
  const payC = $derived(payCur ?? debt?.currency ?? 'UAH');
  const fxC = $derived(fxCur ?? 'USD');
  // какие счета можно выбрать: долговые — только через строку «Долг»; для погашения и валютного дохода — по валюте
  const pool = $derived.by(() => {
    const inEdit = (a) => !!no.edit && [no.edit.account_id, no.edit.from_account_id, no.edit.to_account_id].includes(a.id);
    // карты Monobank — только для возврата и перевода; в расходе и доходе их нет
    const keep = (a) => (a.grp !== 'Долги' || inEdit(a)) && (!a.mono || type === 'RETURN' || type === 'TRANSFER' || inEdit(a));
    const base = accs.filter(keep);
    if (mode === 'repay') return base.filter((a) => a.currency === payC);
    if (mode === 'fxin') return base.filter((a) => a.grp === 'Валютные' && a.currency === fxC);
    return base;
  });
  const cur = $derived(isTr ? acc(fromId)?.currency ?? 'UAH' : mode === 'taken' ? debtC ?? acc(accId)?.currency ?? 'UAH' : mode === 'repay' ? payC : mode === 'fxin' ? fxC : acc(accId)?.currency ?? 'UAH');
  const cur2 = $derived(acc(toId)?.currency ?? 'UAH');
  const fxFrom = $derived(cur);
  const fxTo = $derived(isTr ? cur2 : mode === 'taken' ? acc(accId)?.currency ?? null : mode === 'repay' ? debtC : null);
  const fx = $derived(!!fxTo && fxFrom !== fxTo && (isTr || mode === 'taken' || mode === 'repay'));
  const rateVal = $derived(total > 0 && num(amt2) > 0 ? (fxFrom === 'UAH' ? total / num(amt2) : num(amt2) / total) : 0);
  const covered = $derived(fx ? num(amt2) : total);
  const l2 = $derived(mode === 'taken' ? 'Получено на счёт' : mode === 'repay' ? 'Покроет' : 'Зачислится');
  const l1 = $derived(mode === 'taken' ? 'Долг' : mode === 'repay' ? 'Платите' : 'Отдаёшь');
  const dn = (v, c) => `${fmt(v, v % 1 ? 2 : 0)} ${SYM[c] ?? c}`;
  const debtInfo = $derived.by(() => {
    if (!debt || !(total > 0)) return '';
    if (mode === 'taken') return `−${dn(debt.amount, debt.currency)} → −${dn(debt.amount + total, debt.currency)}`;
    if (mode === 'repay') { const r = Math.max(0, +(debt.amount - covered).toFixed(2)); return r ? `−${dn(debt.amount, debt.currency)} → −${dn(r, debt.currency)}` : `−${dn(debt.amount, debt.currency)} → долг закрыт`; }
    return '';
  });
  const fmtRate = (v) => String(+v.toFixed(v < 1 ? 4 : 2)).replace('.', ',');
  function recalc() {
    const r = num(rateIn ?? '');
    if (rateIn == null || !(r > 0) || !(total > 0)) return;
    amt2 = fmtIn(fxFrom === 'UAH' ? total / r : total * r);
  }
  const title = $derived(no.edit ? 'Изменить операцию' : 'Новая операция');
  const localInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

  $effect(() => {
    if (!no.open) return;
    // зависим только от параметров открытия; всё остальное — вне отслеживания, иначе смена счёта сбрасывает форму
    const src = { edit: no.edit, type: no.type, acc: no.acc };
    untrack(() => init(src));
  });
  function init(no) {
    busy = false; ok = false; err = ''; split = false; parts = []; remember = true; menu = null; fsEdit = null;
    debtId = null; newName = ''; newCur = null; payCur = null; fxCur = null; rateIn = null; pendDebt = null;
    refresh('accounts', loadAccounts).then((d) => (accLive = d)).catch(() => {});
    refresh('cats', loadCategories).then((d) => (catLive = d)).catch(() => {});
    const e = no.edit;
    if (e) {
      type = e.action; note = e.note || ''; amt = String(e.amount).replace('.', ','); amt2 = e.to_amount != null ? String(e.to_amount).replace('.', ',') : '';
      accId = e.account_id; fromId = e.from_account_id; toId = e.to_account_id; catId = e.category_id; when = localInput(e.date);
      const dc = e.action === 'TRANSFER' ? untrack(() => catData()?.list ?? []).find((c) => c.id === e.category_id && c.debt) : null;
      if (dc) { // перевод по долгу: «взял» (из долга на счёт) или «гашу» (со счёта на долг)
        type = dc.type;
        if (dc.type === 'INCOME') { debtId = e.from_account_id; accId = e.to_account_id; } else { debtId = e.to_account_id; accId = e.from_account_id; payCur = e.currency; }
      }
      if (e.splits) loadSplits(e.id).then((x) => { parts = x.map((p, i) => ({ id: p.category_id, s: i === 0 ? '' : String(p.amount).replace('.', ',') })); split = true; }).catch(() => {});
    } else {
      type = no.type ?? 'EXPENSE'; note = ''; amt = ''; amt2 = ''; catId = null; when = localInput(new Date());
      const last = Number(localStorage.getItem('aurum.lastAcc')) || null;
      let lp = null;
      try { lp = JSON.parse(localStorage.getItem('aurum.lastTransfer') || 'null'); } catch { /* пусто */ }
      // из счёта: он всегда первый («Откуда» в переводе, счёт в расходе и доходе); иначе — последний счёт и последняя пара перевода
      accId = no.acc ?? last;
      fromId = no.acc ?? lp?.from ?? accId;
      toId = lp?.to && lp.to !== fromId ? lp.to : null;
      // открыли из долга («Новая операция» / «Перевод» в меню долга) — сразу погашение этого долга
      if (no.acc && (acctData()?.debts ?? []).some((d) => d.id === no.acc)) { type = 'EXPENSE'; debtId = no.acc; pendDebt = no.acc; accId = null; fromId = null; }
    }
  }
  // категорию «Debt repayment» подставляем, когда категории загрузились
  $effect(() => {
    if (!no.open || !pendDebt) return;
    const c = (catData()?.list ?? []).find((x) => x.debt && x.type === 'EXPENSE');
    if (c) { catId = c.id; pendDebt = null; }
  });
  // долг по умолчанию: первый из списка (или «Новый», если долгов нет)
  $effect(() => {
    if (!no.open) return;
    if (mode === 'taken' && debtId == null) debtId = debts[0]?.id ?? 'new';
    if (mode === 'repay' && (debtId == null || debtId === 'new') && debts.length) debtId = debts[0].id;
  });
  // счёт должен подходить: валюта платежа / валютный доход
  $effect(() => {
    if (!no.open || isTr || !pool.length) return;
    if (!pool.some((a) => a.id === accId)) accId = pool[0].id;
  });
  // когда счета загрузились — подставим счёт по умолчанию
  $effect(() => {
    if (!no.open || !accs.length) return;
    if (!acc(accId) && !pendDebt) accId = (pool.find((a) => a.name.toLowerCase().includes('cash')) ?? pool[0] ?? accs[0]).id;
    if (!acc(fromId)) fromId = accId ?? pool[0]?.id;
    if (!acc(toId) || toId === fromId) toId = (pool.find((a) => a.id !== fromId) ?? accs.find((a) => a.id !== fromId) ?? accs[0]).id;
  });

  function setType(t) { type = t; catId = null; menu = null; debtId = null; rateIn = null; if (t === 'TRANSFER') split = false; }
  const pickAcc = (id) => { accId = id; menu = null; };
  const pickFrom = (id) => { if (id === toId) toId = fromId; fromId = id; menu = null; };
  const pickTo = (id) => { if (id === fromId) fromId = toId; toId = id; menu = null; };
  const pickDebt = (id) => { debtId = id; payCur = null; err = ''; };
  const swap = () => { [fromId, toId] = [toId, fromId]; };
  const fmtIn = (v) => (v ? String(+v.toFixed(2)).replace('.', ',') : '');
  function openSplit() { split = !split; err = ''; if (split) parts = [{ id: catId, s: '' }, { id: null, s: '' }]; else if (parts[0]?.id) catId = parts[0].id; }
  const catOf = (id) => cats.find((c) => c.id === id);

  const catName = $derived(split ? 'Несколько категорий' : catOf(catId)?.name ?? 'Выбери категорию');
  const heroIcon = $derived((split ? catOf(parts[0]?.id) : catOf(catId))?.icon ?? 'tag');
  const kind = $derived(TYPES.find((t) => t[0] === type)[1].toUpperCase());
  const theme = $derived(type === 'TRANSFER' ? null : cardTheme(acc(accId)?.name));
  // что не так — подсказываем текстом при нажатии «Сохранить», как в старом приложении
  const problem = $derived.by(() => {
    if (!(total > 0)) return 'Введи сумму больше нуля.';
    if (type === 'TRANSFER') {
      if (!fromId || !toId) return 'Выбери оба счёта.';
      if (fromId === toId) return 'Счета перевода должны отличаться.';
      if (fx && !(num(amt2) > 0)) return 'Укажи, сколько зачислится.';
      return '';
    }
    if (mode === 'taken') {
      if (!debtId) return 'Выбери, у кого взяли.';
      if (debtId === 'new' && !newName.trim()) return 'Укажи, у кого взяли.';
      if (!debtC) return 'Выберите валюту долга';
      if (!accId) return 'Выбери счёт.';
      if (fx && !(num(amt2) > 0)) return 'Укажи, сколько зачислится на счёт.';
      return '';
    }
    if (mode === 'repay') {
      if (!debt) return 'Выбери долг.';
      if (!accId) return 'Нет счёта в этой валюте.';
      if (accId === debt.id) return 'Нельзя гасить долг с самого долга.';
      if (fx && !(num(amt2) > 0)) return 'Укажи, сколько покроет.';
      if (covered > debt.amount + 0.005) return 'Платёж больше долга.';
      return '';
    }
    if (mode === 'fxin' && !accId) return 'Нет валютного счёта в этой валюте.';
    if (!accId) return 'Выбери счёт.';
    if (split) {
      if (parts.length < 2 || eff.some((p) => !p.id || !(p.v > 0))) return 'Добавь минимум две категории с суммами.';
      if (left !== 0) return 'Сумма частей не равна сумме операции.';
      return '';
    }
    return catId ? '' : 'Выбери категорию.';
  });

  async function save() {
    if (busy || ok) return;
    if (problem) { err = problem; return; }
    busy = true; err = '';
    try {
      let f;
      if (mode === 'taken' || mode === 'repay') {
        let did = debtId;
        if (did === 'new') did = await createAccount({ type: 'debt', name: newName.trim(), icon: 'user', currency: newCur, budgetSource: false, balance: 0 });
        const tk = mode === 'taken';
        f = { action: 'TRANSFER', amount: total, note: note.trim(), date: new Date(when).toISOString(), category_id: catId, currency: cur,
          account_id: null, from_account_id: tk ? did : accId, to_account_id: tk ? accId : did, to_amount: fx ? num(amt2) : null, rate: fx ? +(num(amt2) / total).toFixed(6) : null };
      } else f = { action: type, amount: total, note: note.trim(), date: new Date(when).toISOString(), category_id: split ? [...eff].sort((a, b) => b.v - a.v)[0].id : catId, currency: cur,
        account_id: accId, from_account_id: fromId, to_account_id: toId, to_amount: fx ? num(amt2) : null, rate: fx ? +(num(amt2) / total).toFixed(6) : null };
      const id = await saveOp(no.edit?.id, f);
      if (split) await saveSplits(id, total, eff.map((p) => ({ category_id: p.id, amount: +p.v.toFixed(2) })));
      else if (no.edit?.splits) await clearSplits(id);
      if (!split && remember && catId && note.trim() && type !== 'TRANSFER' && mode === 'op') await rememberRule(type, note.trim(), catId);
      if (type !== 'TRANSFER' && mode !== 'taken' && accId) localStorage.setItem('aurum.lastAcc', String(accId));
      // пару перевода запоминаем, если операцию открыли не из счёта
      if (type === 'TRANSFER' && !no.acc && !no.edit) localStorage.setItem('aurum.lastTransfer', JSON.stringify({ from: fromId, to: toId }));
      ok = true; prefetchAll(true);
      setTimeout(closeNewOp, 850);
    } catch (e) { err = e.message || 'Не удалось сохранить'; busy = false; }
  }
</script>

{#snippet list(cur, pick, side)}
  <div class="mn {side}" role="listbox">
    {#each groups as g (g.t)}
      <h6>{g.t}</h6>
      {#each g.l as a (a.id)}
        <button class="mi" class:on={a.id === cur} role="option" aria-selected={a.id === cur} onclick={() => pick(a.id)}>
          <Icon name={a.icon} size={19} /><span>{a.name}</span>{#if a.id === cur}<i class="ck"><Icon name="check" size={17} /></i>{/if}
        </button>
      {/each}
    {/each}
  </div>
{/snippet}

<Sheet open={no.open} onclose={closeNewOp} fit {title} z={57}>
  <div class="bd" class:in={no.open}>
    {#if menu}<button class="mb" aria-label="Закрыть список" onclick={() => (menu = null)}></button>{/if}
    <div class="seg" style:--n={TYPES.findIndex((t) => t[0] === type)}>
      <i class="pl"></i>
      {#each TYPES as t (t[0])}<button class:on={type === t[0]} onclick={() => setType(t[0])}>{t[1]}</button>{/each}
    </div>

    <CardFace {theme} {kind}>
      {#snippet amount()}
        <div class="big"><input inputmode="decimal" placeholder="0" style:width="{Math.max(1, (amt || '0').length)}ch" bind:value={amt} oninput={() => { err = ''; recalc(); }} /><u>{SYM[cur] ?? cur}</u></div>
      {/snippet}
      {#snippet chip()}
        {#if !isTr}<div class="ct"><OpAvatar icon={heroIcon} size={34} /><span>{catName}</span></div>{/if}
      {/snippet}
      {#snippet acct()}
        {#if type === 'TRANSFER'}
          <div class="dw">
            <button class="dd" class:o={menu === 'from'} onclick={() => (menu = menu === 'from' ? null : 'from')}><small>Откуда</small><span><b>{acc(fromId)?.name ?? '…'}</b><Icon name="chevron" size={14} /></span></button>
            {#if menu === 'from'}{@render list(fromId, pickFrom, 'l')}{/if}
          </div>
          <button class="sw" aria-label="Поменять счета местами" onclick={swap}><Icon name="swap" size={22} /></button>
          <div class="dw">
            <button class="dd" class:o={menu === 'to'} onclick={() => (menu = menu === 'to' ? null : 'to')}><small>Куда</small><span><b>{acc(toId)?.name ?? '…'}</b><Icon name="chevron" size={14} /></span></button>
            {#if menu === 'to'}{@render list(toId, pickTo, 'r')}{/if}
          </div>
        {:else}
          <div class="dw">
            <button class="dd" class:o={menu === 'acc'} onclick={() => (menu = menu === 'acc' ? null : 'acc')}><small>{type === 'INCOME' || type === 'RETURN' ? 'На счёт' : 'Со счёта'}</small><span><b>{acc(accId)?.name ?? '…'}</b><Icon name="chevron" size={14} /></span></button>
            {#if menu === 'acc'}{@render list(accId, pickAcc, theme ? 'l' : 'r')}{/if}
          </div>
        {/if}
      {/snippet}
    </CardFace>

    {#if !isTr && !split}
      <div class="lb">Категория</div>
      <div class="rb">
        {#each cats as c (c.id)}<button class="cc" class:on={catId === c.id} onclick={() => { catId = c.id; err = ''; }}><span><Icon name={c.icon} size={19} /></span>{c.name}</button>{/each}
      </div>
    {/if}

    {#if mode === 'taken' || mode === 'repay'}
      <div class="lb">{mode === 'taken' ? 'У кого взяли' : 'Какой долг гасите'}</div>
      <div class="ch">
        {#each debts as d (d.id)}<button class="pp" class:on={debtId === d.id} onclick={() => pickDebt(d.id)}>{d.name} · {SYM[d.currency] ?? d.currency}</button>{/each}
        {#if mode === 'taken'}<button class="pp" class:on={debtId === 'new'} onclick={() => { debtId = 'new'; err = ''; }}>＋ Новый</button>{/if}
      </div>
      {#if debtId === 'new'}
        <div class="rows"><label class="rr"><span>Имя</span><input class="tx" placeholder="Например, Nana" bind:value={newName} oninput={() => (err = '')} /></label></div>
        <div class="lb">Валюта долга</div>
        <div class="ch">{#each CUR as c (c)}<button class="pp" class:on={newCur === c} onclick={() => { newCur = c; err = ''; }}>{SYM[c]} {c}</button>{/each}</div>
      {/if}
      {#if mode === 'repay'}
        <div class="lb">В какой валюте платите</div>
        <div class="ch">{#each CUR as c (c)}<button class="pp" class:on={payC === c} onclick={() => { payCur = c; rateIn = null; err = ''; }}>{SYM[c]} {c}</button>{/each}</div>
      {/if}
    {:else if mode === 'fxin'}
      <div class="lb">Валюта</div>
      <div class="ch">{#each ['USD', 'EUR'] as c (c)}<button class="pp" class:on={fxC === c} onclick={() => { fxCur = c; err = ''; }}>{SYM[c]} {c}</button>{/each}</div>
    {/if}

    <div class="rows">
      {#if fx}
        <div class="fp">
          <div><small>{l1}, {SYM[fxFrom] ?? fxFrom}</small><b>{total > 0 ? fmt(total, 2) : '0'}</b></div>
          <i>→</i>
          <label><small>{l2}, {SYM[fxTo] ?? fxTo}</small><input inputmode="decimal" placeholder="0" bind:value={amt2} oninput={() => { rateIn = null; err = ''; }} /></label>
        </div>
        <label class="rr"><span>Курс{fxFrom === 'UAH' || fxTo === 'UAH' ? `, ₴ за ${SYM[fxFrom === 'UAH' ? fxTo : fxFrom]}` : ''}</span>
          <input inputmode="decimal" placeholder="0" value={rateIn ?? (rateVal ? fmtRate(rateVal) : '')} oninput={(e) => { rateIn = e.currentTarget.value; recalc(); }} /></label>
      {/if}
      {#if debtInfo}<div class="rr"><span>Долг {debt?.name}</span><b class="di">{debtInfo}</b></div>{/if}
      <label class="rr"><span>Дата</span><input type="datetime-local" bind:value={when} /></label>
      <label class="rr"><span>Заметка</span><input class="tx" placeholder={type === 'TRANSFER' ? 'Заметка к переводу' : 'Магазин или заметка'} bind:value={note} /></label>
      {#if type !== 'TRANSFER'}
        {#if !split && mode === 'op'}<button class="rr" onclick={() => (remember = !remember)}><span>Запомнить для этой категории</span><i class="tg" class:on={remember}></i></button>{/if}
        {#if mode === 'op'}<button class="rr" onclick={openSplit}><span>Разделить</span><i class="tg" class:on={split}></i></button>{/if}
      {/if}
    </div>

    {#if split}
      <div class="lb">Категории операции</div>
      <div class="sbar">{#each eff as p}<i style:width="{total > 0 ? Math.min(100, p.v / total * 100) : 0}%"></i>{/each}</div>
      <div class="sleft"><span>Сумма {fmt(total, 2)} {SYM[cur] ?? cur}</span><b class:ok={total > 0 && left === 0}>{total > 0 && left === 0 ? 'Сходится' : left < 0 ? `Больше на ${fmt(-left, 2)}` : `Осталось ${fmt(left, 2)}`}</b></div>
      <div class="rows">
        {#each parts as p, i (i)}
          <SwipeRow id={'sp' + i} norepeat dconfirm={false} nodelete={i === 0 || parts.length <= 2} ondelete={() => (parts = parts.filter((_, k) => k !== i))}>
          <div class="pt" class:nx={i > 0}>
            <label class="pc"><span class="pi"><Icon name={catOf(p.id)?.icon ?? 'tag'} size={17} /></span><span class="pn" class:ph={!p.id}>{catOf(p.id)?.name ?? 'Категория'}</span>
              <select value={p.id ?? 0} onchange={(e) => { parts[i].id = Number(e.currentTarget.value) || null; err = ''; }}><option value={0}>Категория</option>{#each plainCats as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</select></label>
            {#if i === 0}
              <input class="pa main" inputmode="decimal" placeholder="0" value={fsEdit ?? (first ? fmt(first, 2) : '')}
                onfocus={() => (fsEdit = fmtIn(first))}
                oninput={(e) => { fsEdit = e.currentTarget.value; amt = fmtIn(+(rest + num(e.currentTarget.value)).toFixed(2)); err = ''; }}
                onblur={() => (fsEdit = null)} />
            {:else}<input class="pa" inputmode="decimal" placeholder="0" bind:value={parts[i].s} oninput={() => (err = '')} />{/if}
          </div>
          </SwipeRow>
        {/each}
        <button class="add" onclick={() => (parts = [...parts, { id: null, s: '' }])}>+ Добавить категорию</button>
      </div>
    {/if}
  </div>
  {#snippet footer()}
    {#if err}<p class="er">{err}</p>{/if}
    <div class="gw"><button class="go" class:ok disabled={busy && !ok} onclick={save}>
      <span class="t">{busy && !ok ? 'Сохраняю…' : no.edit ? 'Сохранить изменения' : 'Сохранить'}</span>
      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </button>{#if ok}<i class="rg"></i>{/if}</div>
  {/snippet}
</Sheet>

<style>
  .bd { padding: 0 12px 14px; }
  .bd.in .seg, .bd.in :global(.cf), .bd.in .lb, .bd.in .rb, .bd.in .rows { animation: rise .55s cubic-bezier(.2, .9, .3, 1) both; }
  .bd.in :global(.cf) { animation-delay: .06s; } .bd.in .lb { animation-delay: .12s; } .bd.in .rb { animation-delay: .16s; } .bd.in .rows { animation-delay: .22s; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  .seg { position: relative; display: flex; padding: 2px; border-radius: 11px; background: var(--fill); margin: 0 0 18px; }
  .seg .pl { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 4); border-radius: 9px; background: linear-gradient(180deg, #F2D58F, #CD9A3A); transform: translateX(calc(var(--n) * 100%)); transition: transform .4s cubic-bezier(.3, 1.3, .5, 1); }
  .seg button { position: relative; z-index: 1; flex: 1; padding: 7px 0; font-size: 12.5px; font-weight: 600; color: var(--muted); transition: color .25s; }
  .seg button.on { color: #1a1206; }
  .mb { position: fixed; inset: 0; z-index: 2; width: 100%; background: none; }
  .mn { position: absolute; z-index: 6; top: calc(100% + 8px); width: 240px; max-height: 232px; overflow-y: auto; padding: 6px; border-radius: 18px; background: #201d18; box-shadow: 0 18px 40px rgba(0, 0, 0, .7), inset 0 0 0 .6px rgba(232, 194, 119, .28); transform-origin: top; animation: mn .22s cubic-bezier(.3, 1.2, .5, 1); }
  .mn.r { right: 0; } .mn.l { left: 0; }
  @keyframes mn { from { opacity: 0; transform: translateY(-6px) scale(.96); } }
  .mn h6 { margin: 0; padding: 8px 10px 4px; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #8e8a80; font-weight: 600; }
  .mi { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 12px; font-size: 15px; color: #f2e6c9; text-align: left; }
  .mi :global(svg:first-child) { color: #D9B66E; flex: none; }
  .mi span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mi.on { background: rgba(232, 194, 119, .13); color: #F4DDA6; font-weight: 600; }
  .ck { color: #EBC77A; display: grid; }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 14px 4px 6px; }
  .ch { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px 2px 0; }
  .pp { padding: 8px 14px; border-radius: 99px; background: var(--fill); color: var(--text); font-size: 14px; font-weight: 500; transition: background .2s, color .2s, transform .25s cubic-bezier(.3, 1.5, .5, 1); }
  .pp.on { background: linear-gradient(160deg, #F2D58F, #CD9A3A); color: #1a1206; font-weight: 600; transform: scale(1.04); }
  .fp { display: flex; align-items: center; gap: 10px; padding: 11px 14px; }
  .fp > div, .fp label { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .fp small { font-size: 11px; color: var(--muted); }
  .fp b, .fp input { font: inherit; font-size: 18px; font-weight: 600; color: var(--text); border: 0; outline: 0; background: none; padding: 0; width: 100%; }
  .fp i { color: var(--gold); font-style: normal; flex: none; }
  .di { font-weight: 600; font-size: 13.5px; color: var(--text); text-align: right; }
  .rb { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 8px 10px 4px; margin: 0 -10px; }
  .rb::-webkit-scrollbar { display: none; }
  .cc { flex: none; width: 66px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; line-height: 13px; color: var(--muted); text-align: center; }
  .cc span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: rgba(232, 194, 119, .1); color: var(--gold); transition: transform .25s cubic-bezier(.3, 1.5, .5, 1), background .2s, color .2s; }
  .cc.on { color: var(--text); font-weight: 600; } .cc.on span { background: linear-gradient(160deg, #F0CB82, #BE8C32); box-shadow: 0 4px 12px -4px rgba(226, 172, 62, .6); color: #fff; transform: scale(1.08); }
  .rows { margin-top: 12px; background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .rr { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 11px 14px; font-size: 14.5px; text-align: left; }
  .rr + .rr::before { content: ""; position: absolute; top: 0; left: 14px; right: 0; height: .5px; background: var(--line); }
  .rr input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--muted); font: inherit; font-size: 14px; text-align: right; }
  .rr input.tx { color: var(--text); font-size: 15px; -webkit-user-select: text; user-select: text; }
  .tg { flex: none; width: 51px; height: 31px; border-radius: 99px; background: rgba(120, 120, 128, .32); position: relative; transition: background .3s, box-shadow .3s; }
  .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .25); transition: transform .38s cubic-bezier(.3, 1.5, .5, 1), width .2s; }
  .tg.on { background: linear-gradient(180deg, #F2D58F, #D49E36); box-shadow: 0 0 14px -2px rgba(226, 172, 62, .55); } .tg.on::after { transform: translateX(20px); }
  .tg:active::after { width: 34px; } .tg.on:active::after { transform: translateX(13px); }
  .sbar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--fill); margin: 4px 2px 0; }
  .sbar i { background: linear-gradient(90deg, #C99A3C, #F0D18A); border-right: 1px solid var(--bg); transition: width .4s cubic-bezier(.32, .72, 0, 1); }
  .sleft { display: flex; justify-content: space-between; margin: 7px 4px 0; font-size: 12.5px; color: var(--muted); }
  .sleft b { font-weight: 600; color: #E5584D; transition: color .3s; } .sleft b.ok { color: var(--pos); }
  .pt { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
  .pt.nx::before { content: ""; position: absolute; top: 0; left: 14px; right: 0; height: .5px; background: var(--line); }
  .pc { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; }
  .pi { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: rgba(232, 194, 119, .1); color: var(--gold); }
  .pn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; font-weight: 600; } .pn.ph { color: var(--muted); font-weight: 400; }
  .pc select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font-size: 16px; }
  .pa { width: 96px; padding: 7px 10px; border: 0; outline: 0; border-radius: 10px; background: var(--fill); color: var(--text); font: inherit; font-size: 16px; font-weight: 600; text-align: right; -webkit-user-select: text; user-select: text; }
  .pa.main { color: var(--text); }
  .add { width: 100%; text-align: left; padding: 12px 14px; color: var(--gold); font-weight: 500; border-top: .5px solid var(--line); }
  .er { flex: none; margin: 6px 14px 0; font-size: 13px; color: #E5584D; text-align: center; }
  .gw { position: relative; flex: none; margin: 6px 12px calc(14px + var(--safe-b)); }
  .go { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 48px; color: #2A1D05; font-size: 16px; font-weight: 600; transition: opacity .2s; }
  .go::before, .go::after { content: ""; position: absolute; background: linear-gradient(#F4D48A, #D09A32); box-shadow: 0 8px 18px -8px rgba(226, 172, 62, .6); will-change: transform, opacity; transition: transform .5s cubic-bezier(.32, .72, 0, 1), opacity .3s ease; }
  .go::before { inset: 0; border-radius: 24px; background: linear-gradient(105deg, transparent 38%, rgba(255, 250, 225, .6) 50%, transparent 62%) no-repeat -120% 0 / 60% 100%, linear-gradient(#F4D48A, #D09A32); animation: shine 3.6s ease-in-out 1s infinite; }
  @keyframes shine { 0% { background-position: -120% 0, 0 0; } 45%, 100% { background-position: 220% 0, 0 0; } }
  .go::after { left: 50%; top: 0; width: 48px; height: 48px; margin-left: -24px; border-radius: 24px; opacity: 0; transform: scale(.5); }
  .go.ok::before { opacity: 0; transform: scaleX(.16); animation: none; }
  .go.ok::after { opacity: 1; transform: none; }
  .go .t { position: relative; z-index: 1; display: inline-block; white-space: nowrap; will-change: transform, opacity; transition: transform .4s cubic-bezier(.5, 0, .8, .4), opacity .25s .05s; }
  .go.ok .t { transform: rotate(90deg) scale(0); opacity: 0; }
  .go svg { position: absolute; z-index: 1; inset: 0; margin: auto; width: 26px; height: 26px; fill: none; stroke: #2A1D05; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 26; stroke-dashoffset: 26; opacity: 0; transform: rotate(-90deg) scale(.4); transition: transform .55s cubic-bezier(.2, .9, .3, 1.15) .2s, opacity .15s .2s, stroke-dashoffset .38s cubic-bezier(.4, 0, .2, 1) .38s; pointer-events: none; }
  .go.ok svg { opacity: 1; transform: none; stroke-dashoffset: 0; }
  .go:disabled:not(.ok) { opacity: .6; }
  .rg { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 2px solid #E3B95E; pointer-events: none; animation: ring .7s ease-out .6s both; }
  @keyframes ring { from { transform: scale(1); opacity: .8; } to { transform: scale(2.1); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .mn, .bd.in .seg, .bd.in :global(.cf), .bd.in .lb, .bd.in .rb, .bd.in .rows, .go::before { animation: none; } .seg .pl, .go, .go::before, .go::after, .go .t, .go svg, .rg { transition: none; animation: none; } }
</style>
