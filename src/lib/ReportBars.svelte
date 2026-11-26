<script>
  // Столбики отчёта: один или два ряда, по нажатию показывают точные суммы
  import { fmt } from './format.js';
  let { items = [], colors = ['#D9A93F'], names = [], dense = false } = $props();
  let pick = $state(-1);
  const sel = $derived(pick >= 0 && pick < items.length ? pick : items.length - 1);
  const max = $derived(Math.max(1, ...items.flatMap((x) => [Math.abs(x.a), Math.abs(x.b ?? 0)])));
  const h = (v) => (v ? Math.max(2, (Math.abs(v) / max) * 100) : 0);
  const money = (v) => (v < 0 ? '−' : '') + fmt(Math.abs(v), 0) + ' ₴';
  // подписи прореживаются, когда столбиков много
  const step = $derived(Math.max(1, Math.ceil(items.length / 7)));
  const two = $derived(items[0]?.b != null);
</script>

{#if items.length}
  <div class="val">
    <span>{items[sel].label}</span>
    <b style:color={colors[0]}>{names[0] ? names[0] + ' ' : ''}{money(items[sel].a)}</b>
    {#if two}<b style:color={colors[1]}>{names[1] ? names[1] + ' ' : ''}{money(items[sel].b)}</b>{/if}
  </div>
  <div class="bars" class:dense>
    {#each items as x, i}
      <button class="c" class:off={i !== sel} style="--i:{Math.min(i, 20)}" onclick={() => (pick = i)} aria-label="{x.label}: {money(x.a)}">
        <span class="s"><i style="height:{h(x.a)}%;background:{x.a < 0 ? '#FF6B5E' : colors[0]}"></i>{#if two}<i style="height:{h(x.b)}%;background:{colors[1]}"></i>{/if}</span>
      </button>
    {/each}
  </div>
  <div class="ax" class:dense>{#each items as x, i}<span>{#if (items.length - 1 - i) % step === 0}<em>{x.label}</em>{/if}</span>{/each}</div>
{/if}

<style>
  .val { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--muted); margin-bottom: 8px; font-variant-numeric: tabular-nums; }
  .bars, .ax { display: flex; gap: 6px; }
  .bars.dense, .ax.dense { gap: 1px; }
  .bars { height: 110px; }
  .c { flex: 1; min-width: 0; height: 100%; transition: opacity .2s; }
  .c.off { opacity: .55; }
  .s { display: flex; align-items: flex-end; justify-content: center; gap: 2px; height: 100%; }
  i { flex: 1; border-radius: 4px 4px 1px 1px; transform-origin: bottom; animation: up .8s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i) * 30ms); }
  @keyframes up { from { transform: scaleY(0); } }
  .ax { margin-top: 5px; height: 14px; }
  .ax span { flex: 1; min-width: 0; position: relative; }
  .ax em { position: absolute; left: 50%; transform: translateX(-50%); font-style: normal; font-size: 11px; color: var(--muted); white-space: nowrap; }
  .ax span:first-child em { left: 0; transform: none; }
  .ax span:last-child em { left: auto; right: 0; transform: none; }
  @media (prefers-reduced-motion: reduce) { i { animation: none; } }
</style>
