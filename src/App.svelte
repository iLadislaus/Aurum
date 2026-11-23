<script>
  import { nav } from './lib/nav.svelte.js';
  import TabBar from './lib/TabBar.svelte';
  import UpdateBanner from './lib/UpdateBanner.svelte';
  import { startUpdateWatch } from './lib/update.svelte.js';
  import { onMount } from 'svelte';
  import { auth, startAuth } from './lib/auth.svelte.js';
  import Login from './pages/Login.svelte';
  import Home from './pages/Home.svelte';
  import Accounts from './pages/Accounts.svelte';
  import Operations from './pages/Operations.svelte';
  import Budget from './pages/Budget.svelte';
  import More from './pages/More.svelte';

  onMount(() => { startUpdateWatch(); startAuth(); });

  let scroller;
  // При переходе между вкладками показываем верх страницы
  $effect(() => {
    nav.tab;
    if (scroller) scroller.scrollTop = 0;
  });
</script>

<main bind:this={scroller}>
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
{#if auth.session}<TabBar />{/if}

<style>
  /* Прокручивается область приложения, а не страница; панель лежит поверх, и сквозь стекло виден контент */
  main { position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; background: var(--bg); }
</style>
