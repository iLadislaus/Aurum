<script>
  // Период «Операций»: переключатель Месяц · Год · Все · Период и название периода.
  // Тап по названию открывает список месяцев (или лет) с числом операций.
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { refresh, peek } from './cache.svelte.js';
  import { loadOpsMonths } from './data.js';
  import { per, cal, customLabel } from './opsfilter.svelte.js';

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

  function setMode(k) {
    open = false;
    if (k === 'custom') { cal.open = true; return; }
    per.mode = k;
  }
  function tapLabel() { if (per.mode === 'custom') cal.open = true; else open = !open; }
  function pickMonth(x) { per.mode = 'month'; per.y = x.y; per.m = x.m; per.yr = x.y; open = false; }
  function pickYear(x) { per.mode = 'year'; per.yr = x.y; open = false; }
</script>

<svelte:window onpointerdown={(e) => { if (open && !e.target.closest?.('.perbar')) open = false; }} />

<div class="perbar">
  <div class="seg" style:--k={idx}>
    <i></i>
    <button class:on={idx === 0} onclick={() => setMode('month')}>Месяц</button>
    <button class:on={idx === 1} onclick={() => setMode('year')}>Год</button>
    <button class:on={idx === 2} onclick={() => setMode('all')}>Все</button>
    <button class:on={idx === 3} onclick={() => setMode('custom')}>Период</button>
  </div>
  {#if per.mode !== 'all'}
    <button class="lb" onclick={tapLabel}>{label}{#if per.mode !== 'custom'}<span class="cv" class:up={open}><Icon name="chevron" size={13} /></span>{/if}</button>
  {/if}
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
  .seg { position: relative; display: flex; padding: 3px; border-radius: 99px; background: var(--fill); }
  .seg i { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 4); border-radius: 99px; background: linear-gradient(180deg, #F0D18A, #C9963A); transform: translateX(calc(var(--k) * 100%)); transition: transform .45s cubic-bezier(.3, .9, .3, 1.1); }
  .seg button { position: relative; z-index: 1; flex: 1; height: 34px; font-size: 14px; font-weight: 600; color: var(--muted); transition: color .3s; }
  .seg button.on { color: #1a1206; }
  .lb { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; height: 40px; margin-top: 4px; font-size: 17px; font-weight: 600; }
  .cv { display: grid; color: var(--muted); transition: transform .3s; }
  .cv.up { transform: rotate(180deg); }
  .pp { position: absolute; top: 92px; left: 50%; margin-left: -116px; z-index: 12; width: 232px; max-height: 300px; overflow-y: auto; padding: 6px; border-radius: 20px; background: var(--card); box-shadow: 0 14px 38px rgba(0, 0, 0, .22), inset 0 0 0 .5px var(--line); scrollbar-width: none; }
  .pp::-webkit-scrollbar { display: none; }
  .yl { padding: 8px 12px 2px; font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--muted); }
  .pr { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 14px; text-align: left; font-size: 16px; }
  .pr:active { background: var(--gold-soft); }
  .pr .nm { flex: 1; font-weight: 500; }
  .pr .ct { font-size: 13px; color: var(--muted); }
  .pr.s .nm, .pr.s .ct { font-weight: 700; color: var(--gold); }
</style>
