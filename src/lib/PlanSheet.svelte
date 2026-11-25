<script>
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import { bg, closePlan } from './budget.svelte.js';
  import { loadBudgetCats, loadPlan, savePlan, monthKey } from './budget.js';
  import { refresh, peek } from './cache.svelte.js';
  import { fmt } from './format.js';

  const MON = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const now = new Date();
  // месяц выбирается на экране «Бюджет»
  const ym = $derived(bg.ym);
  let full = $state(false);
  let tab = $state(0), busy = $state(false), err = $state('');
  let txt = $state({}), ids = $state({}), prev = $state({}), got = $state({});
  const d = $derived(peek('bcats'));
  const month = $derived(monthKey(Math.floor(ym / 12), ym % 12));
  const title = $derived(MON[ym % 12] + ' ' + Math.floor(ym / 12));

  $effect(() => { if (bg.plan) { const t = setTimeout(() => (full = true), 0); return () => clearTimeout(t); } });
  $effect(() => { if (bg.plan) { tab = 0; err = ''; refresh('bcats', loadBudgetCats, true).catch(() => {}); } });
  let seq = 0;
  $effect(() => {
    if (!bg.plan) return;
    const m = month, s = ++seq;
    loadPlan(m).then((r) => {
      if (s !== seq) return;
      const t = {}; for (const [k, v] of Object.entries(r.plan)) t[k] = v ? fmt(v) : '';
      txt = t; ids = r.ids; prev = r.plan; got = r.got;
    }).catch((e) => { err = e.message || 'Не удалось загрузить план'; });
  });

  const num = (v) => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
  const pl = (c) => num(txt[c.id]);
  const envOf = (id) => d?.envs.find((e) => e.id === id);
  const exp = $derived((d?.cats ?? []).filter((c) => !c.income));
  const inc = $derived((d?.cats ?? []).filter((c) => c.income));
  const need = (c) => { const e = envOf(c.env); return e ? Math.max(0, pl(c) - Math.max(0, e.balance)) : 0; };
  const cov = (c) => { const e = envOf(c.env); return e && pl(c) > 0 ? Math.min(100, Math.max(0, e.balance) / pl(c) * 100) : 0; };
  const tInc = $derived(inc.reduce((s, c) => s + pl(c), 0));
  const tCash = $derived(exp.filter((c) => !envOf(c.env)).reduce((s, c) => s + pl(c), 0));
  const tEnv = $derived(exp.reduce((s, c) => s + need(c), 0));
  const free = $derived(tInc - tCash - tEnv);
  const sum = (l) => l.reduce((s, c) => s + pl(c), 0);
  const mand = $derived(exp.filter((c) => c.mand));
  const opt = $derived(exp.filter((c) => !c.mand));

  async function save() {
    busy = true; err = '';
    try {
      const vals = {}; for (const c of d.cats) vals[c.id] = pl(c);
      await savePlan(month, vals, ids, prev);
      closePlan();
    } catch (e) { err = e.message || 'Не удалось сохранить'; }
    busy = false;
  }
  const blur = (c) => { txt[c.id] = pl(c) ? fmt(pl(c)) : ''; };
</script>

