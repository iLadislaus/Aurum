<script>
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import { an, closeAnalytics } from './analytics.svelte.js';
  import { loadAnalytics } from './analytics.js';
  import { openCatOps } from './budget.svelte.js';
  import { opsLoader } from './data.js';
  import { openOp } from './opcard.svelte.js';
  import { peek, refresh } from './cache.svelte.js';
  import { fmt, cash } from './format.js';

  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const now = new Date(), cur = now.getFullYear() * 12 + now.getMonth();
  let full = $state(false), tab = $state(0), d = $state(null), err = $state(''), ops = $state(null), pick = $state(-1);

  $effect(() => { if (an.open) { const t = setTimeout(() => (full = true), 0); return () => clearTimeout(t); } });
  $effect(() => { if (an.open) { tab = 0; pick = -1; } });

  const ym = $derived(an.ym);
  const opsKey = $derived(`ops.m.${Math.floor(ym / 12)}-${ym % 12}`);
  $effect(() => {
    if (!an.open) return;
    const v = ym, k = opsKey; err = ''; d = null; ops = peek(k)?.ops ?? peek(k) ?? null;
    loadAnalytics(v).then((r) => { if (an.ym === v) d = r; }).catch((e) => { err = e.message || 'Не удалось загрузить'; });
    refresh(k, opsLoader(k)).then((r) => { if (an.ym === v) ops = r; }).catch(() => {});
  });

  const sel = $derived(pick < 0 ? 5 : pick);
  const mo = $derived(d?.months[sel]);
  const prev = $derived(d?.months[sel - 1]);
  const showYm = $derived(d ? d.months[sel].ym : ym);
  const lbl = $derived(`${FULL[showYm % 12]} ${Math.floor(showYm / 12)}`);
  const series = $derived((d?.months ?? []).map((m) => (tab === 0 ? m.exp : tab === 1 ? m.inc : m.inc - m.exp)));
  const mx = $derived(Math.max(1, ...series.map((v) => Math.abs(v))));
  const avg = $derived(series.length ? series.reduce((s, v) => s + v, 0) / series.length : 0);
  const val = $derived(series[sel] ?? 0);
  const delta = $derived(prev && tab < 2 ? ((tab === 0 ? prev.exp : prev.inc) ? Math.round(((val - (tab === 0 ? prev.exp : prev.inc)) / (tab === 0 ? prev.exp : prev.inc)) * 100) : null) : null);
  const rate = $derived(mo && mo.inc > 0 ? Math.round(((mo.inc - mo.exp) / mo.inc) * 100) : null);

  const rows = $derived(mo ? d.cats.filter((c) => !c.income && (mo.byCat[c.id] || 0) > 0).map((c) => ({ ...c, v: mo.byCat[c.id] })).sort((a, b) => b.v - a.v) : []);
  const top = $derived((ops?.ops ?? ops ?? []).filter((o) => o.action === 'EXPENSE' && !o.foreign && showYm === ym).sort((a, b) => a.v - b.v).slice(0, 3));
  const COL = { 'Аванс': '#C99A3E', 'Зарплата': '#F0CB82', 'Другое': '#8E8E93' };
  const grp = $derived(mo ? Object.entries(mo.byGrp).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : []);
  const arcs = $derived((() => { let o = 0; return grp.map(([g, v]) => { const p = mo.inc ? (v / mo.inc) * 100 : 0; const a = { g, v, p, o }; o += p; return a; }); })());

  const step = (k) => { const v = ym + k; if (v <= cur) { an.ym = v; pick = -1; } };
</script>

