<script>
  import { onMount } from 'svelte';
  import { nav } from '../lib/nav.svelte.js';
  import { loadHome } from '../lib/data.js';
  import { peek, refresh } from '../lib/cache.svelte.js';
  import Icon from '../lib/Icon.svelte';
  import Summary from '../home/Summary.svelte';
  import { openHorizon } from '../lib/horizon.svelte.js';
  import FlowCard from '../home/FlowCard.svelte';
  import RecentOps from '../home/RecentOps.svelte';
  import { hb, isOn, openBlocks } from '../lib/homeblocks.svelte.js';
  import { openNewOp } from '../lib/newop.svelte.js';
  import { flyOpen } from '../lib/fly.js';

  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const month = new Date().toLocaleDateString('ru-RU', { month: 'long' });
  let d = $derived(peek('home'));
  let err = $state('');
  let shown = $state(false), settled = $state(false);
  // анимация появления блоков — один раз: при перестановке блоки переносятся в DOM и без этого мигали бы
  $effect(() => { if (shown) { const t = setTimeout(() => (settled = true), 1500); return () => clearTimeout(t); } });
  // данные приходят из Supabase; анимации стартуют, когда экран уже нарисован
  onMount(async () => {
    if (d) requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
    try { await refresh('home', loadHome); } catch (e) { if (!d) { err = e.message || 'Не удалось загрузить данные'; return; } }
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
      <button class="rf" aria-label="Блоки главной" onclick={openBlocks}><Icon name="sliders" size={20} /></button>
      <button class="rf plus" aria-label="Новая операция" onclick={(e) => flyOpen(e, () => openNewOp())}><Icon name="plus" size={20} /></button>
    </div>
  </div>

  {#if err}
    <p class="msg">{err}</p>
  {:else if !d}
    <p class="msg">Загружаю…</p>
  {:else}
  <div class="blocks">
    {#each hb.list as bl, i (bl.id)}
      {#if bl.on}
        <div class:rise={!settled} class:bal={bl.id === 'balance'} style="--i:{Math.min(i + 1, 5)}">
          {#if bl.id === 'balance'}
            <Summary d={d} {shown} {month} onaccounts={() => (nav.tab = 'accounts')} onbudget={() => (nav.tab = 'budget')} onhorizon={openHorizon} />
          {:else if bl.id === 'flow'}
            <div class="sh"><h2>Денежный поток</h2></div>
            <FlowCard months={d.months} {shown} />
          {:else}
            <div class="sh"><h2>Последние операции</h2><button class="all" onclick={() => (nav.tab = 'ops')}>Все</button></div>
            <RecentOps rows={d.recent} {shown} />
          {/if}
        </div>
      {/if}
    {/each}
  </div>
  {/if}
</section>

<style>
  section { padding: 0 16px calc(110px + var(--safe-b)); }
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding: calc(env(safe-area-inset-top, 0px) + 33px) 4px 14px; }
  .d { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .hb { display: flex; gap: 4px; }
  .rf { width: 44px; height: 44px; display: grid; place-items: center; }
  .rf :global(svg) { width: 36px !important; height: 36px !important; padding: 9px; border-radius: 50%; background: var(--fill); color: var(--gold); box-sizing: border-box; }
  .rf.plus :global(svg) { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; padding: 8px; }
  .sh { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 4px 8px; }
  .blocks > :first-child .sh { margin-top: 8px; }
  /* у карточки баланса нет заголовка, поэтому отступ между блоками задаём ей самой */
  .bal { margin-top: 26px; }
  .blocks > .bal:first-child { margin-top: 0; }
  .sh h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: .35px; }
  .all { font-size: 15px; color: var(--gold); min-height: 28px; }
  .msg { text-align: center; color: var(--muted); padding: 40px 0; }
</style>