<Sheet open={bg.plan} onclose={closePlan} title="План на месяц" sub={title} bind:full>
  <div class="hd">
    <div class="cd">
      <i class="au"></i>
      <div class="cap"><span class="dot"></span>Свободно после плана</div>
      <div class="fr" class:bad={free < 0}>{free < 0 ? '−' : ''}{fmt(Math.abs(free))}<small>₴</small></div>
      <div class="frm">{free < 0 ? 'Не хватает на план: доходов меньше, чем нужно' : 'доходы − из Cash − довнести в конверты'}</div>
      <div class="kp"><span>Доходы<b>{fmt(tInc)} ₴</b></span><span>Из Cash<b>{fmt(tCash)} ₴</b></span><span>В конверты<b>{fmt(tEnv)} ₴</b></span></div>
    </div>
    <div class="seg" class:inc={tab === 1}><i class="th"></i><button class:on={tab === 0} onclick={() => (tab = 0)}>Расходы</button><button class:on={tab === 1} onclick={() => (tab = 1)}>Доходы</button></div>
  </div>

  {#if d}
  <div class="tab">
    {#if tab === 0}
      <h2>Обязательные<span><b>{fmt(sum(mand))}</b> ₴</span></h2>
      <div class="grp">{#each mand as c (c.id)}{@render erow(c)}{/each}</div>
      <h2>Необязательные<span><b>{fmt(sum(opt))}</b> ₴</span></h2>
      <div class="grp">{#each opt as c (c.id)}{@render erow(c)}{/each}</div>
      <p class="hint">Конверт у категории задаётся в «Категориях». Если в нём уже есть деньги, довносится только разница.</p>
    {:else}
      {#each ['Аванс', 'Зарплата', 'Другое'] as g (g)}
        {@const l = inc.filter((c) => c.grp === g)}
        {#if l.length}
          <h2>{g}<span><b>{fmt(sum(l))}</b> ₴ · получено {fmt(l.reduce((s, c) => s + (got[c.id] || 0), 0))}</span></h2>
          <div class="grp">{#each l as c (c.id)}
            {@const gv = got[c.id] || 0}
            <div class="r">
              <div class="ic"><Icon name={c.icon} size={17} /></div>
              <div class="m"><b>{c.name}</b><small>{gv ? 'получено ' + fmt(gv) + ' ₴' : 'ещё не получено'}</small></div>
              <div class="rt"><input class="am" inputmode="numeric" placeholder="0" bind:value={txt[c.id]} onfocus={(e) => e.currentTarget.select()} onblur={() => blur(c)} />
                <span class="got" class:ok={gv >= pl(c) && gv > 0}>{gv >= pl(c) && gv > 0 ? 'получено ✓' : gv ? '' : 'ожидается'}</span></div>
            </div>{/each}</div>
        {/if}
      {/each}
      <p class="hint">Доходы по плану вместе с расходами показывают, сколько денег остаётся свободно.</p>
    {/if}
    {#if err}<p class="er">{err}</p>{/if}
  </div>
  {/if}
  {#snippet footer()}<div class="ft"><button class="sv" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить план'}</button></div>{/snippet}
</Sheet>

{#snippet erow(c)}
  {@const e = envOf(c.env)}
  {@const n = need(c)}
  <div class="r">
    <div class="ic"><Icon name={c.icon} size={17} /></div>
    <div class="m"><b>{c.name}</b>
      {#if e}<small><Icon name="mail" size={13} />{e.name} · {fmt(e.balance)} ₴</small><div class="bar"><i style:width="{cov(c)}%"></i></div>
      {:else}<small class="cash"><Icon name="cash" size={13} />Из Cash</small>{/if}</div>
    <div class="rt"><input class="am" inputmode="numeric" placeholder="0" bind:value={txt[c.id]} onfocus={(ev) => ev.currentTarget.select()} onblur={() => blur(c)} />
      {#if !e}<span class="nd c">сразу из Cash</span>{:else if !pl(c)}<span class="nd c">нет плана</span>{:else if n}<span class="nd g">довнести {fmt(n)}</span>{:else}<span class="nd ok">хватает ✓</span>{/if}</div>
  </div>
{/snippet}


<style>
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  .hd { position: sticky; top: 0; z-index: 3; background: var(--bg); padding: 0 6px 6px; }
  .cd { position: relative; border-radius: 22px; overflow: hidden; color: #F4EEDD; padding: 14px 16px 12px; background: radial-gradient(120% 140% at 85% 0%, #2b2310, #101010 62%); box-shadow: 0 0 0 .5px rgba(232, 194, 119, .45), 0 12px 26px -16px rgba(232, 194, 119, .4), inset 0 1px 0 rgba(255, 232, 160, .35); }
  .au { position: absolute; right: -40px; top: -60px; width: 180px; height: 180px; border-radius: 50%; background: radial-gradient(circle, rgba(244, 190, 90, .26), rgba(244, 190, 90, 0) 66%); animation: br 6s ease-in-out infinite; pointer-events: none; }
  @keyframes br { 50% { transform: scale(1.2); opacity: .6; } }
  .cap { font-size: 12px; color: #a99366; display: flex; align-items: center; gap: 6px; }
  .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; background: #E8C277; }
  .dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: #E8C277; animation: pl 2.2s ease-out infinite; }
  @keyframes pl { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.4); opacity: 0; } }
  .fr { font-size: 34px; font-weight: 700; letter-spacing: -.03em; margin: 4px 0 2px; line-height: 1.1; font-variant-numeric: tabular-nums; transition: color .3s; }
  .fr small { font-size: .45em; color: #E8C277; margin-left: 3px; } .fr.bad { color: #FF8A7E; }
  .frm { font-size: 11.5px; color: #a99366; line-height: 1.35; }
  .kp { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 10px; border-top: .5px solid rgba(232, 194, 119, .2); padding-top: 9px; font-size: 11.5px; color: #a99366; }
  .kp span { display: flex; flex-direction: column; gap: 1px; } .kp span + span { padding-left: 12px; border-left: .5px solid rgba(232, 194, 119, .2); }
  .kp b { color: #F4EEDD; font-size: 14.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .seg { display: flex; background: var(--fill); border-radius: 11px; padding: 2px; margin: 12px 0 4px; position: relative; }
  .seg button { flex: 1; position: relative; z-index: 1; padding: 7px 0; font-size: 13.5px; font-weight: 600; color: var(--muted); transition: color .25s; } .seg button.on { color: #fff; }
  .seg .th { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc(50% - 2px); border-radius: 9px; box-shadow: 0 3px 10px -3px rgba(184, 134, 44, .7); transition: transform .35s cubic-bezier(.3, 1.2, .4, 1), box-shadow .35s; overflow: hidden; }
  .seg .th::before, .seg .th::after { content: ''; position: absolute; inset: 0; transition: opacity .35s; }
  .seg .th::before { background: linear-gradient(160deg, #EBC77A, #B8862C); } .seg .th::after { background: linear-gradient(160deg, #4CD470, #248A3D); opacity: 0; }
  .seg.inc .th { transform: translateX(100%); box-shadow: 0 3px 10px -3px rgba(36, 138, 61, .7); } .seg.inc .th::after { opacity: 1; }
  .tab { padding: 0 6px 110px; min-height: 60vh; animation: tin .35s cubic-bezier(.2, .8, .2, 1) both; }
  @keyframes tin { from { opacity: 0; transform: translateY(8px); } }
  h2 { display: flex; justify-content: space-between; margin: 12px 14px 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; }
  h2 span { text-transform: none; letter-spacing: 0; font-weight: 400; } h2 span b { color: var(--text); font-weight: 600; }
  .grp { background: var(--card); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); }
  .r { display: flex; align-items: center; gap: 12px; padding: 9px 12px 9px 14px; position: relative; min-height: 60px; }
  .r + .r::before { content: ""; position: absolute; left: 60px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 34px; height: 34px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: grid; place-items: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { display: block; font-weight: 500; }
  .m small { display: flex; align-items: flex-start; gap: 4px; font-size: 11.5px; line-height: 1.3; color: var(--muted); margin-top: 1px; white-space: normal; overflow-wrap: anywhere; } .m small :global(svg) { flex: none; color: var(--gold); margin-top: 1px; }
  .bar { height: 4px; border-radius: 2px; background: rgba(118, 118, 128, .2); margin-top: 6px; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #9C7420, #E8C277); transition: width .6s cubic-bezier(.2, .8, .2, 1); }
  .rt { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; width: 104px; }
  .am { width: 104px; height: 34px; border-radius: 11px; background: var(--fill); border: 0; text-align: right; padding: 0 11px; font: inherit; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text); outline: none; transition: box-shadow .2s, background .2s; }
  .am:focus { background: var(--card); box-shadow: 0 0 0 1.5px #D9B24C, 0 0 0 5px rgba(217, 178, 76, .22); }
  .nd { font-size: 11px; font-weight: 600; white-space: nowrap; } .nd.g { color: var(--gold); } .nd.ok { color: var(--pos); } .nd.c { color: var(--muted); font-weight: 500; }
  .got { font-size: 11px; font-weight: 500; color: var(--muted); } .got.ok { color: var(--pos); }
  .hint { text-align: center; color: var(--muted); font-size: 12px; margin: 14px 10px 0; line-height: 1.4; }
  .er { text-align: center; color: var(--neg); font-size: 13px; margin: 10px 0; }
  .ft { flex: none; padding: 8px 14px calc(12px + var(--safe-b)); background: linear-gradient(transparent, var(--bg) 30%); }
  .sv { width: 100%; height: 52px; border-radius: 26px; font-weight: 600; font-size: 16px; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 10px 24px -8px rgba(184, 134, 44, .75); }
  .sv:disabled { opacity: .6; }
</style>
