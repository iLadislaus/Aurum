<script>
  // Окно «Правила»: автокатегории по названию операции. Размер и жесты те же, что у «Аналитики»
  import { untrack } from 'svelte';
  import { rl, closeRules, openNewRule } from './rules.svelte.js';
  import { loadRules, loadCategories, setRuleCategory, deleteRule } from './data.js';
  import { refresh, peek, put } from './cache.svelte.js';
  import { fmt, plural } from './format.js';
  import Sheet from './Sheet.svelte';
  import SwipeRow from './SwipeRow.svelte';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import { logoFile, loadBrands } from './brands.svelte.js';
  import { openLogo } from './logopick.svelte.js';

  const KINDS = [['EXPENSE', 'Расходы'], ['INCOME', 'Доходы'], ['RETURN', 'Возвраты'], ['TRANSFER', 'Переводы']];

  let kind = $state('EXPENSE'), q = $state(''), openId = $state(null), armed = $state(null), flash = $state(null), err = $state('');
  const all = $derived(peek('rules')?.list ?? null);
  const cats = $derived(peek('cats')?.list ?? []);
  const byId = $derived(new Map(cats.map((c) => [c.id, c])));
  const catName = (r) => (r.action === 'TRANSFER' ? [r.from, r.to].filter(Boolean).join(' → ') || 'перевод' : byId.get(r.catId)?.name ?? 'без категории');
  const icon = (r) => (r.action === 'TRANSFER' ? 'swap' : byId.get(r.catId)?.icon ?? 'tag');
  // у перевода нет магазина, поэтому и логотипа
  const shop = (r) => (r.action === 'TRANSFER' ? '' : r.note);
  const choices = $derived(cats.filter((c) => (kind === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE')));
  const list = $derived.by(() => {
    const s = q.trim().toLowerCase();
    return (all ?? []).filter((r) => r.action === kind && (!s || r.note.toLowerCase().includes(s) || catName(r).toLowerCase().includes(s)));
  });

  async function load() {
    err = '';
    try { await Promise.all([refresh('rules', loadRules, true), refresh('cats', loadCategories)]); }
    catch { err = 'Не удалось загрузить'; }
  }
  // загрузка только при открытии окна: чтение кэша внутри не должно перезапускать эффект
  $effect(() => {
    if (!rl.open) return;
    untrack(() => { q = ''; openId = null; armed = null; load(); loadBrands().catch(() => {}); });
  });

  const pickKind = (k) => { kind = k; openId = null; armed = null; };
  const toggle = (id) => { openId = openId === id ? null : id; armed = null; };

  // сначала меняем на экране, потом в базе; при ошибке возвращаем как было
  async function change(next, send) {
    const was = peek('rules');
    err = '';
    put('rules', { list: next(was.list) });
    try { await send(); }
    catch { await refresh('rules', loadRules, true).catch(() => put('rules', was)); err = 'Не удалось сохранить'; }
  }
  function setCat(r, catId) {
    if (catId === r.catId) { openId = null; return; }
    flash = r.id;
    setTimeout(() => (openId = openId === r.id ? null : openId), 450);
    setTimeout(() => (flash = null), 1400);
    change((l) => l.map((x) => (x.id === r.id ? { ...x, catId } : x)), () => setRuleCategory(r.id, catId));
  }
  function remove(r) {
    openId = null; armed = null;
    change((l) => l.filter((x) => x.id !== r.id), () => deleteRule(r.id));
  }
</script>

<Sheet open={rl.open} onclose={closeRules} title="Правила" sub={all ? `${fmt(all.length)} ${plural(all.length, 'правило', 'правила', 'правил')}` : ''} z={50}>
  {#snippet lead()}
    <button class="add" aria-label="Новое правило" onpointerdown={(e) => e.stopPropagation()} onclick={() => openNewRule(kind === 'TRANSFER' ? 'EXPENSE' : kind)}><Icon name="plus" size={20} /></button>
  {/snippet}
  <div class="head">
    <label class="srch"><Icon name="search" size={16} /><input type="search" placeholder="Название или категория" autocomplete="off" bind:value={q} /></label>
    <div class="seg" style:--p={KINDS.findIndex((k) => k[0] === kind)}><i></i>
      {#each KINDS as [k, t] (k)}<button class:on={kind === k} onclick={() => pickKind(k)}>{t}</button>{/each}
    </div>
  </div>
  {#if err}<p class="msg bad">{err}</p>{/if}
  {#if !all}
    {#if !err}<p class="msg">Загружаю…</p>{:else}<button class="again" onclick={load}>Повторить</button>{/if}
  {:else if !list.length}
    <p class="msg">{q.trim() ? 'Ничего не найдено' : 'Правил пока нет'}</p>
  {:else}
    {#key kind}
      <div class="list">
        {#each list as r, i (r.id)}
          <div class="rw" class:rise={i < 14} style="--i:{Math.min(i, 14)}">
            <SwipeRow id={'rule.' + r.id} norepeat ondelete={() => remove(r)}>
              <button class="r" onclick={() => toggle(r.id)} aria-expanded={openId === r.id}>
                {#key shop(r) && logoFile(shop(r))}
                  <span class="ic" class:flash={flash === r.id} class:logo={shop(r) && logoFile(shop(r))}><OpAvatar icon={icon(r)} size={34} name={shop(r)} lazy /></span>
                {/key}
                <span class="m"><b>{r.note}</b><small>{catName(r)}</small></span>
                <span class="ch" class:up={openId === r.id}><Icon name="chevron" size={14} /></span>
              </button>
            </SwipeRow>
            <div class="x" class:o={openId === r.id} inert={openId !== r.id}><div>
              {#if openId === r.id}
                <div class="chips">
                  {#if r.action !== 'TRANSFER'}
                    {#each choices as c (c.id)}<button class="c" class:on={r.catId === c.id} onclick={() => setCat(r, c.id)}><Icon name={c.icon} size={14} />{c.name}</button>{/each}
                    <button class="c lgo" onclick={() => openLogo(r.note, icon(r))}><Icon name="tag" size={14} />Логотип</button>
                  {/if}
                  <button class="c del" onclick={() => (armed === r.id ? remove(r) : (armed = r.id))}>{armed === r.id ? 'Точно удалить?' : 'Удалить правило'}</button>
                </div>
              {/if}
            </div></div>
          </div>
        {/each}
      </div>
    {/key}
  {/if}
</Sheet>

<style>
  .add { position: absolute; right: 10px; top: 14px; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); }
  .head { position: sticky; top: -4px; z-index: 2; background: var(--bg); padding: 4px 0 10px; }
  .srch { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; margin-bottom: 8px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); color: var(--muted); }
  .srch input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; }
  .seg { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--fill); border-radius: 11px; padding: 2px; position: relative; }
  .seg i { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / 4); border-radius: 9px; background: linear-gradient(#F6E3A1, #D9B24C 60%, #B8892B); transform: translateX(calc(var(--p) * 100%)); transition: transform .4s cubic-bezier(.32, .72, 0, 1); }
  .seg button { position: relative; z-index: 1; min-height: 40px; font-size: 12.5px; font-weight: 600; color: var(--muted); transition: color .3s; }
  .seg button.on { color: #1A1204; }
  .list { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; }
  .rw { position: relative; }
  .rw + .rw::before { content: ""; position: absolute; top: 0; left: 60px; right: 0; height: .5px; background: var(--line); z-index: 1; }
  .r { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 11px 14px; text-align: left; transition: background .15s; }
  .r:active { background: var(--fill); }
  .ic { display: flex; border-radius: 50%; flex: none; }
  .ic.logo > :global(img) { animation: turn .55s cubic-bezier(.3, 1.35, .5, 1) calc(.2s + var(--i) * 70ms) backwards; }
  @keyframes turn { from { transform: perspective(300px) rotateY(-180deg) scale(.7); opacity: 0; } }
  .ic.flash { animation: fl .9s; }
  @keyframes fl { 30% { box-shadow: 0 0 0 1px var(--gold), 0 0 18px var(--glow); transform: scale(1.12); } }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-weight: 500; font-size: 15px; overflow-wrap: anywhere; white-space: pre-line; }
  .m small { display: block; color: var(--muted); font-size: 12px; }
  .ch { display: grid; color: var(--muted); opacity: .6; transition: transform .35s; }
  .ch.up { transform: rotate(180deg); }
  .x { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.32, .72, 0, 1); }
  .x.o { grid-template-rows: 1fr; }
  .x > div { overflow: hidden; min-height: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 12px 12px 14px; }
  .c { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 13px; border-radius: 99px; background: var(--fill); font-size: 13px; transition: background .25s, box-shadow .25s; }
  .c :global(svg) { color: var(--gold); }
  .c.on { background: var(--gold-soft); box-shadow: inset 0 0 0 1px var(--gline); color: var(--gold); }
  .c.lgo { color: var(--gold); box-shadow: inset 0 0 0 1px var(--gline); }
  .c.del { color: var(--neg); }
  .msg { margin: 28px 0; text-align: center; font-size: 14px; color: var(--muted); }
  .msg.bad { margin: 0 0 10px; color: var(--neg); }
  .again { display: block; margin: 0 auto; min-height: 44px; padding: 0 20px; color: var(--gold); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .seg i, .x, .ch { transition: none; } .ic.flash, .ic.logo > :global(img) { animation: none; } }
</style>
