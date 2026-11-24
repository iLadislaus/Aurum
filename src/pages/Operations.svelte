<script>
  import { onMount, tick, untrack } from 'svelte';
    import { loadCategories, loadAccList, opsLoader, deleteOp, repeatOp } from '../lib/data.js';
  import { peek, refresh, put } from '../lib/cache.svelte.js';
  import { prefetchAll } from '../lib/prefetch.js';
  import { fmt, cash } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import SwipeRow from '../lib/SwipeRow.svelte';
  import { sw } from '../lib/swipe.svelte.js';
  import { openOp } from '../lib/opcard.svelte.js';
  import { openCtx } from '../lib/ctxmenu.svelte.js';
  import { longpress } from '../lib/longpress.js';
  import { openNewOp } from '../lib/newop.svelte.js';
  import { flyOpen } from '../lib/fly.js';
  import Skeleton from '../lib/Skeleton.svelte';
  import UncatBanner from '../lib/UncatBanner.svelte';
  import OpsPeriod from '../lib/OpsPeriod.svelte';
  import OpsFilters from '../lib/OpsFilters.svelte';
  import { per, fl, perKey, perWord, resetPeriod, customLabel, applyFilters, activeCount, toggle, TYPES, SUMR, SRC, FLAGS } from '../lib/opsfilter.svelte.js';

  const PAGE = 50;

  let err = $state('');
  let q = $state('');
  let searching = $state(false);
  let focused = $state(false);
  let fpOpen = $state(false);
  let onlyUncat = $state(false);
  let limit = $state(PAGE);
  let busy = $state(false);
  let sentinel = $state();
  let inputEl = $state();
  let accs = $state(peek('ops.accs')?.list ?? []);
  let cats = $state(peek('cats')?.list ?? []);

  // данные за выбранный период: Все, месяц, год или свой период
  let key = $derived(perKey());
  let data = $derived(peek(key));
  let base = $derived(data?.ops ?? []);

  async function load(k) {
    err = '';
    try { await refresh(k, opsLoader(k)); }
    catch (e) { if (!peek(k)) err = e.message || 'Не удалось загрузить операции'; }
  }
  $effect(() => { const k = key; untrack(() => { limit = PAGE; onlyUncat = false; load(k); }); });
  onMount(() => {
    refresh('ops.accs', loadAccList).then((d) => (accs = d.list)).catch(() => {});
    refresh('cats', loadCategories).then((d) => (cats = d.list)).catch(() => {});
  });

  // фильтры по чипсам, затем умный поиск: по названию, категории, счёту, заметке и по сумме («500», «1 240,5»)
  const num = (s) => s.replace(/[\s ]/g, '').replace(',', '.');
  let found = $derived.by(() => {
    let l = applyFilters(base);
    if (onlyUncat) l = l.filter((t) => t.uncat);
    const s = q.trim().toLowerCase();
    if (!s) return l;
    const n = num(s);
    return l.filter((t) => (t.name + ' ' + t.cat + ' ' + t.acc + ' ' + t.note).toLowerCase().includes(s)
      || (/^[\d.]+$/.test(n) && String(Math.abs(t.amount)).replace(/\.0+$/, '').includes(n)));
  });
  const nfil = $derived(activeCount());

  // итоги выбранного по гривневым счетам: расходы за вычетом возвратов
  let tot = $derived.by(() => {
    let exp = 0, inc = 0;
    for (const t of found) {
      if (t.foreign || t.action === 'TRANSFER') continue;
      if (t.action === 'EXPENSE') exp += t.amount; else if (t.action === 'RETURN') exp -= t.amount; else inc += t.amount;
    }
    return { exp, inc, net: inc - exp };
  });
  let uncatCount = $derived(base.filter((t) => t.uncat).length);

  // подсказки под полем поиска: появляются, когда тапнули в поле; выбранное превращается в золотую капсулу
  const TL = Object.fromEntries(TYPES.map((x) => [x[0], x[1]]));
  let sugg = $derived.by(() => {
    if (!focused) return [];
    const s = q.trim().toLowerCase(), hit = (n) => !s || n.toLowerCase().includes(s);
    const mm = new Map(), cm = new Map();
    for (const t of base) {
      if (t.action === 'TRANSFER') continue;
      mm.set(t.name, (mm.get(t.name) ?? 0) + 1);
      const id = t.uncat ? 'none' : t.category_id; if (id != null) cm.set(id, (cm.get(id) ?? 0) + 1);
    }
    const out = [];
    const mers = [...mm].filter(([n]) => !fl.mers.includes(n) && hit(n)).sort((x, y) => y[1] - x[1]).slice(0, s ? 5 : 4);
    out.push(...mers.map(([n, c]) => ({ g: 'МАГАЗИНЫ', k: 'mers', v: n, label: n, c, icon: 'cart' })));
    const cs = [...cm].map(([id, c]) => ({ id, c, name: id === 'none' ? 'Без категории' : cats.find((x) => x.id === id)?.name ?? '' }))
      .filter((x) => x.name && !fl.cats.includes(x.id) && hit(x.name)).sort((x, y) => y.c - x.c).slice(0, s ? 4 : 3);
    out.push(...cs.map((x) => ({ g: 'КАТЕГОРИИ', k: 'cats', v: x.id, label: x.name, c: x.c, icon: 'tag' })));
    if (s) {
      out.push(...TYPES.filter((x) => !fl.types.includes(x[0]) && hit(x[1])).map((x) => ({ g: 'ВИД', k: 'types', v: x[0], label: x[1], icon: x[2] })));
      out.push(...accs.filter((a) => !fl.accs.includes(a.id) && hit(a.name)).slice(0, 3).map((a) => ({ g: 'СЧЕТА', k: 'accs', v: a.id, label: a.name, icon: 'wallet' })));
    }
    return out;
  });
  function chosen(x) { toggle(x.k, x.v); q = ''; inputEl?.focus(); }

  // капсулы выбранного: свой период и все фильтры; крестик снимает, период возвращается на текущий месяц
  let caps = $derived.by(() => {
    const o = [];
    if (per.mode === 'custom') o.push({ id: 'per', label: customLabel(), icon: 'calendar', off: resetPeriod });
    for (const v of fl.types) o.push({ id: 't' + v, label: TL[v], icon: TYPES.find((x) => x[0] === v)[2], off: () => toggle('types', v) });
    for (const v of fl.accs) o.push({ id: 'a' + v, label: accs.find((a) => a.id === v)?.name ?? '…', icon: 'wallet', off: () => toggle('accs', v) });
    for (const v of fl.cats) o.push({ id: 'c' + v, label: v === 'none' ? 'Без категории' : cats.find((c) => c.id === v)?.name ?? '…', icon: 'tag', off: () => toggle('cats', v) });
    for (const v of fl.mers) o.push({ id: 'm' + v, label: v, icon: 'cart', off: () => toggle('mers', v) });
    if (fl.sum >= 0) o.push({ id: 's', label: SUMR[fl.sum][0] + ' ₴', icon: 'coin', off: () => (fl.sum = -1) });
    for (const v of fl.src) o.push({ id: 'r' + v, label: SRC.find((x) => x[0] === v)[1], icon: SRC.find((x) => x[0] === v)[2], off: () => toggle('src', v) });
    for (const v of fl.flags) o.push({ id: 'f' + v, label: FLAGS.find((x) => x[0] === v)[1], icon: FLAGS.find((x) => x[0] === v)[2], off: () => toggle('flags', v) });
    return o;
  });

  const dayKey = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  function dayTitle(k) {
    const today = dayKey(new Date().toISOString());
    const diff = Math.round((new Date(today) - new Date(k)) / 86400000);
    if (diff <= 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    const d = new Date(k + 'T12:00:00');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  }
  // порции по 50: остальное подгружается при прокрутке
  let shownList = $derived(found.slice(0, limit));
  let groups = $derived.by(() => {
    const out = [];
    for (const t of shownList) {
      const k = dayKey(t.date);
      let g = out.at(-1);
      if (!g || g.k !== k) out.push((g = { k, title: dayTitle(k), sum: 0, items: [] }));
      g.items.push(t);
      if (!t.foreign && t.action !== 'TRANSFER') g.sum += t.v;
    }
    return out;
  });

  $effect(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && limit < found.length) limit += PAGE; }, { rootMargin: '400px' });
    io.observe(sentinel);
    return () => io.disconnect();
  });
  $effect(() => { q; onlyUncat; applyFilters; fl.types.length; fl.accs.length; fl.cats.length; fl.mers.length; fl.sum; fl.src.length; fl.flags.length; limit = PAGE; });

  // поиск открывается только по лупе и без подсказок; закрывается касанием в сторону. Выбранные фильтры остаются, пока их не снимут крестиком
  function closeSearch() { searching = false; focused = false; fpOpen = false; q = ''; inputEl?.blur(); }
  function toggleSearch() { if (searching) closeSearch(); else searching = true; }
  function away(e) {
    if (!searching) return;
    const t = e.target;
    if (t.closest?.('.hb')) return;
    if (t.closest?.('.sg, .frow, .fpwrap')) { if (!t.closest('.sg')) { focused = false; inputEl?.blur(); } return; }
    closeSearch();
  }
  function togglePanel() { focused = false; inputEl?.blur(); fpOpen = !fpOpen; }

  // удаление и повтор: сразу правим список на экране, потом синхронизируем счета и главную
  async function remove(t) {
    if (t.mono) return;
    const old = peek(key);
    put(key, { ops: old.ops.filter((x) => x.id !== t.id) });
    try { await deleteOp(t.id); prefetchAll(true); }
    catch (e) { put(key, old); err = e.message || 'Не удалось удалить'; }
  }
  async function repeat(t) {
    if (t.mono) return;
    busy = true;
    try { await repeatOp(t); await load(key); prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось повторить'; }
    busy = false;
  }
  // жесты: вправо — разделить, влево — изменить; у банковских операций «Изменить» открывает карточку (категория), удалять и повторять их нельзя
  const editOp = (t) => (t.mono ? openOp(t, key) : openNewOp(t));
  const splitOp = (t) => openOp(t, key, 'split');
  const menuOp = (el, t) => openCtx(el, [
    { t: 'Изменить', icon: 'pen', run: () => editOp(t) },
    ...(t.action !== 'TRANSFER' ? [{ t: 'Разделить', icon: 'split', run: () => splitOp(t) }] : []),
    ...(!t.mono ? [{ t: 'Повторить', icon: 'copy', run: () => repeat(t) }, { t: 'Удалить', icon: 'trash', danger: true, sep: true, run: () => openOp(t, key, 'del') }] : [])
  ]);
  const sgn = (t) => (t.action === 'TRANSFER' ? '' : t.v > 0 ? '+' : '−');
  const amt = (t) => sgn(t) + fmt(Math.abs(t.action === 'TRANSFER' ? t.amount : t.v), t.foreign ? 2 : Math.abs(t.amount) % 1 ? 2 : 0) + ' ' + t.sym;
</script>

<svelte:window onpointerdown={away} />

<section>
  <div class="head rise">
    <h1 class="large-title">Операции</h1>
    <div class="hb">
      <button class="rf" class:on={searching || nfil > 0} aria-label="Поиск" onclick={toggleSearch}><Icon name={searching ? 'plus' : 'search'} size={20} />{#if nfil > 0 && !searching}<i class="bd">{nfil}</i>{/if}</button>
      <button class="rf plus" aria-label="Новая операция" onclick={(e) => flyOpen(e, () => openNewOp())}><Icon name="plus" size={20} /></button>
    </div>
  </div>

  {#if searching}
    <div class="sg">
      <label><Icon name="search" size={16} /><input id="opq" type="search" placeholder="Название, место, счёт или сумма" autocomplete="off" bind:this={inputEl} bind:value={q} onfocus={() => { focused = true; fpOpen = false; }} /></label>
      {#if sugg.length}
        <div class="dd" role="listbox">
          {#each sugg as x, i (x.k + x.v)}
            {#if i === 0 || sugg[i - 1].g !== x.g}<div class="gl">{x.g}</div>{/if}
            <button class="it" role="option" aria-selected="false" onpointerdown={(e) => e.preventDefault()} onclick={() => chosen(x)}>
              <span class="ico"><Icon name={x.icon} size={15} /></span><span class="nm">{x.label}</span>{#if x.c}<span class="ct">{x.c}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if searching || caps.length}
    <div class="frow">
      {#if searching}
        <button class="addf" class:on={fpOpen} onclick={togglePanel}><Icon name="sliders" size={15} />{caps.length ? 'Фильтры' : 'Добавить фильтры'}<span class="cv" class:up={fpOpen}><Icon name="chevron" size={14} /></span></button>
      {/if}
      {#each caps as c (c.id)}
        <span class="cap"><Icon name={c.icon} size={14} />{c.label}<button aria-label="Убрать" onclick={c.off}><Icon name="close" size={14} /></button></span>
      {/each}
    </div>
  {/if}

  {#if searching && fpOpen}
    <div class="fpwrap"><OpsFilters ops={base} {accs} {cats} /></div>
  {/if}

  <OpsPeriod />

  {#if err && !data}
    <p class="msg">{err}</p>
  {:else if !data}
    <Skeleton count={8} />
  {:else}
    <div class="sm rise" style="--i:1">
      <div class="r"><div><span>Расходы</span><b>{tot.exp ? '−' : ''}{cash(tot.exp, 0)}</b></div><div><span>Доходы</span><b class:pos={tot.inc > 0}>{tot.inc > 0 ? '+' : ''}{cash(tot.inc, 0)}</b></div></div>
      <div class="nt"><span>{nfil || q.trim() ? 'Итого по выбранному · ' + found.length : 'Итого ' + perWord()}</span><b class:pos={tot.net >= 0}>{tot.net >= 0 ? '+' : '−'}{cash(Math.abs(tot.net), 0)}</b></div>
    </div>

    <UncatBanner n={uncatCount} onopen={() => { const t = base.find((x) => x.uncat); if (t) openOp(t, key); }} />

    {#each groups as g (g.k)}
      <div class="dh"><span>{g.title}</span><b>{g.sum ? (g.sum > 0 ? '+' : '−') + cash(Math.abs(g.sum), 0) : ''}</b></div>
      <div class="cd">
        {#each g.items as t, i (t.id)}
          <SwipeRow id={t.id} norepeat={t.action === 'TRANSFER'} rlabel="Разделить" rconfirm={false} dlabel="Изменить" dconfirm={false} dgold full onrepeat={() => splitOp(t)} ondelete={() => editOp(t)}>
            <div class="op" class:un={t.uncat} class:top={i > 0} role="button" tabindex="0" use:longpress={(el) => menuOp(el, t)} onclick={() => !sw.id && openOp(t, key)} onkeydown={(e) => e.key === 'Enter' && openOp(t, key)}>
              {#if t.uncat}<span class="q">?</span>{:else}<OpAvatar icon={t.icon} size={38} name={t.name} />{/if}
              <div class="nm"><b>{t.name}</b><small>{t.cat}{t.acc ? ' · ' + t.acc : ''}</small></div>
              <span class="am" class:pos={t.v > 0 && t.action !== 'TRANSFER'} class:tr={t.action === 'TRANSFER'}>{amt(t)}</span>
            </div>
          </SwipeRow>
        {/each}
      </div>
    {:else}
      <p class="msg">{q || onlyUncat || nfil ? 'Ничего не найдено' : per.mode === 'all' ? 'Операций пока нет' : 'В этом периоде операций нет'}</p>
    {/each}
    {#if limit < found.length}<div class="more" bind:this={sentinel}>Подгружаю ещё…</div>{/if}
  {/if}
  {#if busy}<div class="toast">Повторяю…</div>{/if}
</section>

<style>
  section { padding: 0 16px calc(110px + var(--safe-b)); }
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(env(safe-area-inset-top, 0px) + 33px) 4px 12px; }
  .hb { display: flex; gap: 4px; }
  .rf { width: 44px; height: 44px; display: grid; place-items: center; }
  .rf :global(svg) { width: 36px !important; height: 36px !important; padding: 9px; border-radius: 50%; background: var(--fill); color: var(--gold); box-sizing: border-box; transition: transform .4s cubic-bezier(.32, .72, 0, 1), background .3s; }
  .rf.plus :global(svg) { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; padding: 8px; }
  .rf.on :global(svg) { transform: rotate(45deg); background: var(--gold-soft); }
  .rf { position: relative; }
  .bd { position: absolute; top: 0; right: 0; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: #1a1206; color: #F0CB82; font-size: 11px; font-weight: 600; font-style: normal; display: grid; place-items: center; }
  .sg { position: relative; z-index: 6; margin-bottom: 10px; }
  .sg label { display: flex; align-items: center; gap: 7px; height: 42px; padding: 0 14px; border-radius: 21px; background: var(--fill); color: var(--muted); transition: box-shadow .25s; }
  .sg label:focus-within { box-shadow: 0 0 0 2px #D9B865; }
  .sg input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 16px; color: var(--text); -webkit-user-select: text; user-select: text; }
  .dd { position: absolute; left: 0; right: 0; top: 48px; max-height: 320px; overflow-y: auto; padding: 6px; border-radius: 20px; background: var(--card); box-shadow: 0 12px 34px rgba(0, 0, 0, .2), inset 0 0 0 .5px var(--line); transform-origin: top; overscroll-behavior: contain; }
  .gl { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--muted); }
  .it { display: flex; align-items: center; gap: 11px; width: 100%; padding: 7px 10px; border-radius: 14px; text-align: left; }
  .it:active { background: var(--gold-soft); }
  .it .ico { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); flex: none; }
  .it .nm { flex: 1; min-width: 0; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .it .ct { font-size: 13px; color: var(--muted); }
  .frow { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .addf { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 16px; border: 1.5px dashed var(--gold); color: var(--gold); font-size: 14px; font-weight: 600; transition: background .25s, transform .15s; }
  .addf:active { transform: scale(.95); }
  .addf.on { background: var(--gold-soft); border-style: solid; }
  .addf .cv { display: grid; transition: transform .3s; }
  .addf .cv.up { transform: rotate(180deg); }
  .cap { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 6px 0 10px; border-radius: 16px; background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; font-size: 14px; font-weight: 600; white-space: nowrap; }
  .cap button { display: grid; place-items: center; width: 22px; height: 22px; opacity: .7; }
  .fpwrap { margin-bottom: 0; }
  .sm { position: relative; border-radius: 24px; padding: 12px 14px; color: #F4EEDD; overflow: hidden; background: linear-gradient(155deg, #1d1911, #0c0c0b 70%); box-shadow: inset 0 1px 0 rgba(255, 232, 160, .35), inset 0 0 0 .5px rgba(232, 194, 119, .4); }
  .sm::before { content: ""; position: absolute; right: -30px; top: -40px; width: 150px; height: 150px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 190, 90, .28), transparent 66%); pointer-events: none; }
  .sm .r { position: relative; display: flex; gap: 10px; }
  .sm .r div { flex: 1; border-radius: 14px; padding: 8px 11px; background: rgba(255, 255, 255, .05); min-width: 0; }
  .sm span { display: block; font-size: 11.5px; color: #9c9582; }
  .sm b { display: block; font-size: 17px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nt { position: relative; display: flex; justify-content: space-between; align-items: center; margin-top: 9px; padding: 0 3px; font-size: 12.5px; color: #9c9582; }
  .nt b { font-size: 15px; display: inline; }
  .pos { color: var(--pos); }
  .sm .pos { color: #30D158; }
  .op.un { background: rgba(229, 88, 77, .07); }
  .op.un .nm small { color: #D43D32; font-weight: 600; }
  .dh { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 4; display: flex; justify-content: space-between; margin: 0 -16px; padding: 18px 20px 7px; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; font-variant-numeric: tabular-nums; background: linear-gradient(var(--bg) 72%, transparent); }
  .dh b { text-transform: none; letter-spacing: 0; }
  .cd { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; }
  .op { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 14px; min-height: 56px; }
  .op.top::before { content: ""; position: absolute; top: 0; left: 63px; right: 0; height: .5px; background: var(--line); }
  .q { width: 38px; height: 38px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: #E5584D; font-weight: 700; }
  .nm { flex: 1; min-width: 0; }
  .nm b { display: block; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .am { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .am.tr { color: var(--text); }
  .msg { text-align: center; color: var(--muted); padding: 40px 0; }
  .more { text-align: center; padding: 18px; font-size: 12.5px; color: var(--muted); }
  .toast { position: fixed; left: 50%; bottom: 120px; transform: translateX(-50%); padding: 9px 16px; border-radius: 99px; background: rgba(30, 28, 20, .92); color: #E8C277; font-size: 13px; z-index: 20; }
</style>
