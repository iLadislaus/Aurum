<script>
  // Окно «Логотипы»: все названия платежей, по нажатию — выбор значка. Размер и жесты те же, что у «Аналитики»
  import { untrack } from 'svelte';
  import { lw, closeLogos } from './logoswin.svelte.js';
  import { openLogo } from './logopick.svelte.js';
  import { logoFile, loadBrands } from './brands.svelte.js';
  import { loadPayNames, loadCategories } from './data.js';
  import { refresh } from './cache.svelte.js';
  import { fmt, plural } from './format.js';
  import Sheet from './Sheet.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import Icon from './Icon.svelte';

  let q = $state(''), tab = $state(0), all = $state.raw(null), err = $state('');
  const split = $derived.by(() => {
    const out = [[], []];
    for (const x of all ?? []) out[logoFile(x.name) ? 1 : 0].push(x);
    return out;
  });
  const list = $derived.by(() => {
    const s = q.trim().toLowerCase();
    return s ? split[tab].filter((x) => x.name.toLowerCase().includes(s) || x.cat.toLowerCase().includes(s)) : split[tab];
  });

  // названия берутся из копии операций на устройстве
  async function load() {
    err = '';
    try { all = await loadPayNames(refresh('cats', loadCategories)); }
    catch { err = 'Не удалось загрузить'; }
  }
  $effect(() => {
    if (!lw.open) return;
    untrack(() => { q = ''; tab = 0; loadBrands().catch(() => {}); load(); });
  });
</script>

<Sheet open={lw.open} onclose={closeLogos} title="Логотипы" sub="значки платежей" z={50}>
  <div class="head">
    <label class="srch"><Icon name="search" size={16} /><input type="search" placeholder="Название платежа" autocomplete="off" bind:value={q} /></label>
    <div class="seg" style:--p={tab}><i></i>
      {#each ['Без логотипа', 'С логотипом'] as t, i (t)}<button class:on={tab === i} aria-pressed={tab === i} onclick={() => (tab = i)}>{t}</button>{/each}
    </div>
  </div>
  {#if err}<p class="msg bad">{err}</p>{/if}
  {#if !all}
    {#if !err}<p class="msg">Загружаю…</p>{:else}<button class="again" onclick={load}>Повторить</button>{/if}
  {:else if !list.length}
    <p class="msg">{q.trim() ? 'Ничего не найдено' : tab ? 'Платежей с логотипом пока нет' : 'У всех платежей есть логотип'}</p>
  {:else}
    {#key tab}
      <div class="list">
        {#each list as x, i (x.key)}
          <button class="r" class:rise={i < 14} style="--i:{Math.min(i, 14)}" onclick={() => openLogo(x.name, x.icon)}>
            <OpAvatar icon={x.icon} size={38} name={x.name} />
            <span class="m"><b>{x.name}</b><small>{x.cat}</small></span>
            <span class="n" aria-label="{fmt(x.n)} {plural(x.n, 'платёж', 'платежа', 'платежей')}">{fmt(x.n)}</span>
          </button>
        {/each}
      </div>
    {/key}
  {/if}
</Sheet>

<style>
  .head { position: sticky; top: -4px; z-index: 2; background: var(--bg); padding: 4px 0 10px; }
  .srch { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; margin-bottom: 8px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); color: var(--muted); }
  .srch input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; }
  .seg { display: grid; grid-template-columns: repeat(2, 1fr); background: var(--fill); border-radius: 11px; padding: 2px; position: relative; }
  .seg i { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 2); border-radius: 9px; background: linear-gradient(#F6E3A1, #D9B24C 60%, #B8892B); transform: translateX(calc(var(--p) * 100%)); transition: transform .4s cubic-bezier(.32, .72, 0, 1); }
  .seg button { position: relative; z-index: 1; min-height: 40px; font-size: 13px; font-weight: 600; color: var(--muted); transition: color .3s; }
  .seg button.on { color: #1A1204; }
  .list { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; }
  /* строки вне экрана не рисуются: названий может быть несколько сотен */
  .r { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 11px 14px; text-align: left; transition: background .15s; content-visibility: auto; contain-intrinsic-size: auto 60px; }
  .r:active { background: var(--fill); }
  .r + .r::before { content: ""; position: absolute; top: 0; left: 64px; right: 0; height: .5px; background: var(--line); }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-weight: 500; font-size: 15px; overflow-wrap: anywhere; }
  .m small { display: block; color: var(--muted); font-size: 12px; }
  .n { flex: none; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 99px; background: var(--fill); color: var(--muted); font-variant-numeric: tabular-nums; }
  .msg { margin: 28px 0; text-align: center; font-size: 14px; color: var(--muted); }
  .msg.bad { margin: 0 0 10px; color: var(--neg); }
  .again { display: block; margin: 0 auto; min-height: 44px; padding: 0 20px; color: var(--gold); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .seg i { transition: none; } }
</style>
