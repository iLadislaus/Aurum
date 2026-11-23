<script>
  import { no, closeNewOp } from './newop.svelte.js';
  import { peek, refresh, put } from './cache.svelte.js';
  import { loadAccounts, loadCategories, saveOp, saveSplits, clearSplits, loadSplits, rememberRule } from './data.js';
  import { prefetchAll } from './prefetch.js';
  import { fmt } from './format.js';
  import Sheet from './Sheet.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import Icon from './Icon.svelte';

  const TYPES = [['EXPENSE', 'Расход'], ['INCOME', 'Доход'], ['RETURN', 'Возврат'], ['TRANSFER', 'Перевод']];
  const SYM = { UAH: '₴', USD: '$', EUR: '€' };
  let type = $state('EXPENSE'), note = $state(''), amt = $state(''), amt2 = $state('');
  let accId = $state(null), fromId = $state(null), toId = $state(null), catId = $state(null);
  let when = $state(''), split = $state(false), parts = $state([]), remember = $state(true);
  let busy = $state(false), ok = $state(false), err = $state('');

  const accs = $derived.by(() => {
    const d = peek('accounts');
    if (!d) return [];
    const l = [...d.cards, ...d.cashes, ...d.envs].map((a) => ({ id: a.id, name: a.name, currency: a.currency || 'UAH' }));
    for (const g of d.foreign ?? []) for (const a of g.list ?? []) l.push({ id: a.id, name: a.name, currency: g.currency });
    return l;
  });
  const cats = $derived((peek('cats')?.list ?? []).filter((c) => (type === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE')));
  const acc = (id) => accs.find((a) => a.id === id);
  const num = (v) => Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0;
  const total = $derived(num(amt));
  // как в старом: первая часть сама добирает остаток, остальные вводятся руками
  const rest = $derived(parts.slice(1).reduce((t, p) => t + (Number(p.v) || 0), 0));
  const first = $derived(Math.max(0, +(total - rest).toFixed(2)));
  const eff = $derived(parts.map((p, i) => ({ id: p.id, v: i === 0 ? first : Number(p.v) || 0 })));
  const left = $derived(+(total - eff.reduce((t, p) => t + p.v, 0)).toFixed(2));
  const cur = $derived(type === 'TRANSFER' ? acc(fromId)?.currency ?? 'UAH' : acc(accId)?.currency ?? 'UAH');
  const cur2 = $derived(acc(toId)?.currency ?? 'UAH');
  const fx = $derived(type === 'TRANSFER' && cur !== cur2);
  const title = $derived(no.edit ? 'Изменить операцию' : 'Новая операция');
  const localInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

  $effect(() => {
    if (!no.open) return;
    busy = false; ok = false; err = ''; split = false; parts = []; remember = true;
    refresh('accounts', loadAccounts).catch(() => {});
    refresh('cats', loadCategories).catch(() => {});
    const e = no.edit;
    if (e) {
      type = e.action; note = e.note || ''; amt = String(e.amount).replace('.', ','); amt2 = e.to_amount != null ? String(e.to_amount).replace('.', ',') : '';
      accId = e.account_id; fromId = e.from_account_id; toId = e.to_account_id; catId = e.category_id; when = localInput(e.date);
      if (e.splits) loadSplits(e.id).then((x) => { parts = x.map((p, i) => ({ id: p.category_id, v: i === 0 ? 0 : p.amount })); split = true; }).catch(() => {});
    } else {
      type = 'EXPENSE'; note = ''; amt = ''; amt2 = ''; catId = null; when = localInput(new Date());
      const last = Number(localStorage.getItem('aurum.lastAcc')) || null;
      accId = last; fromId = last; toId = null;
    }
  });
  // когда счета загрузились — подставим счёт по умолчанию
  $effect(() => {
    if (!no.open || !accs.length) return;
    if (!acc(accId)) accId = (accs.find((a) => a.name.toLowerCase().includes('cash')) ?? accs[0]).id;
    if (!acc(fromId)) fromId = accId;
    if (!acc(toId)) toId = (accs.find((a) => a.id !== fromId) ?? accs[0]).id;
  });

  function setType(t) { type = t; catId = null; if (t === 'TRANSFER') split = false; }
  function openSplit() { split = !split; err = ''; if (split) parts = [{ id: catId, v: 0 }, { id: null, v: 0 }]; else if (parts[0]?.id) catId = parts[0].id; }
  const catOf = (id) => cats.find((c) => c.id === id);

  const sub = $derived(type === 'TRANSFER' ? 'между своими счетами' : (split ? catOf(parts[0]?.id) : catOf(catId))?.name ?? 'выбери категорию');
  const heroIcon = $derived(type === 'TRANSFER' ? 'swap' : (split ? catOf(parts[0]?.id) : catOf(catId))?.icon ?? 'tag');
  // что не так — подсказываем текстом при нажатии «Сохранить», как в старом приложении
  const problem = $derived.by(() => {
    if (!(total > 0)) return 'Введи сумму больше нуля.';
    if (type === 'TRANSFER') {
      if (!fromId || !toId) return 'Выбери оба счёта.';
      if (fromId === toId) return 'Счета перевода должны отличаться.';
      if (fx && !(num(amt2) > 0)) return 'Укажи, сколько зачислится.';
      return '';
    }
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
      const f = { action: type, amount: total, note: note.trim(), date: new Date(when).toISOString(), category_id: split ? [...eff].sort((a, b) => b.v - a.v)[0].id : catId, currency: cur,
        account_id: accId, from_account_id: fromId, to_account_id: toId, to_amount: fx ? num(amt2) : null, rate: fx ? +(num(amt2) / total).toFixed(6) : null };
      const id = await saveOp(no.edit?.id, f);
      if (split) await saveSplits(id, total, eff.map((p) => ({ category_id: p.id, amount: +p.v.toFixed(2) })));
      else if (no.edit?.splits) await clearSplits(id);
      if (!split && remember && catId && note.trim() && type !== 'TRANSFER') await rememberRule(type, note.trim(), catId);
      if (type !== 'TRANSFER' && accId) localStorage.setItem('aurum.lastAcc', String(accId));
      ok = true; prefetchAll(true);
      setTimeout(closeNewOp, 850);
    } catch (e) { err = e.message || 'Не удалось сохранить'; busy = false; }
  }
</script>

<Sheet open={no.open} onclose={closeNewOp} fit {title} z={57}>
  <div class="bd">
    <div class="seg" style:--n={TYPES.findIndex((t) => t[0] === type)}>
      <i class="pl"></i>
      {#each TYPES as t (t[0])}<button class:on={type === t[0]} onclick={() => setType(t[0])}>{t[1]}</button>{/each}
    </div>

    <div class="hero">
      <div class="who">
        <OpAvatar icon={heroIcon} size={44} />
        <div class="wn"><input class="nm" placeholder={type === 'TRANSFER' ? 'Заметка к переводу' : 'Название или магазин'} bind:value={note} /><small>{sub}</small></div>
      </div>
      <div class="big"><input inputmode="decimal" placeholder="0" bind:value={amt} oninput={() => (err = '')} /><u>{SYM[cur] ?? cur}</u></div>
      {#if type === 'TRANSFER'}
        <div class="pills">
          <label class="pill"><span>{acc(fromId)?.name ?? 'Откуда'} ▾</span><select bind:value={fromId}>{#each accs as a (a.id)}<option value={a.id}>{a.name}</option>{/each}</select></label>
          <b>→</b>
          <label class="pill"><span>{acc(toId)?.name ?? 'Куда'} ▾</span><select bind:value={toId}>{#each accs as a (a.id)}<option value={a.id}>{a.name}</option>{/each}</select></label>
        </div>
        {#if fx}<div class="big sm"><input inputmode="decimal" placeholder="Зачислено" bind:value={amt2} /><u>{SYM[cur2] ?? cur2}</u></div>{/if}
      {:else}
        <div class="pills"><label class="pill"><span>{type === 'INCOME' || type === 'RETURN' ? 'На счёт' : 'Со счёта'}: {acc(accId)?.name ?? '…'} ▾</span><select bind:value={accId}>{#each accs as a (a.id)}<option value={a.id}>{a.name}</option>{/each}</select></label></div>
      {/if}
    </div>

    {#if type !== 'TRANSFER' && !split}
      <div class="lb">Категория</div>
      <div class="rb">
        {#each cats as c (c.id)}<button class="cc" class:on={catId === c.id} onclick={() => { catId = c.id; err = ''; }}><span><Icon name={c.icon} size={19} /></span>{c.name}</button>{/each}
      </div>
    {/if}

    <div class="rows">
      <label class="rr"><span>Дата</span><input type="datetime-local" bind:value={when} /></label>
      {#if type !== 'TRANSFER'}
        <button class="rr" onclick={openSplit}><span>Разделить на категории</span><i class="tg" class:on={split}></i></button>
        {#if !split && note.trim()}<button class="rr" onclick={() => (remember = !remember)}><span>Запомнить категорию для «{note.trim().slice(0, 18)}»</span><i class="tg" class:on={remember}></i></button>{/if}
      {/if}
    </div>

    {#if split}
      <div class="lb">Категории операции</div>
      <div class="rows">
        {#each parts as p, i (i)}
          <div class="pt">
            <label class="pc"><span class="pi"><Icon name={catOf(p.id)?.icon ?? 'tag'} size={17} /></span><span class="pn" class:ph={!p.id}>{catOf(p.id)?.name ?? 'Категория'}</span>
              <select value={p.id ?? 0} onchange={(e) => { parts[i].id = Number(e.currentTarget.value) || null; err = ''; }}><option value={0}>Категория</option>{#each cats as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</select></label>
            {#if i === 0}<span class="pa auto">{fmt(first, 2)}</span>
            {:else}<input class="pa" inputmode="decimal" placeholder="0" value={p.v ? fmt(p.v, 2) : ''} oninput={(e) => { parts[i].v = num(e.currentTarget.value); err = ''; }} onblur={(e) => (e.currentTarget.value = parts[i].v ? fmt(parts[i].v, 2) : '')} />{/if}
            {#if parts.length > 2 && i > 0}<button class="px" aria-label="Убрать" onclick={() => (parts = parts.filter((_, k) => k !== i))}>✕</button>{/if}
          </div>
        {/each}
        <button class="add" onclick={() => (parts = [...parts, { id: null, v: 0 }])}>+ Добавить категорию</button>
      </div>
      <div class="tt" class:okc={total > 0 && left === 0} class:bad={left !== 0}>
        {left === 0 && total > 0 ? `✓ Итого ${fmt(total, 2)} ${SYM[cur] ?? cur} — сходится` : `Итого ${fmt(total - left, 2)} из ${fmt(total, 2)} ${SYM[cur] ?? cur}`}
      </div>
    {/if}
  </div>
  {#snippet footer()}
    {#if err}<p class="er">{err}</p>{/if}
    <div class="gw"><button class="go" class:ok disabled={busy && !ok} onclick={save}>
      <span class="t">{busy && !ok ? 'Сохраняю…' : 'Сохранить'}</span>
      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </button>{#if ok}<i class="rg"></i>{/if}</div>
  {/snippet}
</Sheet>

<style>
  .bd { padding: 0 12px 14px; }
  .seg { position: relative; display: flex; padding: 2px; border-radius: 11px; background: var(--fill); margin-bottom: 10px; }
  .seg .pl { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 4); border-radius: 9px; background: linear-gradient(180deg, #F0D18A, #C9963A); transform: translateX(calc(var(--n) * 100%)); transition: transform .4s cubic-bezier(.3, 1.3, .5, 1); }
  .seg button { position: relative; z-index: 1; flex: 1; padding: 7px 0; font-size: 12.5px; font-weight: 600; color: var(--muted); transition: color .25s; }
  .seg button.on { color: #1a1206; }
  .hero { border-radius: 20px; padding: 12px 14px 14px; color: #F4EEDD; background: linear-gradient(150deg, #1a1410, #0a0807); box-shadow: inset 0 0 0 .5px rgba(232, 194, 119, .25); }
  .who { display: flex; align-items: center; gap: 11px; }
  .wn { flex: 1; min-width: 0; } .wn small { display: block; margin-top: 1px; font-size: 11.5px; color: #b9a27a; }
  .nm { width: 100%; box-sizing: border-box; border: 0; outline: 0; background: none; color: #F4DDA6; font: inherit; font-size: 15px; font-weight: 600; -webkit-user-select: text; user-select: text; }
  .nm::placeholder, .big input::placeholder { color: #8a7857; }
  .big { display: flex; align-items: baseline; gap: 6px; margin-top: 4px; }
  .big input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 40px; font-weight: 700; letter-spacing: -1px; color: #F4DDA6; font-variant-numeric: tabular-nums; -webkit-user-select: text; user-select: text; }
  .big u { text-decoration: none; font-size: 26px; color: #8a7857; }
  .big.sm input { font-size: 26px; } .big.sm u { font-size: 20px; }
  .pills { display: flex; align-items: center; gap: 7px; margin-top: 8px; flex-wrap: wrap; }
  .pills b { color: #E8C277; }
  .pill { position: relative; border-radius: 99px; padding: 6px 12px; font-size: 12.5px; background: rgba(232, 194, 119, .16); color: #E8C277; max-width: 100%; }
  .pill span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font-size: 16px; }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 14px 4px 6px; }
  .rb { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .rb::-webkit-scrollbar { display: none; }
  .cc { flex: none; width: 66px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; line-height: 13px; color: var(--muted); text-align: center; }
  .cc span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); transition: transform .25s cubic-bezier(.3, 1.5, .5, 1), background .2s, color .2s; }
  .cc.on { color: var(--text); font-weight: 600; } .cc.on span { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; transform: scale(1.08); }
  .rows { margin-top: 12px; background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .rr { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; padding: 11px 14px; font-size: 14.5px; text-align: left; }
  .rr + .rr::before { content: ""; position: absolute; top: 0; left: 14px; right: 0; height: .5px; background: var(--line); }
  .rr input { border: 0; outline: 0; background: none; color: var(--muted); font: inherit; font-size: 14px; text-align: right; }
  .tg { flex: none; width: 51px; height: 31px; border-radius: 99px; background: rgba(120, 120, 128, .32); position: relative; transition: background .25s; }
  .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .25); transition: transform .25s cubic-bezier(.32, .72, 0, 1); }
  .tg.on { background: #D9A93F; } .tg.on::after { transform: translateX(20px); }
  .pt { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
  .pt + .pt::before { content: ""; position: absolute; top: 0; left: 14px; right: 0; height: .5px; background: var(--line); }
  .pc { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; }
  .pi { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); }
  .pn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14.5px; font-weight: 600; } .pn.ph { color: var(--muted); font-weight: 400; }
  .pc select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font-size: 16px; }
  .pa { width: 96px; padding: 7px 10px; border: 0; outline: 0; border-radius: 10px; background: var(--fill); color: var(--text); font: inherit; font-size: 16px; font-weight: 600; text-align: right; -webkit-user-select: text; user-select: text; }
  .pa.auto { color: var(--muted); }
  .px { color: var(--muted); font-size: 15px; padding: 0 2px; }
  .add { width: 100%; text-align: left; padding: 12px 14px; color: var(--gold); font-weight: 500; border-top: .5px solid var(--line); }
  .tt { text-align: center; font-size: 12.5px; color: var(--muted); margin: 8px 0 0; transition: color .3s; } .tt.okc { color: var(--pos); } .tt.bad { color: var(--neg); }
  .er { flex: none; margin: 6px 14px 0; font-size: 13px; color: #E5584D; text-align: center; }
  .gw { position: relative; flex: none; margin: 6px 12px calc(14px + var(--safe-b)); }
  .go { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 48px; color: #2A1D05; font-size: 16px; font-weight: 600; transition: opacity .2s; }
  .go::before, .go::after { content: ""; position: absolute; background: linear-gradient(#EBC77A, #C99A3C); box-shadow: 0 6px 16px -6px rgba(226, 172, 62, .6); will-change: transform, opacity; transition: transform .5s cubic-bezier(.32, .72, 0, 1), opacity .3s ease; }
  .go::before { inset: 0; border-radius: 24px; }
  .go::after { left: 50%; top: 0; width: 48px; height: 48px; margin-left: -24px; border-radius: 24px; opacity: 0; transform: scale(.5); }
  .go.ok::before { opacity: 0; transform: scaleX(.16); }
  .go.ok::after { opacity: 1; transform: none; }
  .go .t { position: relative; z-index: 1; display: inline-block; white-space: nowrap; will-change: transform, opacity; transition: transform .4s cubic-bezier(.5, 0, .8, .4), opacity .25s .05s; }
  .go.ok .t { transform: rotate(90deg) scale(0); opacity: 0; }
  .go svg { position: absolute; z-index: 1; inset: 0; margin: auto; width: 26px; height: 26px; fill: none; stroke: #2A1D05; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 26; stroke-dashoffset: 26; opacity: 0; transform: rotate(-90deg) scale(.4); transition: transform .55s cubic-bezier(.2, .9, .3, 1.15) .2s, opacity .15s .2s, stroke-dashoffset .38s cubic-bezier(.4, 0, .2, 1) .38s; pointer-events: none; }
  .go.ok svg { opacity: 1; transform: none; stroke-dashoffset: 0; }
  .go:disabled:not(.ok) { opacity: .6; }
  .rg { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; border: 2px solid #E3B95E; pointer-events: none; animation: ring .7s ease-out .6s both; }
  @keyframes ring { from { transform: scale(1); opacity: .8; } to { transform: scale(2.1); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .seg .pl, .go, .go::before, .go::after, .go .t, .go svg, .rg { transition: none; animation: none; } }
</style>
