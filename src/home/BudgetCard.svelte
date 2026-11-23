<script>
  import { fmt, money } from '../lib/format.js';
  let { budget, shown } = $props();

  let remaining = $derived(budget.plan - budget.spent);
  let over = $derived(remaining < 0);
  let ratio = $derived(budget.plan > 0 ? Math.max(0, budget.spent / budget.plan) : 0);
  let arc = $derived(Math.min(1, ratio));
  let target = $derived(over ? -remaining : Math.max(0, remaining));
  const now = new Date();
  // дней до конца месяца, включая сегодня
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;

  let disp = $derived(target), pcDisp = $derived(Math.round(ratio * 100));
</script>

<div class="grp">
  <i class="halo" aria-hidden="true"></i>
  <div class="mid">
    <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="bgRg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C7420" /><stop offset="1" stop-color="#F6E3A1" /></linearGradient>
        <linearGradient id="bgRo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C2352B" /><stop offset="1" stop-color="#FF8A7E" /></linearGradient>
      </defs>
      <g transform="rotate(-90 60 60)">
        <circle cx="60" cy="60" r="46" fill="none" class="tr" />
        <circle cx="60" cy="60" r="46" fill="none" class="arc" pathLength="1" stroke-dasharray="1" stroke-dashoffset={shown ? 1 - arc : 1} stroke={over ? 'url(#bgRo)' : 'url(#bgRg)'} />
      </g>
      <g class="head" style:transform="rotate({shown ? arc * 360 : 0}deg)">
        <circle cx="60" cy="14" r="3" fill="#FFF6D6" />
      </g>
      <text x="60" y="66" text-anchor="middle" class="pc" class:over>{Math.round(pcDisp)}%</text>
    </svg>
    <div class="rt">
      <div class="l">{over ? 'Перерасход' : 'Осталось'}</div>
      <div class="n pop" class:in={shown} class:over>{fmt(disp)}<small>₴</small></div>
      <div class="l">{over ? 'лимит' : 'из'} {money(budget.plan)}</div>
    </div>
  </div>
  <div class="st">
    <div><i>{over ? 'Лимит' : 'Можно в день'}</i><b>{over ? money(budget.plan) : money(Math.max(0, remaining) / Math.max(1, daysLeft))}</b></div>
    <div class="r"><i>{now.toLocaleDateString('ru-RU', { month: 'long' })}</i><b>осталось {daysLeft} дн.</b></div>
  </div>
</div>

<style>
  .grp { position: relative; border-radius: 26px; padding: 13px 16px 11px; overflow: hidden; color: #F4EEDD; user-select: none; -webkit-user-select: none;
    background: linear-gradient(170deg, #16130B 0%, #0B0B0C 58%, #070708 100%); box-shadow: 0 0 0 .5px rgba(232,194,119,.24) inset, 0 18px 40px rgba(184,134,44,.07); }
  .halo { position: absolute; left: -90px; top: -90px; width: 300px; height: 280px; pointer-events: none; background: radial-gradient(closest-side, rgba(217,178,76,.22), transparent); animation: br 7s ease-in-out infinite alternate; }
  @keyframes br { to { transform: translate(50px, 30px) scale(1.15); opacity: .7; } }
  .mid { position: relative; display: flex; gap: 14px; align-items: center; }
  .ring { width: 70px; height: 70px; flex: none; overflow: visible; }
  .tr { stroke: rgba(255,255,255,.08); stroke-width: 13; }
  .arc { stroke-width: 13; stroke-linecap: round; transition: stroke-dashoffset 2.2s cubic-bezier(.2,.8,.2,1) .3s; }
  .head { transform-origin: 60px 60px; transition: transform 2.2s cubic-bezier(.2,.8,.2,1) .3s; }
  .pc { font-size: 26px; font-weight: 700; letter-spacing: -.5px; fill: #F6E3A1; font-variant-numeric: tabular-nums; }
  .pc.over { fill: #FF8A7E; }
  .rt { min-width: 0; flex: 1; }
  .l { font-size: 12.5px; line-height: 1.3; color: #9A917B; }
  .n { font-size: 30px; font-weight: 700; letter-spacing: -.04em; line-height: 1.05; margin: 2px 0; white-space: nowrap; font-variant-numeric: tabular-nums;
    background: linear-gradient(100deg, #B8892B 0%, #F6E3A1 34%, #FFF6D6 50%, #F6E3A1 66%, #B8892B 100%); background-size: 260% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent; animation: bgSweep 6s ease-in-out infinite; }
  .n small { font-size: 18px; font-weight: 600; margin-left: 3px; opacity: .8; }
  .n.over { background: none; color: #FF8A7E; animation: none; }
  .st { position: relative; display: flex; margin-top: 9px; padding-top: 8px; border-top: .5px solid rgba(255,255,255,.08); }
  .st > div { flex: 1; min-width: 0; }
  .st > div.r { text-align: right; }
  .st i { display: block; font-style: normal; font-size: 11.5px; color: #9A917B; }
  .st b { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
