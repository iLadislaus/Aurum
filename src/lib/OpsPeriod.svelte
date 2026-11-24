<script>
  // Полоса периода «Операций»: Все · месяц ⌄ · год ⌄ · Свой период. Всегда на виду; месяц и год раскрываются списком.
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { refresh, peek } from './cache.svelte.js';
  import { loadOpsMonths } from './data.js';
  import { per, cal, customLabel } from './opsfilter.svelte.js';

  const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const cy = new Date().getFullYear(), cm = new Date().getMonth();

  let open = $state('');
  let left = $state(0);
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
  const monthLabel = $derived(SHORT[per.m] + (per.y !== cy ? ' ' + String(per.y).slice(2) : ''));

  function place(e) { const w = e.currentTarget.parentElement.clientWidth; left = Math.max(0, Math.min(e.currentTarget.offsetLeft, w - 232)); }
  function tapAll() { open = ''; per.mode = 'all'; }
  function tapMonth(e) { if (per.mode !== 'month') { per.mode = 'month'; open = ''; } else { place(e); open = open === 'month' ? '' : 'month'; } }
  function tapYear(e) { if (per.mode !== 'year') { per.mode = 'year'; open = ''; } else { place(e); open = open === 'year' ? '' : 'year'; } }
  function tapCustom() { open = ''; cal.open = true; }
  function pickMonth(x) { per.mode = 'month'; per.y = x.y; per.m = x.m; per.yr = x.y; open = ''; }
  function pickYear(x) { per.mode = 'year'; per.yr = x.y; open = ''; }
</script>

<svelte:window onpointerdown={(e) => { if (open && !e.target.closest?.('.perbar')) open = ''; }} />

<div class="perbar rise" style="--i:1">
  <div class="row">
    <button class:on={per.mode === 'all'} onclick={tapAll}>Все</button>
    <button class:on={per.mode === 'month'} class:op={open === 'month'} onclick={tapMonth}>{monthLabel}<Icon name="chevron" size={14} /></button>
    <button class:on={per.mode === 'year'} class:op={open === 'year'} onclick={tapYear}>{per.yr}<Icon name="chevron" size={14} /></button>
    <button class:on={per.mode === 'custom'} onclick={tapCustom}><Icon name="calendar" size={15} />{per.mode === 'custom' ? customLabel() : 'Свой период'}</button>
  </div>
  {#if open}
    <div class="pop" role="listbox" style:left="{left}px" transition:scale={{ start: 0.75, duration: 220, opacity: 0 }}>
      {#if open === 'month'}
        {#each months as x, i (x.y + '-' + x.m)}
          {#if i === 0 || months[i - 1].y !== x.y}<div class="yl">{x.y}</div>{/if}
          <button class="pr" class:s={per.mode === 'month' && per.y === x.y && per.m === x.m} role="option" aria-selected={per.y === x.y && per.m === x.m} onclick={() => pickMonth(x)}>
            <span class="nm">{FULL[x.m]}</span><span class="ct">{x.n || ''}</span>
            {#if per.mode === 'month' && per.y === x.y && per.m === x.m}<Icon name="check" size={16} />{/if}
          </button>
        {/each}
      {:else}
        {#each years as x (x.y)}
          <button class="pr" class:s={per.mode === 'year' && per.yr === x.y} role="option" aria-selected={per.yr === x.y} onclick={() => pickYear(x)}>
            <span class="nm">{x.y}</span><span class="ct">{x.n || ''}</span>
            {#if per.mode === 'year' && per.yr === x.y}<Icon name="check" size={16} />{/if}
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .perbar { position: relative; margin-bottom: 12px; }
  .row { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  .row::-webkit-scrollbar { display: none; }
  .row button { display: flex; align-items: center; gap: 4px; white-space: nowrap; padding: 7px 14px; border-radius: 99px; background: var(--fill); font-size: 14px; font-weight: 600; min-height: 36px; text-transform: capitalize; flex: none; transition: background .25s, color .25s, transform .15s; }
  .row button:active { transform: scale(.95); }
  .row .on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .row :global(svg) { flex: none; transition: transform .3s; }
  .row .op :global(svg) { transform: rotate(180deg); }
  .pop { position: absolute; top: 44px; z-index: 12; width: 232px; max-height: 300px; overflow-y: auto; padding: 6px; border-radius: 20px; background: var(--card); box-shadow: 0 14px 38px rgba(0, 0, 0, .22), inset 0 0 0 .5px var(--line); transform-origin: top left; overscroll-behavior: contain; }
  .yl { padding: 8px 12px 2px; font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--muted); }
  .pr { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 14px; text-align: left; font-size: 16px; }
  .pr:active { background: var(--gold-soft); }
  .pr .nm { flex: 1; font-weight: 500; }
  .pr .ct { font-size: 13px; color: var(--muted); }
  .pr.s .nm { font-weight: 700; color: var(--gold); }
  .pr.s :global(svg) { color: var(--gold); }
</style>
