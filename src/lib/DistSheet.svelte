<script>
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import { bg, closeDist } from './budget.svelte.js';
  import { loadBudgetCats, loadPlan, loadDist, formDist, undoDist, monthKey } from './budget.js';
  import { refresh, peek } from './cache.svelte.js';
  import { prefetchAll } from './prefetch.js';
  import { fmt, plural } from './format.js';

  const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const now = new Date();
  const month = monthKey(now.getFullYear(), now.getMonth());
  const label = `${MON[now.getMonth()]} ${now.getFullYear()}`;
  const TABS = ['Аванс', 'Зарплата', 'Другое'];
  const PAL = ['#F6E3A1', '#B8862C', '#E8C277', '#9C7420', '#D9B24C', '#C99A3C', '#8A6212'];

  let full = $state(false);
  let view = $state(1), t = $state(0), covO = $state(false), busy = $state(false), err = $state('');
  let plan = $state({}), got = $state({}), dist = $state(null);
  let A = $state({});            // catId → [аванс, зарплата, другое]
  let txt = $state({});          // подписи в полях текущей вкладки
  let batch = $state(null), left = $state(0), timer = 0;
  const d = $derived(peek('bcats'));

  $effect(() => { if (bg.dist) { const x = setTimeout(() => (full = true), 0); return () => clearTimeout(x); } });
  async function load() {
    try {
      await refresh('bcats', loadBudgetCats, true);
      const [p, ds] = await Promise.all([loadPlan(month), loadDist(month)]);
      plan = p.plan; got = p.got; dist = ds;
    } catch (e) { err = e.message || 'Не удалось загрузить'; }
  }
  $effect(() => { if (bg.dist) { view = 1; t = 0; A = {}; txt = {}; err = ''; covO = false; batch = null; clearInterval(timer); load(); } });

  const envOf = (id) => d?.envs.find((e) => e.id === id);
  const idx = (c) => (c.grp === 'Аванс' ? 0 : c.grp === 'Зарплата' ? 1 : 2);
  const gotT = $derived([0, 1, 2].map((k) => (d?.cats ?? []).filter((c) => c.income && idx(c) === k).reduce((s, c) => s + (got[c.id] || 0), 0)));
  const freeT = $derived([0, 1, 2].map((k) => Math.max(0, gotT[k] - (dist?.done[k] ?? 0))));
  const rowsAll = $derived((d?.cats ?? []).filter((c) => !c.income && envOf(c.env)).map((c) => ({ c, need: Math.max(0, (plan[c.id] || 0) - Math.max(0, envOf(c.env).balance)) })));
  const R = $derived(rowsAll.filter((r) => r.need > 0));
  const COV = $derived(rowsAll.filter((r) => r.need <= 0 && (plan[r.c.id] || 0) > 0));
  const a = (id, k) => A[id]?.[k] || 0;
  const tot = (id) => (A[id] || [0, 0, 0]).reduce((s, v) => s + v, 0);
  const used = (k) => R.reduce((s, r) => s + a(r.c.id, k), 0);
  const rem = $derived(freeT[t] - used(t));
  const needAll = $derived(R.reduce((s, r) => s + Math.max(0, r.need - tot(r.c.id)), 0));
  const allSum = $derived(R.reduce((s, r) => s + tot(r.c.id), 0));
  const over = $derived([0, 1, 2].some((k) => used(k) > freeT[k]));
  const isOk = $derived(rem === 0 && freeT[t] > 0);
  const parts = $derived((() => {
    const total = Math.max(freeT[t] > 0 ? freeT[t] : 1, used(t)); let off = 0;
    return R.map((r, i) => { const v = a(r.c.id, t), len = v / total * 100; const o = off; off += len; return { id: r.c.id, len, off: o, col: rem < 0 ? '#FF8A7E' : PAL[i % PAL.length] }; });
  })());
  const num = (v) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
  function ed(id, v) { const arr = [...(A[id] || [0, 0, 0])]; arr[t] = num(v); A[id] = arr; }
  const blur = (id) => { txt[id + ':' + t] = a(id, t) ? fmt(a(id, t)) : ''; };
  const shown = (id) => txt[id + ':' + t] ?? (a(id, t) ? fmt(a(id, t)) : '');
  function autoFill() {
    let r = freeT[t] - used(t);
    const ord = [...R].sort((x, y) => Number(y.c.mand) - Number(x.c.mand));
    for (const row of ord) {
      const need = Math.max(0, row.need - tot(row.c.id)), put = Math.min(need, Math.max(0, r));
      if (put > 0) { const arr = [...(A[row.c.id] || [0, 0, 0])]; arr[t] += put; A[row.c.id] = arr; r -= put; delete txt[row.c.id + ':' + t]; }
    }
  }
  const items = $derived(R.map((r) => ({ cat: r.c.id, env: r.c.env, name: r.c.name, a: A[r.c.id] || [0, 0, 0], icon: r.c.icon, envName: envOf(r.c.env)?.name })).filter((i) => i.a.some((v) => v > 0)));
  const nT = (n) => `${n} ${plural(n, 'перевод', 'перевода', 'переводов')}`;

  async function make() {
    busy = true; err = '';
    try {
      batch = await formDist(month, label, dist.cash, items.map((i) => ({ cat: i.cat, env: i.env, name: i.name, a: i.a })));
      view = 3; left = 60; clearInterval(timer);
      timer = setInterval(() => { left -= 1; if (left <= 0) { clearInterval(timer); batch = null; } }, 1000);
      refresh('bcats', loadBudgetCats, true).catch(() => {}); prefetchAll(true);
    } catch (e) { err = e.message || 'Не удалось создать переводы'; }
    busy = false;
  }
  async function undo() {
    if (!batch) return; busy = true;
    try { await undoDist(month, batch); clearInterval(timer); batch = null; A = {}; txt = {}; view = 1; await load(); prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось отменить'; }
    busy = false;
  }
  const mm = (s) => `0:${String(s).padStart(2, '0')}`;
</script>

<Sheet open={bg.dist} onclose={() => { clearInterval(timer); closeDist(); }} title="Разложить деньги" sub="{label} · из Cash в конверты" bind:full>
  <div class="vp">
    <div class="vs" class:act={view === 1} style:transform="translateX({view === 1 ? 0 : -100}%)" class:off={view !== 1}>
      <div class="cd hz">
        <i class="au"></i>
        <div class="dn" class:ok={isOk} class:bad={rem < 0}><span class="halo"></span>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <g class="orb"><circle cx="60" cy="60" r="57" class="orbit" /><circle cx="60" cy="3" r="2.6" class="sat" /></g>
            <circle cx="60" cy="60" r="44" class="track" />
            <g transform="rotate(-90 60 60)">{#each parts as p (p.id)}<circle cx="60" cy="60" r="44" pathLength="100" class="sg" style:stroke={p.col} style:stroke-dasharray="{Math.max(0.01, p.len - (parts.length > 1 ? 1.8 : 0))} {100 - Math.max(0.01, p.len - (parts.length > 1 ? 1.8 : 0))}" style:stroke-dashoffset={-p.off} />{/each}</g>
          </svg>
          <div class="mid"><small>{rem < 0 ? 'лишнее' : isOk ? 'распределено' : 'осталось'}</small><b>{rem < 0 ? '−' : ''}{fmt(Math.abs(rem))}<em>₴</em></b></div>
        </div>
        <div class="rg">
          <div class="ln"><i style="background:#E8C277"></i><span>Получено</span><b>{fmt(gotT[t])} ₴</b></div>
          <div class="ln"><i style="background:#F6E3A1"></i><span>Разложено</span><b>{fmt(used(t))} ₴</b></div>
          <div class="ln"><i style="background:rgba(232,194,119,.25)"></i><span>Нужно по плану</span><b>{fmt(needAll)} ₴</b></div>
          <div class="stt">{freeT[t] <= 0 ? `${TABS[t]}: пока нечего раскладывать` : rem < 0 ? `Не хватает ${fmt(-rem)} ₴, уменьши суммы` : rem === 0 ? `${TABS[t]}: всё ушло в конверты` : `${TABS[t]}: разложено ${fmt(used(t))} из ${fmt(freeT[t])} ₴`}</div>
        </div>
      </div>
      <div class="seg" style:--i={t}><i class="th"></i>{#each TABS as n, k (n)}<button class:on={k === t} onclick={() => (t = k)}>{n}<small>{fmt(freeT[k])} ₴</small></button>{/each}</div>
      <button class="fill" onclick={autoFill}><Icon name="chart" size={16} />Заполнить по плану</button>

      {#if d && dist}
        {#each [['Обязательные', true], ['Необязательные', false]] as [h, m] (h)}
          {@const l = R.filter((r) => r.c.mand === m)}
          {#if l.length}
            <h2>{h}<span>{l.length}</span></h2>
            <div class="grp">{#each l as r (r.c.id)}
              {@const lf = r.need - tot(r.c.id)}
              <div class="row">
                <div class="ic"><Icon name={r.c.icon} size={17} /></div>
                <div class="m"><b>{r.c.name}</b><small><Icon name="mail" size={13} />Конверт {envOf(r.c.env).name} · нужно {fmt(r.need)} ₴</small>
                  <div class="bar"><i class:d={lf <= 0} style:width="{Math.min(100, tot(r.c.id) / r.need * 100)}%"></i></div></div>
                <div class="rt"><input class="am" inputmode="numeric" placeholder="0" value={shown(r.c.id)} oninput={(e) => ed(r.c.id, e.currentTarget.value)} onfocus={(e) => e.currentTarget.select()} onblur={() => blur(r.c.id)} />
                  <span class="nd" class:ok={lf <= 0}>{lf <= 0 ? (lf < 0 ? 'с запасом ✓' : 'хватает ✓') : 'ещё ' + fmt(lf)}</span></div>
              </div>{/each}</div>
          {/if}
        {/each}
        {#if COV.length}
          <div class="grp more-g">
            <button class="more" class:o={covO} onclick={() => (covO = !covO)}><span>Денег в конверте хватает · {COV.length}</span><Icon name="chevron" size={16} /></button>
            <div class="cov" class:o={covO}><div>{#each COV as r (r.c.id)}<div class="row c"><div class="ic"><Icon name={r.c.icon} size={17} /></div><div class="m"><b>{r.c.name}</b><small><Icon name="mail" size={13} />Конверт {envOf(r.c.env).name}</small></div><span class="nd ok">хватает ✓</span></div>{/each}</div></div>
          </div>
        {/if}
        <p class="hint">Деньги идут из Cash в конверт отдельными переводами. Категории без конверта платятся из Cash напрямую, их раскладывать не нужно.</p>
      {/if}
      {#if err && view === 1}<p class="er">{err}</p>{/if}
    </div>

    <div class="vs" class:act={view === 2} style:transform="translateX({view === 1 ? 100 : view === 2 ? 0 : -100}%)" class:off={view !== 2}>
      <div class="nav"><button class="back" aria-label="Назад" onclick={() => (view = 1)}><Icon name="chevron" size={22} /></button><b>Сформировать</b><span class="sp"></span></div>
      <div class="grp">{#each items as i (i.cat)}<div class="tr"><div class="ic"><Icon name={i.icon} size={17} /></div><div class="arr">Cash <Icon name="arrowup" size={14} /> {i.envName}</div><b>{fmt(i.a.reduce((s, v) => s + v, 0))} ₴</b></div>{/each}</div>
      <div class="sm"><div><span>Переводов будет создано</span><b>{items.length}</b></div><div><span>Всего из Cash</span><b>{fmt(allSum)} ₴</b></div><div><span>Операции с датой</span><b>сегодня</b></div></div>
      <p class="hint">Отменить можно в течение минуты.</p>
      {#if err}<p class="er">{err}</p>{/if}
    </div>

    <div class="vs" class:act={view === 3} style:transform="translateX({view === 3 ? 0 : 100}%)" class:off={view !== 3}>
      <div class="dn3">
        <div class="ckm"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
        <h3>Готово · {nT(items.length)}</h3>
        <p>{fmt(allSum)} ₴ переведено из Cash в конверты</p>
        {#if batch}<button class="undo" disabled={busy} onclick={undo}>Отменить ({mm(left)})</button>{/if}
        {#if err}<p class="er">{err}</p>{/if}
      </div>
    </div>
  </div>
  {#snippet footer()}
    <div class="ft">
      {#if view === 1}<button class="sv" disabled={allSum <= 0 || over || !dist} onclick={() => (view = 2)}>{allSum > 0 ? `Сформировать ${fmt(allSum)} ₴` : 'Сформировать'}</button>
      {:else if view === 2}<button class="sv" disabled={busy || !items.length} onclick={make}>{busy ? 'Создаю…' : `Создать ${nT(items.length)}`}</button>
      {:else}<button class="sv" onclick={() => { clearInterval(timer); closeDist(); }}>Готово</button>{/if}
    </div>
  {/snippet}
</Sheet>

<style>
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  .vp { position: relative; overflow: hidden; }
  .vs { position: absolute; top: 0; left: 0; right: 0; background: var(--bg); transition: transform .45s cubic-bezier(.32, .72, 0, 1), opacity .3s; padding: 0 6px 24px; }
  .vs.act { position: relative; } .vs.off { pointer-events: none; opacity: .4; }
  .cd { position: relative; border-radius: 22px; overflow: hidden; color: #F4EEDD; background: radial-gradient(120% 140% at 85% 0%, #2b2310, #101010 62%); box-shadow: 0 0 0 .5px rgba(232, 194, 119, .45), 0 12px 26px -16px rgba(232, 194, 119, .4), inset 0 1px 0 rgba(255, 232, 160, .35); }
  .au { position: absolute; right: -40px; top: -60px; width: 180px; height: 180px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 190, 90, .26), rgba(244, 190, 90, 0) 66%); animation: br 6s ease-in-out infinite; pointer-events: none; }
  @keyframes br { 50% { transform: scale(1.2); opacity: .6; } }
  .hz { display: flex; align-items: center; gap: 16px; padding: 16px 16px 16px 14px; }
  .dn { position: relative; width: 132px; height: 132px; flex: none; display: grid; place-items: center; }
  .dn svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .halo { position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 190, 90, .32), rgba(244, 190, 90, 0) 68%); animation: hl 3.4s ease-in-out infinite; transition: background .5s; }
  @keyframes hl { 50% { transform: scale(1.14); opacity: .55; } }
  .dn.ok .halo { background: radial-gradient(circle, rgba(120, 220, 160, .13), rgba(120, 220, 160, 0) 64%); animation: none; }
  .dn.bad .halo { background: radial-gradient(circle, rgba(255, 110, 96, .22), rgba(255, 110, 96, 0) 66%); }
  .track { fill: none; stroke: rgba(232, 194, 119, .16); stroke-width: 13; }
  .sg { fill: none; stroke-width: 13; transition: stroke-dasharray .6s cubic-bezier(.2, .8, .2, 1), stroke-dashoffset .6s cubic-bezier(.2, .8, .2, 1), stroke .4s; }
  .orbit { fill: none; stroke: rgba(232, 194, 119, .28); stroke-width: .8; stroke-dasharray: 1.5 5; }
  .sat { fill: #F6E3A1; filter: drop-shadow(0 0 4px #F6E3A1); }
  .orb { transform-origin: 60px 60px; animation: spin 14s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
  .mid { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; line-height: 1.15; max-width: 78px; }
  .mid small { font-size: 10.5px; color: #a99366; } .mid b { font-size: 19px; font-weight: 700; letter-spacing: -.02em; transition: color .3s; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mid b em { font-style: normal; font-size: .55em; color: #E8C277; margin-left: 2px; }
  .dn.ok .mid b { color: #DDF3E4; } .dn.bad .mid b { color: #FF8A7E; }
  .rg { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; font-size: 12px; color: #a99366; }
  .ln { display: flex; align-items: center; gap: 7px; } .ln i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .ln span { flex: 1; min-width: 0; } .ln b { color: #F4EEDD; font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stt { margin-top: 2px; padding-top: 8px; border-top: .5px solid rgba(232, 194, 119, .2); font-size: 11.5px; line-height: 1.3; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--fill); border-radius: 12px; padding: 2px; margin: 12px 0 0; position: relative; }
  .seg button { position: relative; z-index: 1; padding: 6px 0 5px; font-size: 13px; font-weight: 600; color: var(--muted); transition: color .25s; line-height: 1.2; }
  .seg button small { display: block; font-size: 11px; font-weight: 500; opacity: .85; } .seg button.on { color: #fff; }
  .seg .th { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 3); border-radius: 10px; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 3px 10px -3px rgba(184, 134, 44, .7); transform: translateX(calc(var(--i) * 100%)); transition: transform .35s cubic-bezier(.3, 1.2, .4, 1); }
  .fill { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; height: 38px; margin: 10px 0 0; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); color: var(--gold); font-weight: 600; font-size: 14px; transition: transform .15s; } .fill:active { transform: scale(.97); }
  h2 { display: flex; justify-content: space-between; margin: 14px 14px 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; } h2 span { font-weight: 400; }
  .grp { background: var(--card); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); } .more-g { margin-top: 16px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 9px 12px 9px 14px; position: relative; min-height: 60px; } .row + .row::before { content: ""; position: absolute; left: 60px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 34px; height: 34px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: grid; place-items: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { display: block; font-weight: 500; } .m small { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--muted); margin-top: 1px; white-space: nowrap; } .m small :global(svg) { flex: none; color: var(--gold); }
  .bar { height: 4px; border-radius: 2px; background: rgba(118, 118, 128, .2); margin-top: 6px; overflow: hidden; } .bar i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #9C7420, #E8C277); transition: width .6s cubic-bezier(.2, .8, .2, 1); } .bar i.d { background: linear-gradient(90deg, #248A3D, #4CD470); }
  .rt { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; width: 104px; }
  .am { width: 104px; height: 34px; border-radius: 11px; background: var(--fill); border: 0; text-align: right; padding: 0 11px; font: inherit; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text); outline: none; transition: box-shadow .2s, background .2s; }
  .am:focus { background: var(--card); box-shadow: 0 0 0 1.5px #D9B24C, 0 0 0 5px rgba(217, 178, 76, .22); }
  .nd { font-size: 11px; font-weight: 600; white-space: nowrap; color: var(--gold); transition: color .3s; } .nd.ok { color: var(--pos); }
  .more { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 16px; color: var(--muted); font-size: 14px; } .more :global(svg) { transition: transform .3s; } .more.o :global(svg) { transform: rotate(180deg); }
  .cov { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .35s cubic-bezier(.2, .8, .2, 1); } .cov.o { grid-template-rows: 1fr; } .cov > div { overflow: hidden; }
  .hint { text-align: center; color: var(--muted); font-size: 12px; margin: 14px 10px 0; line-height: 1.4; } .er { text-align: center; color: var(--neg); font-size: 13px; margin: 10px 0; }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 12px; } .nav b { font-size: 16px; font-weight: 600; }
  .back { color: var(--gold); display: flex; align-items: center; min-width: 76px; height: 32px; } .back :global(svg) { transform: rotate(90deg); } .sp { min-width: 76px; }
  .tr { display: flex; align-items: center; gap: 10px; padding: 11px 14px; position: relative; } .tr + .tr::before { content: ""; position: absolute; left: 14px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .tr .arr { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; font-weight: 500; } .tr .arr :global(svg) { transform: rotate(45deg); color: var(--gold); } .tr b { font-variant-numeric: tabular-nums; }
  .sm { background: var(--card); border-radius: 16px; padding: 4px 14px; margin: 12px 0 0; box-shadow: var(--shadow); } .sm div { display: flex; justify-content: space-between; padding: 10px 0; position: relative; font-size: 14px; } .sm div + div::before { content: ""; position: absolute; left: 0; right: 0; top: 0; border-top: .5px solid var(--line); } .sm span { color: var(--muted); } .sm b { font-weight: 600; }
  .dn3 { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 20px; } .dn3 h3 { margin: 18px 0 4px; font-size: 20px; } .dn3 p { margin: 0; color: var(--muted); }
  .ckm { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(160deg, #4CD470, #248A3D); box-shadow: 0 12px 30px -10px rgba(36, 138, 61, .7); animation: ppop .6s cubic-bezier(.2, .9, .3, 1.3) both; } @keyframes ppop { from { transform: scale(.4); opacity: 0; } }
  .undo { margin-top: 24px; height: 42px; padding: 0 22px; border-radius: 21px; background: var(--card); color: var(--gold); font-weight: 600; box-shadow: var(--shadow); } .undo:disabled { opacity: .5; }
  .ft { flex: none; padding: 8px 14px calc(12px + var(--safe-b)); background: linear-gradient(transparent, var(--bg) 30%); }
  .sv { position: relative; overflow: hidden; width: 100%; height: 52px; border-radius: 26px; font-weight: 600; font-size: 16px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 10px 24px -8px rgba(184, 134, 44, .75); transition: opacity .3s, filter .3s; }
  .sv:disabled { opacity: .45; filter: saturate(.5); box-shadow: none; }
  @media (prefers-reduced-motion: reduce) { .vs, .sg, .halo, .orb, .au { transition: none; animation: none; } }
</style>
