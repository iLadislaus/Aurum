<script>
  import OpAvatar from '../lib/OpAvatar.svelte';
  import Icon from '../lib/Icon.svelte';
  import { money, daysLabel } from '../lib/format.js';
  let { items, shown } = $props();

  const HORIZON = 14;
  let range = $state('days');
  let list = $derived(items.filter((p) => (range === 'days' ? p.days <= HORIZON : true)).sort((a, b) => a.days - b.days));
  let left = $derived(list.reduce((s, p) => s + p.amount, 0));
  const mon = new Date().toLocaleDateString('ru-RU', { month: 'long' });
</script>

<div class="grp" class:in={shown}>
  <div class="rg"><div class="seg">
    <button class:on={range === 'days'} onclick={() => (range = 'days')}>{HORIZON} дней</button>
    <button class:on={range === 'month'} onclick={() => (range = 'month')}>Месяц</button>
  </div></div>
  {#each list as p (p.id)}
    <div class="row">
      <OpAvatar icon={p.icon} />
      <div class="mid">
        <div class="t">{p.name}<span class="pill" class:soon={p.days <= 1}>{daysLabel(p.days)}</span></div>
        <div class="s">{p.cat} · {p.period}</div>
      </div>
      <div class="r">{money(p.amount)}</div>
    </div>
  {:else}
    <p class="none">{range === 'month' ? `В ${mon} плановых платежей пока нет` : `На ${HORIZON} дней платежей нет`}</p>
  {/each}
  {#if list.length}
    <div class="foot"><span>{range === 'month' ? 'Осталось заплатить в этом месяце' : `За ${HORIZON} дней`}</span><b>{money(left)}</b></div>
  {/if}
  <button class="add"><Icon name="plus" size={16} /> Добавить плановый платёж</button>
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .grp.in { opacity: 1; transform: none; }
  .rg { padding: 12px 14px 4px; }
  .seg { display: flex; background: var(--fill); border-radius: 9px; padding: 2px; }
  .seg button { flex: 1; min-height: 30px; border-radius: 7px; font-size: 13px; font-weight: 600; color: var(--muted); transition: background .2s, color .2s; }
  .seg .on { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; position: relative; min-height: 64px; }
  .row:not(:first-of-type)::before { content: ""; position: absolute; top: 0; left: 70px; right: 0; height: .5px; background: var(--line); }
  .mid { flex: 1; min-width: 0; }
  .t { font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { font-size: 12px; color: var(--muted); line-height: 17px; overflow-wrap: anywhere; }
  .pill { margin-left: 8px; font-size: 11.5px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); vertical-align: 1px; white-space: nowrap; }
  .pill.soon { background: rgba(215,0,21,.1); color: var(--neg); }
  .r { font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
  .foot { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--gold-soft); font-size: 14px; color: var(--muted); border-top: .5px solid var(--line); }
  .foot b { color: var(--text); font-weight: 600; white-space: nowrap; }
  .none { margin: 0; padding: 22px 16px 16px; color: var(--muted); font-size: 14px; text-align: center; }
  .add { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 48px; color: var(--gold); font-size: 15px; font-weight: 600; border-top: .5px solid var(--line); }
</style>
