<script>
  import { nav } from './lib/nav.svelte.js';
  import TabBar from './lib/TabBar.svelte';
  import UpdateBanner from './lib/UpdateBanner.svelte';
  import CtxMenu from './lib/CtxMenu.svelte';
  import AccountSheet from './lib/AccountSheet.svelte';
  import NewAccount from './lib/NewAccount.svelte';
  import EditAccount from './lib/EditAccount.svelte';
  import DeleteAccount from './lib/DeleteAccount.svelte';
  import OpCard from './lib/OpCard.svelte';
  import NewOp from './lib/NewOp.svelte';
  import { no } from './lib/newop.svelte.js';
  import { oc } from './lib/opcard.svelte.js';
  import { na } from './lib/newacct.svelte.js';
  import { acct } from './lib/acctsheet.svelte.js';
  import HomeBlocks from './lib/HomeBlocks.svelte';
  import { hb } from './lib/homeblocks.svelte.js';
  import HorizonSheet from './lib/HorizonSheet.svelte';
  import NewPay from './lib/NewPay.svelte';
  import PeriodSheet from './lib/PeriodSheet.svelte';
  import CatSheet from './lib/CatSheet.svelte';
  import PlanSheet from './lib/PlanSheet.svelte';
  import DistSheet from './lib/DistSheet.svelte';
  import CatOpsSheet from './lib/CatOpsSheet.svelte';
  import AnalyticsSheet from './lib/AnalyticsSheet.svelte';
  import { cal } from './lib/opsfilter.svelte.js';
  import { prefetchAll } from './lib/prefetch.js';
  import { startUpdateWatch } from './lib/update.svelte.js';
  import { onMount, untrack } from 'svelte';
  import { auth, startAuth } from './lib/auth.svelte.js';
  import Login from './pages/Login.svelte';
  import Home from './pages/Home.svelte';
  import Accounts from './pages/Accounts.svelte';
  import Operations from './pages/Operations.svelte';
  import Budget from './pages/Budget.svelte';
  import More from './pages/More.svelte';

  onMount(() => { startUpdateWatch(); startAuth(); });

  // после входа и при возвращении в приложение подтягиваем данные всех экранов
  // untrack обязателен: prefetchAll читает кэш и сам же его перезаписывает — без него эффект запускал бы себя без остановки
  // следим за пользователем, а не за сессией: обновление токена при возврате в приложение не должно перезагружать всё
  const uid = $derived(auth.session?.user?.id);
  $effect(() => { if (uid) untrack(() => prefetchAll(true)); });
  onMount(() => {
    const vis = () => { if (document.visibilityState === 'visible' && auth.session) prefetchAll(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  });

  let scroller;
  // При переходе между вкладками показываем верх страницы
  $effect(() => {
    nav.tab;
    if (scroller) scroller.scrollTop = 0;
  });
</script>

<main bind:this={scroller} class:back={acct.open || na.open || hb.open || oc.open || no.open || cal.open}>
  {#if !auth.ready}
    <!-- проверяем вход -->
  {:else if !auth.session}
    <Login />
  {:else}
  {#key nav.tab}
    {#if nav.tab === 'home'}<Home />
    {:else if nav.tab === 'accounts'}<Accounts />
    {:else if nav.tab === 'ops'}<Operations />
    {:else if nav.tab === 'budget'}<Budget />
    {:else}<More />{/if}
  {/key}
  {/if}
</main>
<UpdateBanner />
{#if auth.session}<AccountSheet /><HomeBlocks /><HorizonSheet /><NewPay /><PeriodSheet /><CatSheet /><PlanSheet /><DistSheet /><AnalyticsSheet /><CatOpsSheet /><NewAccount /><EditAccount /><DeleteAccount /><OpCard /><NewOp /><CtxMenu />{/if}
{#if auth.session}<TabBar />{/if}

<style>
  /* Прокручивается область приложения, а не страница; панель лежит поверх, и сквозь стекло виден контент */
  main { position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: var(--bg);
    transform-origin: 50% 0; transition: transform .55s cubic-bezier(.32, .72, 0, 1), border-radius .55s cubic-bezier(.32, .72, 0, 1); }
  /* окно счёта открыто: страница позади слегка отъезжает назад */
  main.back { transform: scale(.94) translateY(8px); border-radius: 26px; }
  @media (prefers-reduced-motion: reduce) { main { transition: none; } }
</style>
