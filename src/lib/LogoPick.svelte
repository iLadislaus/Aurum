<script>
  // Выбор логотипа из имеющихся: действует на все платежи с этим названием
  import { untrack } from 'svelte';
  import { lp, closeLogo } from './logopick.svelte.js';
  import { logoFile, logoList, logoSrc, setLogo, loadBrands } from './brands.svelte.js';
  import FloatWin from './FloatWin.svelte';
  import Icon from './Icon.svelte';

  let q = $state(''), sel = $state(null), was = $state(null), busy = $state(false), err = $state('');
  const all = $derived(logoList());
  const list = $derived.by(() => { const s = q.trim().toLowerCase(); return s ? all.filter((x) => x.words.includes(s)) : all; });

  $effect(() => {
    if (!lp.open) return;
    untrack(() => { q = ''; err = ''; busy = false; loadBrands().catch(() => {}); was = sel = logoFile(lp.name); });
  });

  async function save(file) {
    if (busy) return;
    busy = true; err = '';
    try { await setLogo(lp.name, file); closeLogo(); }
    catch { err = 'Не удалось сохранить'; }
    busy = false;
  }
</script>

<FloatWin open={lp.open} onclose={closeLogo} title="Логотип" top={110} z={58}>
  <div class="bd">
    <div class="pv">
      {#key sel}<span class="big">{#if sel}<img src={logoSrc(sel)} alt="" />{:else}<Icon name={lp.icon} size={30} />{/if}</span>{/key}
      <small>Для всех платежей «{lp.name}»</small>
    </div>
    <label class="srch"><Icon name="search" size={16} /><input type="search" placeholder="Название магазина" autocomplete="off" bind:value={q} /></label>
    {#if lp.open}
      <div class="gridl">
        {#each list as x (x.file)}
          <button class:on={sel === x.file} aria-label={x.file.replace(/\.\w+$/, '')} aria-pressed={sel === x.file} onclick={() => (sel = x.file)}><img src={logoSrc(x.file)} alt="" loading="lazy" /></button>
        {:else}<p>Ничего не найдено</p>{/each}
      </div>
    {/if}
    {#if err}<p class="er">{err}</p>{/if}
    <button class="go" disabled={busy || sel === was} onclick={() => save(sel)}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
    {#if was}<button class="rm" disabled={busy} onclick={() => save(null)}>Убрать логотип</button>{/if}
  </div>
</FloatWin>

<style>
  .bd { padding: 0 6px 6px; }
  .pv { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 10px; text-align: center; }
  .pv small { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
  .big { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); animation: pick .5s cubic-bezier(.2, 1.4, .4, 1); }
  .big img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
  @keyframes pick { from { transform: scale(.6); } }
  .srch { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); color: var(--muted); }
  .srch input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; }
  .gridl { display: grid; grid-template-columns: repeat(5, 1fr); grid-auto-rows: 54px; justify-items: center; align-content: start; height: 22vh; min-height: 120px; margin: 8px 0 0; overflow-y: auto; overscroll-behavior: contain; }
  .gridl button { width: 48px; height: 48px; margin: 3px 0; border-radius: 50%; transition: transform .25s, box-shadow .25s; }
  .gridl img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #fff; }
  .gridl button.on { transform: scale(1.1); box-shadow: 0 0 0 2.5px var(--gold); }
  .gridl p { grid-column: 1 / -1; margin: 20px 0; font-size: 14px; color: var(--muted); }
  .er { margin: 8px 4px 0; font-size: 13px; color: var(--neg); }
  .go, .rm { display: block; width: 100%; min-height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; }
  .go { margin-top: 10px; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); }
  .rm { margin-top: 8px; min-height: 44px; font-size: 14px; color: var(--neg); background: var(--fill); }
  button:disabled { opacity: .5; }
  @media (prefers-reduced-motion: reduce) { .big { animation: none; } }
</style>
