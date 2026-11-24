<script>
  import Icon from '../lib/Icon.svelte';
  import OpAvatar from '../lib/OpAvatar.svelte';
  import { openNewPay } from '../lib/newpay.svelte.js';
  import { hz, inRange, RANGE_NAME } from '../lib/horizon.svelte.js';
  import { fmt, money, plural } from '../lib/format.js';
  let { d, shown, month, onaccounts, onbudget, onhorizon } = $props();

  const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const parts = (v) => { const s = fmt(Math.abs(v), 2), i = s.lastIndexOf(','); return [s.slice(0, i), s.slice(i)]; };
  let sp = $derived(parts(d.total));
  // чем длиннее сумма, тем мельче шрифт, чтобы любая сумма помещалась рядом с колонкой «Карты/Конверты/Сегодня»
  let fs = $derived(sp[0].length <= 6 ? 42 : sp[0].length <= 8 ? 36 : sp[0].length <= 10 ? 30 : 26);

  // бюджет
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  let remaining = $derived(d.budget.plan - d.budget.spent);
  let over = $derived(remaining < 0);
  let ratio = $derived(d.budget.plan > 0 ? Math.max(0, d.budget.spent / d.budget.plan) : 0);
  let arc = $derived(Math.min(1, ratio));
  let perDay = $derived(Math.max(0, remaining) / Math.max(1, daysLeft));

  // на горизонте: платежи на 14 дней
  let soon = $derived(inRange(d.horizon, hz.range));
  let soonSum = $derived(soon.reduce((s, p) => s + p.amount, 0));
</script>

