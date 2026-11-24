<script>
  // Период «Операций»: переключатель Месяц · Год · Все · Период и листалка «‹ Ноябрь 2026 ›».
  // Тап по названию открывает список месяцев (или лет) с числом операций. При прокрутке страницы блок сворачивается (col).
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { refresh, peek } from './cache.svelte.js';
  import { loadOpsMonths } from './data.js';
  import { per, cal, customLabel } from './opsfilter.svelte.js';

  let { col = false } = $props();
  const FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const cy = new Date().getFullYear(), cm = new Date().getMonth();

  let open = $state(false);
  let counts = $state(peek('ops.months') ?? {});
  onMount(() => { refresh('ops.months', loadOpsMonths).then((d) => (counts = d)).catch(() => {}); });

  // месяцы, где есть операции, новые сверху; текущий есть всегда
  const months = $derived.by(() => {
    const m = { ...counts }; const k = `${cy}-${cm}`; if (!(k in m)) m[k] = 0;
    return Object.keys(m).map((x) => { const [y, mo] = x.split('-').map(Number); return { y, m: mo, n: m[x] }; }).sort((a, b) => b.y - a.y || b.m - a.m);
  });
  const years = $derived.by(() => {
    const m = new Map([[cy, 0]]);
    for (const x of months) m.set(x.y, (m.get(x.y) ?? 0) + x.n);
    return [...m].map(([y, n]) => ({ y, n })).sort((a, b) => b.y - a.y);
  });

  const idx = $derived(per.mode === 'month' ? 0 : per.mode === 'year' ? 1 : per.mode === 'all' ? 2 : 3);
  const label = $derived(per.mode === 'month' ? `${FULL[per.m]} ${per.y}` : per.mode === 'year' ? `${per.yr} год` : per.mode === 'custom' ? customLabel() : '');
  const atEnd = $derived(per.mode === 'month' ? per.y === cy && per.m === cm : per.mode === 'year' ? per.yr >= cy : true);

  function setMode(k) {
    open = false;
    if (k === 'custom') { cal.open = true; return; }
    per.mode = k;
  }
  function step(d) {
    if (per.mode === 'month') { const x = new Date(per.y, per.m + d, 1); if (x > new Date(cy, cm, 1)) return; per.y = x.getFullYear(); per.m = x.getMonth(); per.yr = per.y; }
    else if (per.mode === 'year') { if (per.yr + d > cy) return; per.yr += d; }
  }
  function tapLabel() { if (per.mode === 'custom') cal.open = true; else open = !open; }
  function pickMonth(x) { per.mode = 'month'; per.y = x.y; per.m = x.m; per.yr = x.y; open = false; }
  function pickYear(x) { per.mode = 'year'; per.yr = x.y; open = false; }
</script>

<svelte:window onpointerdown={(e) => { if (open && !e.target.closest?.('.perbar')) open = false; }} />

<div class="perbar" class:col>
  <div class="fold">
    <div class="in">
      <div class="seg" style:--k={idx}>
        <i></i>
        <button class:on={idx === 0} onclick={() => setMode('month')}>Месяц</button>
        <button class:on={idx === 1} onclick={() => setMode('year')}>Год</button>
        <button class:on={idx === 2} onclick={() => setMode('all')}>Все</button>
        <button class:on={idx === 3} onclick={() => setMode('custom')}>Период</button>
      </div>
      {#if per.mode !== 'all'}
        <div class="mn">
          {#if per.mode !== 'custom'}<button class="ar" aria-label="Назад" onclick={() => step(-1)}><Icon name="chevron" size={18} /></button>{:else}<span class="ar"></span>{/if}
          <button class="lb" onclick={tapLabel}>{label}{#if per.mode !== 'custom'}<span class="cv" class:up={open}><Icon name="chevron" size={13} /></span>{/if}</button>
          {#if per.mode !== 'custom'}<button class="ar nx" aria-label="Вперёд" disabled={atEnd} onclick={() => step(1)}><Icon name="chevron" size={18} /></button>{:else}<span class="ar"></span>{/if}
        </div>
      {/if}
    </div>
  </div>
  {#if open}
    <div class="pp" role="listbox" transition:scale={{ start: 0.75, duration: 220, opacity: 0 }}>
      {#if per.mode === 'month'}
        {#each months as x, i (x.y + '-' + x.m)}
          {#if i === 0 || months[i - 1].y !== x.y}<div class="yl">{x.y}</div>{/if}
          <button class="pr" class:s={per.y === x.y && per.m === x.m} role="option" aria-selected={per.y === x.y && per.m === x.m} onclick={() => pickMonth(x)}>
            <span class="nm">{FULL[x.m]}</span><span class="ct">{x.n || ''}</span>
          </button>
        {/each}
      {:else}
        {#each years as x (x.y)}
          <button class="pr" class:s={per.yr === x.y} role="option" aria-selected={per.yr === x.y} onclick={() => pickYear(x)}>
            <span class="nm">{x.y}</span><span class="ct">{x.n || ''}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .perbar { position: relative; z-index: 20; }
  /* сворачивание без замера высоты: строка сетки 1fr → 0fr */
  .fold { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .4s cubic-bezier(.3, .8, .3, 1), opacity .3s; }
  .in { min-height: 0; overflow: hidden; }
  .col .fold { grid-template-rows: 0fr; opacity: 0; pointer-events: none; }
  .seg { position: relative; display: flex; padding: 3px; border-radius: 99px; background: var(--fill); }
  .seg i { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 4); border-radius: 99px; background: linear-gradient(180deg, #F0D18A, #C9963A); transform: translateX(calc(var(--k) * 100%)); transition: transform .45s cubic-bezier(.3, .9, .3, 1.1); }
  .seg button { position: relative; z-index: 1; flex: 1; height: 34px; font-size: 14px; font-weight: 600; color: var(--muted); transition: color .3s; }
  .seg button.on { color: #1a1206; }
  .mn { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px; min-height: 38px; }
  .ar { width: 38px; height: 38px; display: grid; place-items: center; color: var(--gold); transition: opacity .2s, transform .15s; }
  .ar:first-child :global(svg) { transform: scaleX(-1); }
  .ar:active { transform: scale(.88); }
  .ar:disabled { opacity: .25; }
  .lb { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 170px; height: 38px; font-size: 17px; font-weight: 600; }
  .cv { display: grid; color: var(--muted); transition: transform .3s; }
  .cv.up { transform: rotate(180deg); }
  .pp { position: absolute; top: 90px; left: 50%; margin-left: -116px; z-index: 12; width: 232px; max-height: 300px; overflow-y: auto; padding: 6px; border-radius: 20px; background: var(--card); box-shadow: 0 14px 38px rgba(0, 0, 0, .22), inset 0 0 0 .5px var(--line); scrollbar-width: none; }
  .pp::-webkit-scrollbar { display: none; }
  .yl { padding: 8px 12px 2px; font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--muted); }
  .pr { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 14px; text-align: left; font-size: 16px; }
  .pr:active { background: var(--gold-soft); }
  .pr .nm { flex: 1; font-weight: 500; }
  .pr .ct { font-size: 13px; color: var(--muted); }
  .pr.s .nm, .pr.s .ct { font-weight: 700; color: var(--gold); }
</style>
