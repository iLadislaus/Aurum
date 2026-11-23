<script>
  import { fmt, signed, cash } from '../lib/format.js';
  // Подробный баланс для вкладки «Счета»: сумма, прирост и распределение денег
  let { total, delta, pct, cardCash, envs, debt = 0 } = $props();
  const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const parts = (v) => { const s = fmt(Math.abs(v), 2), i = s.lastIndexOf(','); return [s.slice(0, i), s.slice(i)]; };
  let sp = $derived(parts(total));
  let all = $derived(Math.max(0, cardCash) + Math.max(0, envs) + Math.abs(debt));
  const share = (v) => (all > 0 ? Math.max(0, v) / all : 0);
  let segs = $derived([
    { k: 'c', label: 'Карты и наличные', v: cardCash, p: share(cardCash) },
    { k: 'e', label: 'Конверты', v: envs, p: share(envs) },
    ...(debt ? [{ k: 'd', label: 'Долги', v: -Math.abs(debt), p: share(Math.abs(debt)) }] : [])
  ]);
  const pc = (p) => (p > 0 && p < 0.01 ? '<1' : Math.round(p * 100)) + '%';
</script>

<div class="bd">
  <div class="au"></div>
  <div class="top"><span class="dot"></span>Общий баланс <i>· {stamp}</i></div>
  <div class="sum">{sp[0]}<small>{sp[1]}&nbsp;₴</small></div>
  <div class="dl" class:dn={delta < 0}>{delta >= 0 ? '▲' : '▼'} {signed(delta)} ₴ за месяц · {pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1).replace('.', ',')}%</div>
  <div class="bar">{#each segs as s (s.k)}<i class={s.k} style:flex={Math.max(s.p, 0.012)}></i>{/each}</div>
  <div class="rows">
    {#each segs as s (s.k)}
      <div class="rw"><i class="sq {s.k}"></i><span>{s.label}</span><em>{pc(s.p)}</em><b class:neg={s.v < 0}>{cash(s.v, 0)}</b></div>
    {/each}
  </div>
</div>

<style>
  .bd { position: relative; border-radius: 26px; padding: 15px 18px 12px; background: linear-gradient(155deg, #1d1911, #0c0c0b 70%); color: #F4EEDD; overflow: hidden; font-variant-numeric: tabular-nums;
    box-shadow: inset 0 1px 0 rgba(255, 232, 160, .4), inset 0 0 0 .5px rgba(232, 194, 119, .4), 0 14px 30px -16px rgba(232, 194, 119, .35); }
  .au { position: absolute; right: -40px; top: -50px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 190, 90, .34), rgba(244, 190, 90, 0) 66%); animation: bdBr 5s ease-in-out infinite; pointer-events: none; }
  .top { position: relative; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9c9582; }
  .top i { font-style: normal; opacity: .75; }
  .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: #E8C277; flex: none; }
  .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #E8C277; animation: bdPl 2.2s ease-out infinite; }
  .sum { position: relative; margin-top: 2px; font-size: 34px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; white-space: nowrap; }
  .sum small { font-size: .62em; color: #E8C277; }
  .dl { position: relative; margin-top: 2px; font-size: 12px; color: #E8C277; }
  .dl.dn { color: #FF8A7E; }
  .bar { position: relative; display: flex; gap: 3px; height: 10px; margin: 14px 0 4px; }
  .bar i { display: block; height: 100%; min-width: 8px; border-radius: 99px; transform-origin: left; transform: scaleX(0); animation: bdGr .9s cubic-bezier(.2, .9, .3, 1) forwards; }
  .bar i:nth-child(2) { animation-delay: .15s; }
  .bar i:nth-child(3) { animation-delay: .3s; }
  .c { background: linear-gradient(90deg, #F4DDA6, #D9A93F); }
  .e { background: linear-gradient(90deg, #C99A3C, #8f6a22); }
  .d { background: linear-gradient(90deg, #E27D6E, #B4574A); }
  .rows { position: relative; margin-top: 8px; }
  .rw { display: flex; align-items: center; gap: 9px; padding: 9px 0; font-size: 14px; border-top: .5px solid rgba(255, 255, 255, .08); opacity: 0; animation: bdUp .45s cubic-bezier(.2, .8, .2, 1) forwards; }
  .rw:nth-child(1) { animation-delay: .3s; }
  .rw:nth-child(2) { animation-delay: .4s; }
  .rw:nth-child(3) { animation-delay: .5s; }
  .sq { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .sq.c { background: #E9C46A; } .sq.e { background: #B8862C; } .sq.d { background: #D0675A; }
  .rw span { flex: 1; color: #cfc8b3; min-width: 0; }
  .rw em { font-style: normal; font-size: 11.5px; color: #9c9582; }
  .rw b { font-weight: 600; white-space: nowrap; }
  .neg { color: #FF8A7E; }
  @keyframes bdBr { 50% { transform: scale(1.2); opacity: .6; } }
  @keyframes bdPl { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.4); opacity: 0; } }
  @keyframes bdGr { to { transform: scaleX(1); } }
  @keyframes bdUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .au, .dot::after { animation: none; } .bar i, .rw { animation: none; transform: none; opacity: 1; } }
</style>
