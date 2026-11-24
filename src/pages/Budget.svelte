<script>
  import { onMount } from 'svelte';
  import Screen from '../lib/Screen.svelte';
  import Skeleton from '../lib/Skeleton.svelte';
  import Icon from '../lib/Icon.svelte';
  import { bg, bd, openCats, openPlan, openDist } from '../lib/budget.svelte.js';
  import { loadBudgetMonth, monthKey } from '../lib/budget.js';
  import { fmt } from '../lib/format.js';

  const MON = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const now = new Date();
  const cur = now.getFullYear() * 12 + now.getMonth();
  let pick = $state(false), err = $state('');
  const ym = $derived(bg.ym);
  const month = $derived(monthKey(Math.floor(ym / 12), ym % 12));
  const d = $derived(bd[month]);
  const months = Array.from({ length: 8 }, (_, i) => cur - 5 + i);

  async function load(m = month) {
    try { bd[m] = await loadBudgetMonth(m); err = ''; } catch (e) { if (!bd[m]) err = e.message || 'Не удалось загрузить'; }
  }
  onMount(() => { load(); });
  $effect(() => { month; if (!bd[month]) load(month); else load(month); });
  // после закрытия любого окна бюджета цифры на экране обновляются
  let was = false;
  $effect(() => { const open = bg.cats || bg.plan || bg.dist; if (was && !open) load(); was = open; });

  // доля месяца, которая уже прошла
  const days = $derived(new Date(Math.floor(ym / 12), ym % 12 + 1, 0).getDate());
  const day = $derived(ym < cur ? days : ym > cur ? 0 : now.getDate());
  const T = $derived(day / days);
  const left = $derived(Math.max(0, days - day));
  const pace = (c) => (c.mode === 'spread' ? c.plan * T : c.mode === 'chunks' ? c.plan / c.parts * Math.min(c.parts, Math.max(1, Math.ceil(T * c.parts - 1e-9))) : 0);

  function info(c) {
    const o = { cap: '', tone: '', ticks: [], w: c.plan > 0 ? Math.min(100, c.fact / c.plan * 100) : 0 };
    if (c.plan > 0 && c.fact > c.plan) { o.cap = `перерасход ${fmt(c.fact - c.plan)} ₴`; o.tone = 'o'; return o; }
    if (!c.plan) { o.cap = c.fact ? 'без плана' : ''; return o; }
    if (c.mode === 'lump') { if (c.fact >= c.plan) { o.cap = 'оплачено ✓'; o.tone = 'g'; } else o.cap = 'разово · ждёт оплаты'; return o; }
    const e = pace(c);
    if (c.mode === 'spread') {
      o.ticks = [{ at: T * 100 }];
      const dd = c.fact - e;
      if (c.fact > e * 1.2 && dd >= Math.max(100, c.plan * .03)) { o.cap = `впереди на ${fmt(dd)} ₴` + (left ? ` · по ${fmt((c.plan - c.fact) / left)} ₴/день` : ''); o.tone = 'w'; }
    } else {
      const due = Math.min(c.parts, Math.max(1, Math.ceil(T * c.parts - 1e-9)));
      for (let k = 1; k < c.parts; k++) o.ticks.push({ at: k / c.parts * 100, f: k !== due });
      const need = e - c.fact;
      o.cap = need > 0 ? `порция ${due} из ${c.parts} · ещё ${fmt(need)} ₴` : 'порция в графике';
    }
    return o;
  }
  const exp = $derived((d?.cats ?? []).filter((c) => !c.income && !c.debt && (c.plan > 0 || c.fact > 0)));
  const mand = $derived(exp.filter((c) => c.mand && c.plan > 0));
  const opt = $derived(exp.filter((c) => !c.mand && c.plan > 0));
  const out = $derived([...(d?.cats ?? []).filter((c) => !c.income && c.debt && c.fact > 0), ...exp.filter((c) => !c.plan && c.fact > 0)]);
  const inc = $derived((d?.cats ?? []).filter((c) => c.income));
  const sum = (l, k) => l.reduce((s, x) => s + x[k], 0);
  const planned = $derived(sum([...mand, ...opt], 'plan'));
  const spent = $derived(sum([...mand, ...opt], 'fact'));
  const perDay = $derived(left ? [...mand, ...opt].filter((c) => c.mode === 'spread' && c.plan > c.fact).reduce((s, c) => s + c.plan - c.fact, 0) / left : 0);
  const badge = $derived(ym === cur ? Math.round((d?.free ?? []).reduce((s, v) => s + v, 0)) : 0);
  const incGroups = $derived(['Аванс', 'Зарплата', 'Другое'].map((g, i) => { const l = inc.filter((c) => c.grp === g); return { g, l, plan: sum(l, 'plan'), got: sum(l, 'fact'), free: d?.free[i] ?? 0 }; }).filter((x) => x.l.length));
</script>