<Sheet open={an.open} onclose={closeAnalytics} title="Аналитика" sub={lbl} z={50} bind:full>
  <div class="wrap">
    <div class="top">
      <div class="seg" style:--p={tab}><i></i>
        {#each ['Расходы', 'Доходы', 'Итог'] as t, i}<button class:on={tab === i} onclick={() => (tab = i)}>{t}</button>{/each}
      </div>
      <div class="mn"><button onclick={() => step(-1)} aria-label="Раньше"><Icon name="back" size={16} /></button><button class="nx" disabled={ym >= cur} onclick={() => step(1)} aria-label="Позже"><Icon name="back" size={16} /></button></div>
    </div>

    {#if !d}
      <p class="msg">{err || 'Считаю…'}</p>
    {:else}
      {#key tab + '' + ym}
      <div class="card rise">
        <div class="tot">
          <div class="v" class:pos={tab === 2 && val >= 0} class:neg={tab === 2 && val < 0}>{tab === 2 ? (val >= 0 ? '+' : '−') : ''}{fmt(Math.abs(val))} <small>₴</small></div>
          {#if delta != null}<div class="dl" class:up={tab === 0 ? delta > 0 : delta < 0} class:dn={tab === 0 ? delta <= 0 : delta >= 0}>{delta > 0 ? '▲' : delta < 0 ? '▼' : ''} {Math.abs(delta)}% к {MON[prev.ym % 12]}</div>{:else if tab === 2 && rate != null}<div class="dl" class:dn={rate >= 0} class:up={rate < 0}>сбережения {rate}%</div>{/if}
        </div>
        <small class="mu">{tab === 0 ? 'потрачено' : tab === 1 ? 'получено' : 'доходы − расходы'} · в среднем {fmt(Math.abs(avg))} ₴ за 6 мес.</small>
        <div class="bars">
          {#each d.months as m, i}
            <button class="bc" class:on={i === sel} style="--i:{i};--h:{Math.max(3, (Math.abs(series[i]) / mx) * 100)}%" onclick={() => (pick = i)}>
              <i class:neg={series[i] < 0}></i><span>{MON[m.ym % 12]}</span>
            </button>
          {/each}
        </div>
      </div>

      {#if tab === 0}
        <div class="sec"><span>По категориям</span><span>% от расходов</span></div>
        <div class="card cl">
          {#each rows as c, i (c.id)}
            <button class="row" style="--i:{i}" onclick={() => openCatOps(c, showYm)}>
              <OpAvatar icon={c.icon} size={30} />
              <div class="m"><b>{c.name}<span>{fmt(c.v)} ₴</span></b><div class="b"><i style="--w:{Math.round((c.v / rows[0].v) * 100)}%"></i></div></div>
              <small>{mo.exp > 0 ? Math.round((c.v / mo.exp) * 100) : 0}%</small>
            </button>
          {:else}<p class="msg">Расходов за месяц нет</p>{/each}
        </div>
        {#if top.length}
          <div class="sec"><span>Самые крупные траты</span></div>
          <div class="card cl">
            {#each top as o (o.id)}
              <button class="row" onclick={() => openOp(o, opsKey)}>
                <OpAvatar icon={o.icon} size={30} />
                <div class="m"><b>{o.name}<span>{cash(o.v, 0)}</span></b><small class="sm">{o.cat}</small></div>
              </button>
            {/each}
          </div>
        {/if}
      {:else if tab === 1}
        <div class="sec"><span>Источники дохода</span></div>
        <div class="card dn2">
          {#if arcs.length}
            <svg width="110" height="110" viewBox="0 0 36 36">
              {#each arcs as a, i}<circle cx="18" cy="18" r="14" pathLength="100" stroke={COL[a.g]} style="--d:{a.p};--i:{i};stroke-dashoffset:{-a.o}" />{/each}
            </svg>
            <div class="lg">{#each arcs as a}<span><i style="background:{COL[a.g]}"></i>{a.g}<b>{fmt(a.v)}</b></span>{/each}</div>
          {:else}<p class="msg">Доходов за месяц нет</p>{/if}
        </div>
      {:else}
        <div class="sec"><span>Месяц</span></div>
        <div class="card kp">
          <span>Доходы<b class="pos">+{fmt(mo.inc)} ₴</b></span>
          <span>Расходы<b>−{fmt(mo.exp)} ₴</b></span>
        </div>
      {/if}
      {/key}
    {/if}
  </div>
</Sheet>

<style>
  .wrap { padding: 0 14px 28px; min-height: 60vh; }
  .top { display: flex; align-items: center; gap: 10px; margin: 2px 0 12px; }
  .seg { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); background: var(--fill); border-radius: 11px; padding: 2px; position: relative; }
  .seg i { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 3); background: var(--card); border-radius: 9px; box-shadow: 0 1px 4px rgba(0,0,0,.15); transform: translateX(calc(var(--p) * 100%)); transition: transform .3s cubic-bezier(.2,.8,.2,1); }
  .seg button { position: relative; z-index: 1; height: 30px; font-size: 13px; font-weight: 600; color: var(--muted); background: none; border: 0; transition: color .25s; }
  .seg button.on { color: var(--text); }
  .mn { display: flex; gap: 4px; }
  .mn button { width: 34px; height: 34px; border-radius: 99px; display: grid; place-items: center; background: var(--card); box-shadow: var(--shadow), inset 0 0 0 .5px var(--line); color: var(--gold); border: 0; }
  .mn .nx { transform: scaleX(-1); } .mn button:disabled { opacity: .35; }
  .card { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); padding: 14px; }
  .cl { padding: 4px 14px; }
  .tot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .v { font-size: 26px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; } .v small { font-size: .55em; color: var(--muted); }
  .pos { color: var(--pos); } .neg { color: var(--neg); }
  .dl { font-size: 13px; font-weight: 600; white-space: nowrap; } .up { color: var(--neg); } .dn { color: var(--pos); }
  .mu { color: var(--muted); font-size: 12px; }
  .bars { display: flex; align-items: flex-end; gap: 9px; height: 120px; margin-top: 10px; }
  .bc { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 5px; background: none; border: 0; padding: 0; cursor: pointer; }
  .bc i { width: 100%; border-radius: 7px 7px 3px 3px; background: var(--bar); height: 0; animation: up .9s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: calc(var(--i) * 70ms); transition: background .2s; }
  .bc.on i { background: linear-gradient(180deg, #F6E3A1, #B8862C); } .bc.on i.neg { background: linear-gradient(180deg, #FF8A7E, #C2352B); }
  .bc span { font-size: 11px; color: var(--muted); } .bc.on span { color: var(--gold); font-weight: 600; }
  @keyframes up { to { height: var(--h); } }
  .sec { margin: 18px 4px 8px; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; display: flex; justify-content: space-between; }
  .row { display: flex; align-items: center; gap: 11px; padding: 9px 0; width: 100%; text-align: left; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; }
  .row + .row { border-top: .5px solid var(--line); }
  .row .m { flex: 1; min-width: 0; } .row b { font-weight: 500; display: flex; justify-content: space-between; gap: 8px; } .row b span { font-variant-numeric: tabular-nums; }
  .row > small { color: var(--muted); font-size: 12px; width: 34px; text-align: right; } .sm { color: var(--muted); font-size: 12px; }
  .b { height: 6px; border-radius: 99px; background: var(--bar); margin-top: 6px; overflow: hidden; }
  .b i { display: block; height: 100%; width: 0; border-radius: 99px; background: linear-gradient(90deg, #9C7420, #F6E3A1); animation: grow 1s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: calc(var(--i) * 60ms + .2s); }
  @keyframes grow { to { width: var(--w); } }
  .dn2 { display: flex; align-items: center; gap: 16px; }
  .dn2 svg { flex: none; transform: rotate(-90deg); } .dn2 circle { fill: none; stroke-width: 14; stroke-dasharray: 0 100; animation: ds 1.1s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: calc(var(--i) * 120ms); }
  @keyframes ds { to { stroke-dasharray: var(--d) 100; } }
  .lg { flex: 1; display: flex; flex-direction: column; gap: 7px; font-size: 13px; } .lg span { display: flex; align-items: center; gap: 7px; } .lg i { width: 9px; height: 9px; border-radius: 3px; } .lg b { margin-left: auto; font-weight: 600; font-variant-numeric: tabular-nums; }
  .kp { display: grid; grid-template-columns: 1fr 1fr; } .kp span { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--muted); } .kp span + span { padding-left: 14px; border-left: .5px solid var(--line); } .kp b { font-size: 17px; color: var(--text); font-variant-numeric: tabular-nums; } .kp b.pos { color: var(--pos); }
  .msg { text-align: center; color: var(--muted); padding: 28px 0; font-size: 14px; }
  .rise { animation: rise .4s cubic-bezier(.2,.8,.2,1) both; } @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
</style>
