<script>
  import { onMount } from 'svelte';
  import { nav } from '../lib/nav.svelte.js';
  import { loadHome } from '../lib/data.js';
  import Icon from '../lib/Icon.svelte';
  import BalanceCard from '../home/BalanceCard.svelte';
  import BudgetCard from '../home/BudgetCard.svelte';
  import FlowCard from '../home/FlowCard.svelte';
  import Horizon from '../home/Horizon.svelte';
  import RecentOps from '../home/RecentOps.svelte';

  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const month = new Date().toLocaleDateString('ru-RU', { month: 'long' });
  let d = $state(null);
  let err = $state('');
  let shown = $state(false);
  // данные приходят из Supabase; анимации стартуют, когда экран уже нарисован
  onMount(async () => {
    try { d = await loadHome(); } catch (e) { err = e.message || 'Не удалось загрузить данные'; return; }
    requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
  });
</script>

<section>
  <div class="head rise">
    <div>
      <div class="d">{date}</div>
      <h1 class="large-title">Главная</h1>
    </div>
    <div class="hb">
      <button class="rf" aria-label="Блоки главной"><Icon name="sliders" size={20} /></button>
      <button class="rf plus" aria-label="Новая операция"><Icon name="plus" size={20} /></button>
    </div>
  </div>

  {#if err}
    <p class="msg">{err}</p>
  {:else if !d}
    <p class="msg">Загружаю…</p>
  {:else}
  <div class="rise" style="--i:1"><BalanceCard total={d.total} delta={d.delta} pct={d.pct} {shown} onopen={() => (nav.tab = 'accounts')} /></div>

  <div class="sh rise" style="--i:2"><h2>Бюджет на {month}</h2></div>
  <button class="bt rise" style="--i:2" onclick={() => (nav.tab = 'budget')} aria-label="Открыть бюджет"><BudgetCard budget={d.budget} {shown} /></button>

  <div class="sh rise" style="--i:3"><h2>Денежный поток</h2></div>
  <div class="rise" style="--i:3"><FlowCard months={d.months} {shown} /></div>

  <div class="sh rise" style="--i:4"><h2>На горизонте</h2></div>
  <div class="rise" style="--i:4"><Horizon items={d.horizon} {shown} /></div>

  <div class="sh rise" style="--i:5"><h2>Последние операции</h2><button class="all" onclick={() => (nav.tab = 'ops')}>Все</button></div>
  <div class="rise" style="--i:5"><RecentOps rows={d.recent} {shown} /></div>
  {/if}
</section>

<style>
  section { padding: 0 16px calc(110px + var(--safe-b)); }
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(env(safe-area-inset-top, 0px) + 28px) 4px 14px; }
  .d { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .hb { display: flex; gap: 4px; }
  .rf { width: 44px; height: 44px; display: grid; place-items: center; }
  .rf :global(svg) { width: 36px !important; height: 36px !important; padding: 9px; border-radius: 50%; background: var(--fill); color: var(--gold); box-sizing: border-box; }
  .rf.plus :global(svg) { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; padding: 8px; }
  .sh { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 4px 8px; }
  .sh h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: .35px; }
  .all { font-size: 15px; color: var(--gold); min-height: 28px; }
  .msg { text-align: center; color: var(--muted); padding: 40px 0; }
  .bt { display: block; width: 100%; text-align: left; border-radius: 28px; transition: transform .15s; }
  .bt:active { transform: scale(.98); }
</style>