<Screen title="Бюджет">
  <div class="hd">
    <button class="mp" class:o={pick} onclick={() => (pick = !pick)}>{MON[ym % 12]} {Math.floor(ym / 12)}<Icon name="chevron" size={14} /></button>
    <div class="pop" class:o={pick}>{#each months as m (m)}<button class:on={m === ym} onclick={() => { bg.ym = m; pick = false; }}>{MON[m % 12]} {Math.floor(m / 12)}{#if m === cur}<small>сейчас</small>{/if}</button>{/each}</div>
  </div>

  {#if !d}
    {#if err}<p class="er">{err}</p>{:else}<Skeleton count={10} />{/if}
  {:else}
    <div class="cd">
      <i class="au"></i>
      <div class="cap"><span class="dot"></span>Бюджет · потрачено</div>
      <div class="big"><div class="v">{fmt(spent)}<small>₴</small></div><div class="of">{#if spent > planned}<b>перерасход {fmt(spent - planned)} ₴</b>{/if}из {fmt(planned)} ₴</div></div>
      <div class="trk"><i class:ov={spent > planned} style:width="{planned ? Math.min(100, spent / planned * 100) : 0}%"></i><s style:left="{T * 100}%"></s></div>
      <div class="kp"><span>Можно в день<b>{left && ym >= cur ? '≈ ' + fmt(perDay) + ' ₴' : '—'}</b></span><span>Осталось<b>{left} дн.</b></span><span>Вне плана<b>{fmt(sum(out, 'fact'))} ₴</b></span></div>
    </div>

    <div class="acts">
      <button class="ab p" onclick={openPlan}><Icon name="chart" size={17} />План</button>
      <button class="ab" onclick={openCats}><Icon name="tag" size={17} />Категории</button>
      <button class="ab" onclick={openDist}><Icon name="swap" size={17} />Разложить{#if badge > 0}<span class="bd">{fmt(badge)}</span>{/if}</button>
    </div>

    {#snippet group(h, l)}
      {#if l.length}
        <h2>{h}<span><b>{fmt(sum(l, 'fact'))}</b> из {fmt(sum(l, 'plan'))} ₴</span></h2>
        <div class="grp">{#each l as c (c.id)}{@const x = info(c)}
          <button class="r" onclick={openPlan}>
            <div class="ic"><Icon name={c.icon} size={17} /></div>
            <div class="m"><b>{c.name}</b>{#if x.cap}<small class={x.tone}>{x.cap}</small>{/if}
              <div class="bar"><i class={x.tone === 'o' ? 'o' : x.tone === 'w' ? 'w' : ''} style:width="{x.w}%"></i>{#each x.ticks as t}<s class:f={t.f} style:left="{t.at}%"></s>{/each}</div></div>
            <div class="rt" class:o={x.tone === 'o'}>{x.tone === 'o' ? '−' + fmt(c.fact - c.plan) : fmt(Math.max(0, c.plan - c.fact))} ₴<small>из {fmt(c.plan)}</small></div>
          </button>{/each}</div>
      {/if}
    {/snippet}
    {@render group('Обязательные', mand)}
    {@render group('Необязательные', opt)}

    {#if out.length}
      <h2>Вне плана<span><b>{fmt(sum(out, 'fact'))}</b> ₴</span></h2>
      <div class="grp">{#each out as c (c.id)}<div class="r"><div class="ic re"><Icon name={c.icon} size={17} /></div><div class="m"><b>{c.name}</b><small>{c.debt ? 'погашение долга' : 'без плана'}</small></div><div class="rt o">−{fmt(c.fact)} ₴</div></div>{/each}</div>
    {/if}

    <h2>Доходы<span><b>{fmt(sum(inc, 'fact'))}</b> из {fmt(sum(inc, 'plan'))} ₴</span></h2>
    <div class="grp">{#each incGroups as x (x.g)}
      <button class="r" onclick={openDist}>
        <div class="ic"><Icon name={x.g === 'Аванс' ? 'card' : x.g === 'Зарплата' ? 'wallet' : 'swap'} size={17} /></div>
        <div class="m"><b>{x.g}</b><small>{ym === cur && x.free > 0 ? 'не распределено ' + fmt(x.free) + ' ₴' : x.l.map((c) => c.name).slice(0, 3).join(', ')}</small></div>
        <div class="rt">{#if x.got > 0 && x.got >= x.plan}<span class="ok">✓ {fmt(x.got)} ₴</span>{:else if x.got > 0}{fmt(x.got)} ₴<small>из {fmt(x.plan)}</small>{:else}<span class="mu">{fmt(x.plan)} ₴</span><small>ожидается</small>{/if}</div>
      </button>{/each}</div>
  {/if}
</Screen>

<style>
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  .hd { position: relative; display: flex; justify-content: flex-end; margin: -46px 0 12px; height: 34px; }
  .mp { display: flex; align-items: center; gap: 5px; height: 34px; padding: 0 13px; border-radius: 99px; background: var(--card); box-shadow: var(--shadow), inset 0 0 0 .5px var(--line); font-size: 14px; font-weight: 600; color: var(--gold); }
  .mp :global(svg) { transition: transform .25s; } .mp.o :global(svg) { transform: rotate(180deg); }
  .pop { position: absolute; right: 0; top: 42px; z-index: 20; min-width: 190px; border-radius: 16px; background: var(--glass); backdrop-filter: blur(24px) saturate(1.6); -webkit-backdrop-filter: blur(24px) saturate(1.6); box-shadow: 0 12px 36px rgba(0, 0, 0, .28), inset 0 0 0 .5px var(--rim); padding: 6px; opacity: 0; transform: scale(.9) translateY(-6px); transform-origin: top right; pointer-events: none; transition: .22s cubic-bezier(.2, .9, .3, 1.2); }
  .pop.o { opacity: 1; transform: none; pointer-events: auto; }
  .pop button { display: flex; justify-content: space-between; width: 100%; padding: 11px 12px; border-radius: 11px; font-size: 15px; } .pop button.on { background: var(--gold-soft); color: var(--gold); font-weight: 600; } .pop small { color: var(--muted); font-size: 12px; }
  .cd { position: relative; border-radius: 26px; overflow: hidden; color: #F4EEDD; padding: 16px 18px; background: radial-gradient(120% 140% at 85% 0%, #2b2310, #101010 62%); box-shadow: 0 0 0 .5px rgba(232, 194, 119, .45), 0 14px 30px -16px rgba(232, 194, 119, .35), inset 0 1px 0 rgba(255, 232, 160, .35); }
  .au { position: absolute; right: -40px; top: -50px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 190, 90, .28), rgba(244, 190, 90, 0) 66%); animation: br 6s ease-in-out infinite; pointer-events: none; }
  @keyframes br { 50% { transform: scale(1.2); opacity: .6; } }
  .cap { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a99366; }
  .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: #E8C277; } .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #E8C277; animation: pl 2.2s ease-out infinite; }
  @keyframes pl { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.4); opacity: 0; } }
  .big { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; margin: 8px 0 12px; }
  .v { font-size: 40px; font-weight: 700; letter-spacing: -.03em; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; } .v small { font-size: .45em; color: #E8C277; margin-left: 3px; }
  .of { font-size: 12.5px; color: #a99366; text-align: right; line-height: 1.35; } .of b { color: #FF8A7E; font-weight: 600; display: block; font-size: 14px; }
  .trk { position: relative; height: 8px; border-radius: 99px; background: rgba(232, 194, 119, .16); }
  .trk i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, #9C7420, #F6E3A1); transition: width 1s cubic-bezier(.2, .8, .2, 1); } .trk i.ov { background: linear-gradient(90deg, #C2352B, #FF8A7E); }
  .trk s { position: absolute; top: -4px; bottom: -4px; width: 2px; border-radius: 1px; background: #fff; opacity: .85; }
  .kp { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 20px; border-top: .5px solid rgba(232, 194, 119, .18); padding-top: 11px; font-size: 12px; color: #a99366; }
  .kp span { display: flex; flex-direction: column; gap: 2px; } .kp span + span { padding-left: 14px; border-left: .5px solid rgba(232, 194, 119, .18); } .kp b { color: #F4EEDD; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 20px; }
  .ab { position: relative; height: 44px; border-radius: 14px; background: var(--card); box-shadow: var(--shadow); display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--gold); transition: transform .15s; } .ab:active { transform: scale(.95); }
  .ab.p { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; }
  .bd { position: absolute; top: -6px; right: 4px; background: var(--neg); color: #fff; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 99px; }
  h2 { display: flex; justify-content: space-between; margin: 0 16px 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; }
  h2 span { text-transform: none; letter-spacing: 0; font-weight: 400; } h2 span b { color: var(--text); font-weight: 600; }
  .grp { background: var(--card); border-radius: 16px; margin-bottom: 22px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 14px; text-align: left; position: relative; min-height: 56px; transition: background .15s; } .r:active { background: var(--fill); }
  .r + .r::before { content: ""; position: absolute; left: 58px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 34px; height: 34px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: grid; place-items: center; flex: none; } .ic.re { background: rgba(215, 0, 21, .1); color: var(--neg); }
  .m { flex: 1; min-width: 0; } .m b { display: block; font-weight: 500; } .m small { display: block; font-size: 11.5px; color: var(--muted); margin-top: 1px; }
  .m small.w { color: #B07416; } .m small.o { color: var(--neg); } .m small.g { color: var(--pos); }
  .bar { position: relative; height: 4px; border-radius: 2px; background: rgba(118, 118, 128, .2); margin-top: 6px; }
  .bar i { display: block; height: 100%; border-radius: 2px; background: var(--gold); transition: width .8s cubic-bezier(.2, .8, .2, 1); } .bar i.w { background: #E8A33A; } .bar i.o { background: var(--neg); }
  .bar s { position: absolute; top: -3px; bottom: -3px; width: 2px; border-radius: 1px; background: var(--text); opacity: .65; } .bar s.f { opacity: .2; }
  .rt { text-align: right; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; } .rt small { display: block; font-weight: 400; font-size: 11.5px; color: var(--muted); }
  .rt.o { color: var(--neg); } .ok { color: var(--pos); } .mu { color: var(--muted); font-weight: 400; }
  .er { text-align: center; color: var(--neg); }
</style>