<div class="cd" id="hz-anchor" class:in={shown}>
  <i class="au" aria-hidden="true"></i>
  <div class="s top" role="button" tabindex="0" aria-label="Открыть счета" onclick={onaccounts} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onaccounts?.())}>
    <div class="lf">
      <div class="cap"><span class="dot"></span>Общий баланс <i>· {stamp}</i></div>
      <div class="sum" style:font-size="{fs}px"><span class="num">{sp[0]}</span><small>{sp[1]}&nbsp;₴</small></div>
    </div>
    <div class="kp">
      <span>Карты<b>{money(d.cardsCash ?? 0)}</b></span>
      <span>Конверты<b>{money(d.envs ?? 0)}</b></span>
      <span>Сегодня<b>{(d.today ?? 0) > 0 ? '−' : ''}{money(d.today ?? 0)}</b></span>
    </div>
  </div>

  <button class="s bud" onclick={onbudget} aria-label="Открыть бюджет">
    <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="smRg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C7420" /><stop offset="1" stop-color="#F6E3A1" /></linearGradient>
        <linearGradient id="smRo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C2352B" /><stop offset="1" stop-color="#FF8A7E" /></linearGradient>
      </defs>
      <g transform="rotate(-90 60 60)">
        <circle cx="60" cy="60" r="46" fill="none" class="tr" />
        <circle cx="60" cy="60" r="46" fill="none" class="arc" pathLength="1" stroke-dasharray="1" stroke-dashoffset={shown ? 1 - arc : 1} stroke={over ? 'url(#smRo)' : 'url(#smRg)'} />
      </g>
      <text x="60" y="68" text-anchor="middle" class="pc" class:over>{Math.round(ratio * 100)}%</text>
    </svg>
    <div class="bm"><b>Бюджет на {month}</b><small>{over ? `перерасход ${money(-remaining)}` : `осталось ${money(remaining)} из ${money(d.budget.plan)}`}</small></div>
    <div class="bd"><small>{over ? 'Лимит' : 'Можно в день'}</small><b>{money(over ? d.budget.plan : perDay)}</b><em>{daysLeft % 10 === 1 && daysLeft % 100 !== 11 ? 'остался' : 'осталось'} {daysLeft} {plural(daysLeft, 'день', 'дня', 'дней')}</em></div>
  </button>

  <div class="s hz">
    <div class="hh">
      <button class="ht" onclick={onhorizon} aria-label="На горизонте"><b>На горизонте</b> {#if soon.length}<i>· {RANGE_NAME[hz.range]} · {money(soonSum)}</i>{/if}</button>
      <button class="pl" onclick={() => openNewPay()} aria-label="Новый платёж"><Icon name="plus" size={16} /></button>
    </div>
    {#if soon.length}
      <div class="chs">
        {#each soon as p (p.id)}
          <button class="chip" onclick={onhorizon} aria-label={p.name}>
            <OpAvatar icon={p.icon} name={p.name} size={26} />
            <span><b>{p.name}</b><small>{p.days <= 0 ? 'сегодня' : p.days + ' дн'} · {money(p.amount)}</small></span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .cd { position: relative; border-radius: 26px; overflow: hidden; color: #F4EEDD; font-variant-numeric: tabular-nums; user-select: none; -webkit-user-select: none;
    background: radial-gradient(120% 140% at 85% 0%, #2b2310, #101010 62%); box-shadow: 0 0 0 .5px rgba(232,194,119,.45), 0 14px 30px -16px rgba(232,194,119,.35), inset 0 1px 0 rgba(255,232,160,.35);
    opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .cd.in { opacity: 1; transform: none; }
  .au { position: absolute; right: -40px; top: -50px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(244,190,90,.28), rgba(244,190,90,0) 66%); animation: smBr 6s ease-in-out infinite; pointer-events: none; }
  @keyframes smBr { 50% { transform: scale(1.2); opacity: .6; } }
  .s { position: relative; display: flex; align-items: center; width: 100%; text-align: left; padding: 14px 18px; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background .15s; }
  .s + .s { border-top: .5px solid rgba(232,194,119,.18); }
  .s:active { background: rgba(232,194,119,.06); }
  .top { gap: 12px; align-items: stretch; justify-content: space-between; }
  .lf { flex: 1; min-width: 0; min-height: 112px; display: flex; flex-direction: column; }
  .cap { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a99366; margin-bottom: 2px; }
  .cap i { font-style: normal; opacity: .75; }
  .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: #E8C277; flex: none; }
  .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #E8C277; animation: smPl 2.2s ease-out infinite; }
  @keyframes smPl { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.4); opacity: 0; } }
  .sum { flex: none; margin: auto 0; padding-bottom: 6px; min-width: 0; display: flex; align-items: baseline; justify-content: center; font-size: 42px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; white-space: nowrap; }
  .sum small { font-size: .5em; font-weight: 700; letter-spacing: 0; margin-left: .06em; color: #E8C277; }
  .kp { flex: none; width: 122px; display: flex; flex-direction: column; font-size: 12px; color: #a99366; margin-top: 2px; }
  .kp span { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; }
  .kp span + span { border-top: .5px solid rgba(232,194,119,.18); }
  .kp b { color: #F4EEDD; font-weight: 600; white-space: nowrap; }

  .bud { gap: 14px; }
  .ring { width: 54px; height: 54px; flex: none; overflow: visible; }
  .tr { stroke: rgba(232,194,119,.18); stroke-width: 13; }
  .arc { stroke-width: 13; stroke-linecap: round; transition: stroke-dashoffset 2s cubic-bezier(.2,.8,.2,1) .3s; }
  .pc { font-size: 28px; font-weight: 700; fill: #F6E3A1; }
  .pc.over { fill: #FF8A7E; }
  .bm { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .bm b { font-size: 17px; }
  .bm small { font-size: 12.5px; color: #a99366; margin-top: 2px; }
  .bd { flex: none; text-align: right; display: flex; flex-direction: column; }
  .bd small, .bd em { font-size: 12.5px; color: #a99366; font-style: normal; }
  .bd em { margin-top: 2px; }
  .bd b { font-size: 16px; white-space: nowrap; }

  .hz { flex-direction: column; align-items: stretch; gap: 0; font-size: 14px; padding: 0; cursor: default; }
  .hh { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 8px 0 18px; min-height: 48px; }
  .chs { display: flex; gap: 8px; overflow-x: auto; padding: 0 14px 12px 18px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  .chs::-webkit-scrollbar { display: none; }
  .chip { flex: none; display: flex; align-items: center; gap: 8px; padding: 5px 14px 5px 5px; border-radius: 99px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 0 0 .5px rgba(232, 194, 119, .2); color: inherit; text-align: left; }
  .chip span { display: flex; flex-direction: column; line-height: 15px; }
  .chip b { font-size: 13px; font-weight: 600; }
  .chip small { font-size: 11.5px; color: #a99366; }
  .hz:active { background: none; }
  .ht { flex: 1; min-width: 0; text-align: left; color: inherit; min-height: 48px; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
  .ht b { font-size: 15px; flex: none; }
  .ht i { font-style: normal; color: #a99366; overflow: hidden; text-overflow: ellipsis; }
  .pl { flex: none; width: 44px; height: 44px; display: grid; place-items: center; color: #E8C277; }
  @media (prefers-reduced-motion: reduce) { .au, .dot::after { animation: none; } }
</style>
