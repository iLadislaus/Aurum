<script>
  import Screen from '../lib/Screen.svelte';
  import Icon from '../lib/Icon.svelte';
  import { sb } from '../lib/supabase.js';
  import { openAnalytics } from '../lib/analytics.svelte.js';
  import { bg } from '../lib/budget.svelte.js';
  import { openMono } from '../lib/monowin.svelte.js';
  import { openRules } from '../lib/rules.svelte.js';
  import { peek } from '../lib/cache.svelte.js';

  let rules = $state(null), rec = $state(null), mono = $state('');

  const ago = (iso) => {
    const d = Math.round((Date.now() - new Date(iso)) / 3600000);
    return d < 1 ? 'только что' : d < 24 ? `${d} ч назад` : `${Math.round(d / 24)} дн. назад`;
  };

  $effect(() => {
    sb.from('rules').select('id', { count: 'exact', head: true }).then((r) => { if (r.count != null) rules = r.count; });
    sb.from('recurring_payments').select('id', { count: 'exact', head: true }).eq('active', true).eq('dismissed', false).then((r) => { if (r.count != null) rec = r.count; });
    sb.from('transactions').select('date').not('mono_op_id', 'is', null).order('date', { ascending: false }).limit(1)
      .then((r) => { if (r.data?.[0]) mono = 'последняя операция ' + ago(r.data[0].date); });
  });

  // после правок в окне «Правила» счётчик берётся из свежего списка
  const ruleCount = $derived(peek('rules')?.list.length ?? rules);

  const soon = $state({ on: '' });
  let timer;
  const tap = (k) => { soon.on = k; clearTimeout(timer); timer = setTimeout(() => (soon.on = ''), 1600); };
</script>

<Screen title="Ещё">
  <div class="grp rise" style="--i:1">
    <button class="it" onclick={() => openAnalytics(bg.ym)}>
      <span class="ic"><Icon name="chart" size={17} /></span>
      <span class="m"><b>Аналитика</b><small>финансовый отчёт и выгрузка в Excel</small></span>
      <span class="ch"><Icon name="chevron" size={14} /></span>
    </button>
    <button class="it" onclick={openRules}>
      <span class="ic"><Icon name="sliders" size={17} /></span>
      <span class="m"><b>Правила</b><small>автокатегории для операций</small></span>
      {#if ruleCount != null}<span class="pill">{ruleCount}</span>{/if}<span class="ch"><Icon name="chevron" size={14} /></span>
    </button>
    <button class="it" onclick={() => tap('rc')}>
      <span class="ic"><Icon name="calendar" size={17} /></span>
      <span class="m"><b>Повторяющиеся платежи</b><small>подписки, аренда, коммуналка</small></span>
      {#if soon.on === 'rc'}<span class="pill">скоро</span>{:else}{#if rec != null}<span class="pill">{rec}</span>{/if}<span class="ch"><Icon name="chevron" size={14} /></span>{/if}
    </button>
  </div>
  <div class="grp rise" style="--i:2">
    <button class="it" onclick={openMono}>
      <span class="ic"><Icon name="bank" size={17} /></span>
      <span class="m"><b>Monobank</b><small>{mono || 'синхронизация'}</small></span>
      <span class="pill ok">онлайн</span><span class="ch"><Icon name="chevron" size={14} /></span>
    </button>
  </div>
  <p class="ver rise" style="--i:3">Aurum · версия {__APP_VERSION__}</p>
</Screen>

<style>
  .grp { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; margin-bottom: 16px; }
  .it { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-align: left; position: relative; transition: background .15s; font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
  .it:active { background: var(--fill); }
  .it + .it::before { content: ""; position: absolute; top: 0; left: 58px; right: 0; height: .5px; background: var(--line); }
  .ic { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); flex: none; }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-weight: 500; font-size: 15px; }
  .m small { display: block; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ch { color: var(--muted); opacity: .6; display: grid; transform: rotate(-90deg); }
  .pill { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); font-variant-numeric: tabular-nums; }
  .pill.ok { background: rgba(48,209,88,.16); color: var(--pos); }
  .ver { margin: 18px 0 0; text-align: center; font-size: 12px; color: var(--muted); }
</style>
