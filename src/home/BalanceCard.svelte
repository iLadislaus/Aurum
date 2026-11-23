<script>
  import { onMount } from 'svelte';
  import { fmt, signed } from '../lib/format.js';
  import { cachedRates, loadRates } from '../lib/rate.js';
  let { total, delta, pct, shown, onopen } = $props();

  // монета-переключатель валюты: ₴ → $ → €
  const CUR = ['UAH', 'USD', 'EUR'];
  const SYM = { UAH: '₴', USD: '$', EUR: '€' };
  let rates = $state(cachedRates());
  let k = $state(0);
  let flip = $state(0);
  let swap = $state(false);
  let busy = false;
  const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  onMount(async () => { const r = await loadRates(); if (r) rates = r; });

  let cur = $derived(CUR[k]);
  let rate = $derived(cur === 'UAH' ? 1 : rates?.[cur] || 1);
  const parts = (v) => { const s = fmt(Math.abs(v), 2), i = s.lastIndexOf(','); return [s.slice(0, i), s.slice(i)]; };
  let sp = $derived(parts(total / rate));
  let dl = $derived(delta / rate);

  function turn(e) {
    e.stopPropagation();
    if (busy || !rates) return;
    busy = true; swap = true; flip++;
    setTimeout(() => { k = (k + 1) % 3; swap = false; }, 300);
    setTimeout(() => (busy = false), 620);
  }
</script>

<div class="bc" role="button" tabindex="0" aria-label="Открыть счета" onclick={onopen} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onopen?.())}>
  <div class="au"></div>
  <i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i>
  <div class="l">
    <div class="cap"><span class="dot"></span>Общий баланс <i>· {stamp}</i></div>
    <div class="sw pop" class:in={shown}>
      <div class="sum" class:o={swap}><span class="num">{sp[0]}</span><small>{sp[1]}&nbsp;{SYM[cur]}</small></div>
    </div>
    <div class="dl" class:dn={delta < 0} class:o={swap}>{delta >= 0 ? '▲' : '▼'} {signed(dl)} {SYM[cur]} · {pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1).replace('.', ',')}% за месяц</div>
  </div>
  <button class="cw" aria-label="Сменить валюту" onclick={turn}>
    <span class="cn" class:fl={flip % 2 === 1} class:fl2={flip > 0 && flip % 2 === 0}>{SYM[cur]}</span>
  </button>
</div>

<style>
  .bc { position: relative; display: flex; align-items: center; justify-content: space-between; border-radius: 26px; background: linear-gradient(155deg, #1d1911, #0c0c0b 70%); padding: 15px 16px 15px 18px; min-height: 96px; color: #F4EEDD; font-variant-numeric: tabular-nums; overflow: hidden; cursor: pointer; transition: transform .15s ease; box-shadow: 0 0 0 .5px rgba(232,194,119,.4), 0 14px 30px -16px rgba(232,194,119,.35), inset 0 1px 0 rgba(255,232,160,.4); }
  .bc:active { transform: scale(.985); }
  .au { position: absolute; right: -34px; top: -40px; width: 190px; height: 190px; border-radius: 50%; background: radial-gradient(circle, rgba(244,190,90,.42), rgba(244,190,90,0) 66%); animation: bcBr 5s ease-in-out infinite; pointer-events: none; }
  .l { position: relative; z-index: 1; min-width: 0; }
  .cap { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #9c9582; margin-bottom: 2px; }
  .cap i { font-style: normal; opacity: .75; }
  .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: #E8C277; flex: none; }
  .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #E8C277; animation: bcPl 2.2s ease-out infinite; }
  .sum { font-size: 32px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; white-space: nowrap; color: #F4EEDD; transition: opacity .15s, transform .15s; }
  .sum small { font-size: .62em; font-weight: 700; color: #E8C277; }
  .sum.o { opacity: 0; transform: translateY(5px); }
  .dl { margin-top: 3px; font-size: 12px; font-weight: 500; color: #E8C277; transition: opacity .15s; }
  .dl.dn { color: #FF8A7E; }
  .dl.o { opacity: 0; }
  .cw { position: relative; z-index: 1; width: 64px; height: 64px; flex: none; padding: 0; border: 0; background: none; cursor: pointer; perspective: 380px; -webkit-tap-highlight-color: transparent; animation: bcFl 5s ease-in-out infinite; }
  .cn { position: relative; overflow: hidden; width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; font-size: 30px; font-weight: 800; color: #6b4a0e; text-shadow: 0 1px 0 rgba(255,240,190,.7);
    background: radial-gradient(circle at 34% 28%, #FFF0B8, #E0B04A 52%, #98691B);
    box-shadow: 0 0 0 3px rgba(232,194,119,.22), 0 8px 20px -4px rgba(226,172,62,.6), inset 0 0 0 3px rgba(255,240,190,.55), inset 0 -4px 8px rgba(120,80,10,.35); }
  .cn::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 36%, rgba(255,255,255,.7) 50%, transparent 64%); transform: translateX(-130%); animation: bcSw 4.5s ease-in-out infinite; }
  .cw:active .cn { transform: scale(.92); }
  .cn.fl { animation: bcFp .6s cubic-bezier(.4,0,.2,1); }
  .cn.fl2 { animation: bcFp2 .6s cubic-bezier(.4,0,.2,1); }
  .sp { position: absolute; z-index: 2; background: #FFF3C4; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: bcTw 2.8s ease-in-out infinite; pointer-events: none; opacity: 0; }
  .s1 { right: 84px; top: 14px; width: 11px; height: 11px; }
  .s2 { right: 10px; top: 12px; width: 8px; height: 8px; animation-delay: 1.1s; }
  .s3 { right: 78px; bottom: 12px; width: 7px; height: 7px; animation-delay: .6s; }
  @keyframes bcBr { 50% { transform: scale(1.22); opacity: .6; } }
  @keyframes bcPl { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.4); opacity: 0; } }
  @keyframes bcFl { 50% { transform: translateY(-4px); } }
  @keyframes bcSw { 0%, 60% { transform: translateX(-130%); } 100% { transform: translateX(130%); } }
  @keyframes bcFp { from { transform: rotateY(0); } to { transform: rotateY(360deg); } }
  @keyframes bcFp2 { from { transform: rotateY(0); } to { transform: rotateY(360deg); } }
  @keyframes bcTw { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
  @media (prefers-reduced-motion: reduce) { .au, .cn::after, .cw, .sp, .dot::after { animation: none; } .sp { opacity: 0; } }
</style>
