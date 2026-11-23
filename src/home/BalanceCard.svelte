<script>
  import { tween } from '../lib/anim.js';
  import { fmt, signed } from '../lib/format.js';
  let { total, delta, pct, shown, onopen, cols = [] } = $props();
  let disp = $state(0);

  // сумма отсчитывается от нуля при появлении карточки
  $effect(() => {
    if (!shown) { disp = 0; return; }
    return tween(total, 1300, 200, (v) => (disp = v));
  });

  const parts = (v) => { const s = fmt(Math.abs(v), 2), i = s.lastIndexOf(','); return [s.slice(0, i), s.slice(i)]; };
  let sp = $derived(parts(disp));
</script>

<div class="bc" role="button" tabindex="0" aria-label="Открыть счета" onclick={onopen} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onopen?.())}>
  <div class="cap">Общий баланс</div>
  <div class="sum"><span class="num">{sp[0]}</span><small>{sp[1]}&nbsp;₴</small></div>
  <div class="chip" class:dn={delta < 0}>{delta >= 0 ? '▲' : '▼'} {signed(delta)} · {pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1).replace('.', ',')}% за месяц</div>
  {#if cols.length}
    <div class="cols" style:grid-template-columns="repeat({cols.length}, minmax(0, 1fr))">
      {#each cols as c}<div><span>{c.label}</span><b class:neg={c.neg}>{c.value}</b></div>{/each}
    </div>
  {/if}
</div>

<style>
  .bc { position: relative; border-radius: 28px; background: radial-gradient(120% 90% at 85% 0%, #2A200C 0%, #120F08 45%, #080807 100%); padding: 16px 18px 14px; color: #F4EEDD; font-variant-numeric: tabular-nums; overflow: hidden; cursor: pointer; transition: transform .15s ease; box-shadow: 0 0 0 .5px rgba(232,194,119,.35), 0 18px 40px -20px rgba(232,194,119,.4), inset 0 1px 0 rgba(255,236,180,.12); }
  .bc:active { transform: scale(.985); }
  .bc::before { content: ""; position: absolute; inset: 0; border-radius: 28px; padding: 1px; pointer-events: none;
    background: conic-gradient(from var(--a, 0deg), transparent 0 70%, rgba(255,236,170,0) 72%, rgba(255,236,170,.95) 80%, rgba(255,236,170,0) 88%, transparent 90%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
    animation: bcSpin 5s linear infinite; }
  .cap { font-size: 11.5px; letter-spacing: .14em; font-weight: 600; color: #B3A47C; text-transform: uppercase; }
  .sum { margin-top: 7px; font-size: 44px; font-weight: 800; letter-spacing: -.04em; line-height: 1.05; white-space: nowrap; display: inline-block; max-width: 100%;
    background: linear-gradient(100deg, #D9A840 0%, #F0C968 22%, #FFF3C4 34%, #F2CE78 46%, #DBA843 62%, #F6D98C 80%, #D9A840 100%); background-size: 240% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent; animation: bcSweep 4.2s ease-in-out infinite; filter: drop-shadow(0 0 14px rgba(232,194,119,.38)); }
  .sum small { font-size: .5em; font-weight: 700; }
  .chip { display: inline-block; margin-top: 7px; font-size: 12.5px; font-weight: 600; color: #2A1D05; background: linear-gradient(110deg, #E8B954, #F8E3A6 50%, #D9A33F); padding: 3px 11px; border-radius: 99px; box-shadow: 0 0 14px -2px rgba(232,194,119,.55); }
  .chip.dn { background: linear-gradient(110deg, #C9705F, #F2B3A6 45%, #B4574A); }
  .cols { display: grid; margin-top: 12px; border-top: .5px solid rgba(255,255,255,.1); }
  .cols > div { padding: 9px 6px 0 0; min-width: 0; }
  .cols > div + div { padding-left: 10px; border-left: .5px solid rgba(255,255,255,.1); }
  .cols span { display: block; font-size: 11.5px; color: #9A917B; white-space: nowrap; }
  .cols b { display: block; margin-top: 2px; font-size: 13.5px; font-weight: 600; color: #F4EEDD; white-space: nowrap; }
  .cols b.neg { color: #FF8A7E; }
  @media (prefers-reduced-motion: reduce) { .bc::before, .sum { animation: none; } }
</style>
