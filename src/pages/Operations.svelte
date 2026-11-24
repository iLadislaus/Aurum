<script>
  import { onMount, tick } from 'svelte';
  import { loadMonthOps, deleteOp, repeatOp } from '../lib/data.js';
  import { peek, refresh, put } from '../lib/cache.svelte.js';
  import { prefetchAll } from '../lib/prefetch.js';
  import { fmt, cash } from '../lib/format.js';
  import Icon from '../lib/Icon.svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import SwipeRow from '../lib/SwipeRow.svelte';
  import { sw } from '../lib/swipe.svelte.js';
  import { openOp } from '../lib/opcard.svelte.js';
  import { openNewOp } from '../lib/newop.svelte.js';
  import { flyOpen } from '../lib/fly.js';
  import Skeleton from '../lib/Skeleton.svelte';

  const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}`, label: SHORT[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : '') };
  });
  const PAGE = 50;

  let mi = $state(5);
  let err = $state('');
  let q = $state('');
  let searching = $state(false);
  let onlyUncat = $state(false);
  let limit = $state(PAGE);
  let busy = $state(false);
  let chipsEl;
  let sentinel = $state();

  let cur = $derived(months[mi]);
  let data = $derived(peek('ops.m.' + cur.key));

  async function load(i) {
    const mo = months[i];
    err = '';
    try { await refresh('ops.m.' + mo.key, () => loadMonthOps(mo.y, mo.m)); }
    catch (e) { if (!peek('ops.m.' + mo.key)) err = e.message || 'Не удалось загрузить операции'; }
  }
  onMount(() => { if (chipsEl) chipsEl.scrollLeft = chipsEl.scrollWidth; load(5); });
  function pick(i) { if (i === mi) return; mi = i; limit = PAGE; onlyUncat = false; load(i); }

  // итоги месяца по гривневым счетам: расходы за вычетом возвратов
  let tot = $derived.by(() => {
    let exp = 0, inc = 0;
    for (const t of data?.ops ?? []) {
      if (t.foreign || t.action === 'TRANSFER') continue;
      if (t.action === 'EXPENSE') exp += t.amount; else if (t.action === 'RETURN') exp -= t.amount; else inc += t.amount;
    }
    return { exp, inc, net: inc - exp };
  });
  let uncatCount = $derived((data?.ops ?? []).filter((t) => t.uncat).length);

  // умный поиск: по названию, категории, счёту, заметке и по сумме («500», «1 240,5»)
  const num = (s) => s.replace(/[\s ]/g, '').replace(',', '.');
  let found = $derived.by(() => {
    let l = data?.ops ?? [];
    if (onlyUncat) l = l.filter((t) => t.uncat);
    const s = q.trim().toLowerCase();
    if (!s) return l;
    const n = num(s);
    return l.filter((t) => (t.name + ' ' + t.cat + ' ' + t.acc + ' ' + t.note).toLowerCase().includes(s)
      || (/^[\d.]+$/.test(n) && String(Math.abs(t.amount)).replace(/\.0+$/, '').includes(n)));
  });
  // подсказки: самые частые места месяца
  let places = $derived.by(() => {
    const m = new Map();
    for (const t of data?.ops ?? []) { const k = t.note.trim(); if (k && t.action !== 'TRANSFER') m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
  });

  const dayKey = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  function dayTitle(k) {
    const today = dayKey(new Date().toISOString());
    const diff = Math.round((new Date(today) - new Date(k)) / 86400000);
    if (diff <= 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    return new Date(k + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
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
  $effect(() => { q; onlyUncat; limit = PAGE; });

  async function toggleSearch() { searching = !searching; if (!searching) q = ''; else { await tick(); document.getElementById('opq')?.focus(); } }

  // удаление и повтор: сразу правим список на экране, потом синхронизируем счета и главную
  async function remove(t) {
    if (t.mono) return;
    const key = 'ops.m.' + cur.key;
    const old = peek(key);
    put(key, { ops: old.ops.filter((x) => x.id !== t.id) });
    try { await deleteOp(t.id); prefetchAll(true); }
    catch (e) { put(key, old); err = e.message || 'Не удалось удалить'; }
  }
  async function repeat(t) {
    if (t.mono) return;
    busy = true;
    try { await repeatOp(t); await load(mi); prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось повторить'; }
    busy = false;
  }
  const sgn = (t) => (t.action === 'TRANSFER' ? '' : t.v > 0 ? '+' : '−');
  const amt = (t) => sgn(t) + fmt(Math.abs(t.action === 'TRANSFER' ? t.amount : t.v), t.foreign ? 2 : Math.abs(t.amount) % 1 ? 2 : 0) + ' ' + t.sym;
</script>

<section>
  <div class="head rise">
    <h1 class="large-title">Операции</h1>
    <div class="hb">
      <button class="rf" class:on={searching} aria-label="Поиск" onclick={toggleSearch}><Icon name={searching ? 'plus' : 'search'} size={20} /></button>
      <button class="rf plus" aria-label="Новая операция" onclick={(e) => flyOpen(e, () => openNewOp())}><Icon name="plus" size={20} /></button>
    </div>
  </div>

  {#if searching}
    <div class="srch rise">
      <label><Icon name="search" size={16} /><input id="opq" type="search" placeholder="Название, место, счёт или сумма" bind:value={q} /></label>
      {#if !q && places.length}
        <div class="hints">{#each places as p}<button onclick={() => (q = p)}>{p}</button>{/each}</div>
      {/if}
    </div>
  {/if}

  <div class="chips rise" style="--i:1" bind:this={chipsEl}>
    {#each months as mo, i}<button class:on={mi === i} onclick={() => pick(i)}>{mo.label}</button>{/each}
  </div>

  {#if err && !data}
    <p class="msg">{err}</p>
  {:else if !data}
    <Skeleton count={8} />
  {:else}
    <div class="sm rise" style="--i:1">
      <div class="r"><div><span>Расходы</span><b>{tot.exp ? '−' : ''}{cash(tot.exp, 0)}</b></div><div><span>Доходы</span><b class:pos={tot.inc > 0}>{tot.inc > 0 ? '+' : ''}{cash(tot.inc, 0)}</b></div></div>
      <div class="nt"><span>Итого за месяц</span><b class:pos={tot.net >= 0}>{tot.net >= 0 ? '+' : '−'}{cash(Math.abs(tot.net), 0)}</b></div>
    </div>

    {#if uncatCount}
      <button class="nc" class:on={onlyUncat} onclick={() => (onlyUncat = !onlyUncat)}><u>{uncatCount}</u>{onlyUncat ? 'показаны без категории · все' : 'без категории · разобрать'}</button>
    {/if}

    {#each groups as g (g.k)}
      <div class="dh"><span>{g.title}</span><b>{g.sum ? (g.sum > 0 ? '+' : '−') + cash(Math.abs(g.sum), 0) : ''}</b></div>
      <div class="cd">
        {#each g.items as t, i (t.id)}
          <SwipeRow id={t.id} nodelete={t.mono} norepeat={t.mono} ondelete={() => remove(t)} onrepeat={() => repeat(t)}>
            <div class="op" class:top={i > 0} role="button" tabindex="0" onclick={() => !sw.id && openOp(t, 'ops.m.' + cur.key)} onkeydown={(e) => e.key === 'Enter' && openOp(t, 'ops.m.' + cur.key)}>
              {#if t.uncat}<span class="q">?</span>{:else}<OpAvatar icon={t.icon} size={38} name={t.name} />{/if}
              <div class="nm"><b>{t.name}</b><small>{t.cat}{t.acc ? ' · ' + t.acc : ''}</small></div>
              <span class="am" class:pos={t.v > 0 && t.action !== 'TRANSFER'} class:tr={t.action === 'TRANSFER'}>{amt(t)}</span>
            </div>
          </SwipeRow>
        {/each}
      </div>
    {:else}
      <p class="msg">{q || onlyUncat ? 'Ничего не найдено' : 'В этом месяце операций нет'}</p>
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
  .srch { margin-bottom: 10px; }
  .srch label { display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 12px; border-radius: 12px; background: var(--fill); color: var(--muted); }
  .srch input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 15px; color: var(--text); -webkit-user-select: text; user-select: text; }
  .hints { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-top: 8px; }
  .hints::-webkit-scrollbar { display: none; }
  .hints button { white-space: nowrap; padding: 6px 12px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); font-size: 13px; font-weight: 500; }
  .chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin-bottom: 12px; }
  .chips::-webkit-scrollbar { display: none; }
  .chips button { white-space: nowrap; padding: 7px 14px; border-radius: 99px; background: var(--fill); font-size: 14px; font-weight: 600; min-height: 36px; text-transform: capitalize; transition: background .25s, color .25s; }
  .chips .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
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
  .nc { display: inline-flex; align-items: center; gap: 8px; margin: 12px 0 0; padding: 7px 13px 7px 8px; border-radius: 99px; background: rgba(255, 138, 126, .14); color: #E5584D; font-size: 13px; font-weight: 600; }
  .nc.on { background: #E5584D; color: #fff; }
  .nc u { display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: #E5584D; color: #fff; font-size: 12px; text-decoration: none; }
  .nc.on u { background: #fff; color: #E5584D; }
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
