<script>
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import { bg, closeCats } from './budget.svelte.js';
  import { loadBudgetCats, saveBudgetCat, setCatEnv, countCatOps, deleteBudgetCat, incomeGroup } from './budget.js';
  import { refresh, peek } from './cache.svelte.js';
  import { fmt } from './format.js';
  import { onMount } from 'svelte';

  const ICONS = ['cart', 'eat', 'home', 'car', 'health', 'care', 'cloth', 'digital', 'film', 'family', 'gift', 'sofa', 'sport', 'study', 'bank', 'card', 'cash', 'wallet', 'coin', 'basket', 'chart', 'swap', 'pen', 'tag'];
  let d = $derived(peek('bcats'));
  let vp = $state();
  // окно сразу на весь экран, как остальные большие окна: список листается, закрытие свайпом вниз с верха
  let full = $state(false);
  $effect(() => { if (bg.cats) { const t = setTimeout(() => (full = true), 0); return () => clearTimeout(t); } });
  let tab = $state(0);             // 0 расходы, 1 доходы
  let view = $state(1);            // 1 список, 2 форма, 3 выбор конверта, 4 удаление
  let draft = $state(null), isNew = $state(false), busy = $state(false), err = $state('');
  let delTo = $state(null), delCount = $state(0);

  // у каждого вида свой верх: при переходе список листается с начала
  $effect(() => { view; const sc = vp?.closest('.sc'); if (sc) sc.scrollTop = 0; });
  const load = () => refresh('bcats', loadBudgetCats, true).catch(() => {});
  onMount(() => { if (!d) load(); });
  $effect(() => { if (bg.cats) { view = 1; err = ''; load(); } });

  const envOf = (id) => d?.envs.find((e) => e.id === id);
  const exp = $derived((d?.cats ?? []).filter((c) => !c.income));
  const withE = $derived(exp.filter((c) => c.env && envOf(c.env)));
  const noE = $derived(exp.filter((c) => !(c.env && envOf(c.env))));
  const inc = $derived((d?.cats ?? []).filter((c) => c.income));
  // перепутанная связка: у категории конверт с чужим названием, а у категории с таким названием конвертов нет
  const norm = (s) => s.toLowerCase();
  const swap = $derived((() => {
    if (!d) return null;
    for (const c of withE) {
      const e = envOf(c.env);
      if (norm(c.name) === norm(e.name)) continue;
      const owner = exp.find((x) => norm(x.name) === norm(e.name));
      const own = d.envs.find((x) => norm(x.name) === norm(c.name));
      if (owner && !owner.env && own) return { a: c, b: owner, ea: e.id, eb: own.id, env: e };
    }
    return null;
  })());
  async function fix() { if (!swap) return; try { await setCatEnv([[swap.a.id, swap.eb], [swap.b.id, swap.ea]]); await load(); } catch (e) { err = e.message; } }

  function open(c) {
    isNew = !c;
    draft = c ? { ...c } : { id: 0, name: '', income: false, icon: 'tag', mand: false, mode: 'Плавно', parts: 4, env: null, grp: 'Другое' };
    err = ''; view = 2; snap = isNew ? '' : key();
  }
  // всё, что меняется в форме, сохраняется само: новая категория создаётся при выходе из формы
  let snap = '', timer = 0;
  const key = () => JSON.stringify(draft);
  async function flush() {
    clearTimeout(timer);
    if (!draft || !draft.name.trim() || key() === snap) return;
    const k = key();
    try { await saveBudgetCat(draft); snap = k; await load(); } catch (e) { err = e.message || 'Не удалось сохранить'; }
  }
  $effect(() => {
    if (!draft || isNew || (view !== 2 && view !== 3)) return;
    const k = key();
    if (k === snap) return;
    clearTimeout(timer); timer = setTimeout(flush, 350);
    return () => clearTimeout(timer);
  });
  async function back() {
    if (view === 2) { await flush(); view = 1; return; }
    view = 2;
  }
  async function askDelete() { delCount = await countCatOps(draft.id).catch(() => 0); delTo = null; view = 4; }
  async function doDelete() {
    if (!delTo) return; busy = true;
    try { await deleteBudgetCat(draft.id, delTo); await load(); view = 1; } catch (e) { err = e.message || 'Не удалось удалить'; }
    busy = false;
  }
  const used = $derived(new Set((d?.cats ?? []).filter((x) => x.id !== draft?.id && x.env).map((x) => x.env)));
  const subtitle = (c) => (c.income ? 'доход' : (c.mand ? 'обязательная · ' : '') + c.mode.toLowerCase());
  const MODES = ['Плавно', 'Разово', 'Частями'];
  const GRP = ['Аванс', 'Зарплата', 'Другое'];
  const idx = (arr, v) => Math.max(0, arr.indexOf(v));
</script>

<Sheet open={bg.cats} onclose={closeCats} title="Категории" bind:full>
  <div class="vp" bind:this={vp}>
    <div class="vs" class:act={view === 1} style:transform="translateX({view === 1 ? 0 : -100}%)" class:off={view !== 1}>
      <div class="bar">
        {@render seg([`Расходы · ${exp.length}`, `Доходы · ${inc.length}`], tab, (i) => (tab = i))}
        <button class="plus" aria-label="Новая категория" onclick={() => open(null)}><Icon name="plus" size={20} /></button>
      </div>
      {#if swap}
        <button class="warnb" onclick={fix}><Icon name="care" size={20} /><div><b>Связи нужно проверить</b>{swap.a.name} привязана к конверту {swap.env.name}, а у {swap.b.name} конверта нет. <em>Нажми — поменяю местами.</em></div></button>
      {/if}
      {#if d}
        {#if tab === 0}
          <div class="sum"><div style="--k:0"><small>С конвертом</small><b>{withE.length}</b></div><div style="--k:1"><small>Платятся из Cash</small><b>{noE.length}</b></div></div>
          <h2>С конвертом<span>{withE.length}</span></h2>
          <div class="grp">{#each withE as c, k (c.id)}{@render row(c, k)}{/each}</div>
          <h2>Без конверта · из Cash<span>{noE.length}</span></h2>
          <div class="grp">{#each noE as c, k (c.id)}{@render row(c, k + withE.length)}{/each}</div>
        {:else}
          <h2>Доходы<span>{inc.length}</span></h2>
          <div class="grp">{#each inc as c, k (c.id)}{@render row(c, k)}{/each}</div>
        {/if}
        <p class="hint">Конверт показывает, из каких денег платится категория. Суммы и остатки считаются в плане.</p>
      {/if}
    </div>

    {#if draft}
    <div class="vs" class:act={view === 2} style:transform="translateX({view === 1 ? 100 : view === 2 ? 0 : -100}%)" class:off={view !== 2}>
      <div class="nav"><button class="back" aria-label="Назад" onclick={back}><Icon name="chevron" size={22} /></button><b>{isNew ? 'Новая категория' : 'Категория'}</b><span class="sp"></span></div>
      <div class="card">
        <label class="fr"><span>Название</span><input bind:value={draft.name} placeholder="Название" maxlength="40" oninput={() => (err = '')} /></label>
        {#if isNew}<div class="fr"><span>Тип</span>{@render seg(['Расход', 'Доход'], draft.income ? 1 : 0, (i) => (draft.income = i === 1))}</div>{/if}
      </div>
      {#if !draft.income}
        <div class="card">
          <div class="fr"><span>Обязательная</span><button class="tg" class:on={draft.mand} onclick={() => (draft.mand = !draft.mand)} aria-label="Обязательная"></button></div>
          <button class="fr" onclick={() => (view = 3)}><span>Конверт</span><span class="env" class:no={!envOf(draft.env)}>{#if envOf(draft.env)}<Icon name={envOf(draft.env).icon} size={16} />{envOf(draft.env).name}{:else}Без конверта{/if}<Icon name="chevron" size={14} /></span></button>
          <div class="fr"><span>Как тратится</span>{@render seg(MODES, idx(MODES, draft.mode), (i) => (draft.mode = MODES[i]))}</div>
          {#if draft.mode === 'Частями'}
            <div class="fr"><span>Частей в месяц</span><div class="st"><button onclick={() => (draft.parts = Math.max(2, draft.parts - 1))}>−</button><b>{draft.parts}</b><button onclick={() => (draft.parts = Math.min(8, draft.parts + 1))}>+</button></div></div>
          {/if}
        </div>
      {:else}
        <div class="card"><div class="fr"><span>Группа дохода</span>{@render seg(GRP, idx(GRP, draft.grp), (i) => (draft.grp = GRP[i]))}</div></div>
        <p class="hint">Пока группа определяется по названию: Advance — аванс, Salary — зарплата, остальное — другое.</p>
      {/if}
      <div class="fl">Иконка</div>
      <div class="ig">{#each ICONS as i (i)}<button class:on={draft.icon === i} onclick={() => (draft.icon = i)}><Icon name={i} size={20} /></button>{/each}</div>
      {#if err}<p class="er">{err}</p>{/if}
      {#if !isNew}<button class="dl" onclick={askDelete}>Удалить категорию…</button><p class="hint">Операции и правила перенесутся в категорию, которую выберешь.</p>{/if}
    </div>

    <div class="vs" class:act={view >= 3} style:transform="translateX({view >= 3 ? 0 : 100}%)" class:off={view < 3}>
      {#if view === 3}
        <div class="nav"><button class="back" aria-label="Назад" onclick={back}><Icon name="chevron" size={22} /></button><b>Конверт</b><span class="sp"></span></div>
        <div class="card"><button class="opt" class:on={!draft.env} onclick={() => { draft.env = null; view = 2; }}><div class="ic"><Icon name="cash" size={17} /></div><div class="m"><b>Без конверта</b><small>платится из Cash</small></div><span class="ck"></span></button></div>
        <div class="fl">Существующие конверты</div>
        <div class="card">{#each d.envs as e (e.id)}<button class="opt" class:on={draft.env === e.id} onclick={() => { draft.env = e.id; view = 2; }}><div class="ic"><Icon name={e.icon} size={17} /></div><div class="m"><b>{e.name}</b>{#if used.has(e.id)}<small>уже у другой категории</small>{/if}</div><span class="ck"></span></button>{/each}</div>
        <p class="hint">Здесь только выбор. Новые конверты создаются в «Счетах».</p>
      {:else if view === 4}
        <div class="nav"><button class="back" aria-label="Назад" onclick={back}><Icon name="chevron" size={22} /></button><b>Удалить</b><button class="done x" disabled={!delTo || busy} onclick={doDelete}>Удалить</button></div>
        <p class="hint" style="margin:0 0 12px">«{draft.name}»: {fmt(delCount)} операций и правила переедут в выбранную категорию.</p>
        <div class="card">{#each (d?.cats ?? []).filter((x) => x.id !== draft.id && x.income === draft.income) as c (c.id)}<button class="opt" class:on={delTo === c.id} onclick={() => (delTo = c.id)}><div class="ic"><Icon name={c.icon} size={17} /></div><div class="m"><b>{c.name}</b></div><span class="ck"></span></button>{/each}</div>
        {#if err}<p class="er">{err}</p>{/if}
      {/if}
    </div>
    {/if}
  </div>
</Sheet>

{#snippet row(c, k = 0)}
  {@const e = envOf(c.env)}
  <button class="r" style="--k:{k}" onclick={() => open(c)}>
    <div class="ic"><Icon name={c.icon} size={17} /></div>
    <div class="m"><b>{c.name}</b><small>{c.income ? 'доход' : c.mode.toLowerCase()}</small></div>
    <div class="ch">{#if c.mand && !c.income}<em class="bdg">обяз.</em>{/if}{#if c.income}<span class="pill no">{c.grp}</span>{:else if e}{#if norm(e.name) !== norm(c.name)}<span class="pill"><Icon name={e.icon} size={14} />{e.name}</span>{/if}{:else}<span class="pill no">Cash</span>{/if}</div>
    <span class="chev"><Icon name="chevron" size={14} /></span>
  </button>
{/snippet}

{#snippet seg(opts, i, set)}
  <div class="seg" style:--n={opts.length} style:--i={i}>
    <i class="th"></i>
    {#each opts as o, k (o)}<button class:on={k === i} onclick={() => set(k)}>{o}</button>{/each}
  </div>
{/snippet}

<style>
  .vp { position: relative; overflow: hidden; }
  .vs { position: absolute; top: 0; left: 0; right: 0; background: var(--bg); transition: transform .45s cubic-bezier(.32, .72, 0, 1), opacity .3s; padding: 0 6px 12px; }
  .vs.act { position: relative; }
  .vs.off { pointer-events: none; opacity: .4; }
  .bar { display: flex; align-items: center; gap: 10px; margin: 0 2px 12px; } .bar .seg { flex: 1; } .bar .seg button { padding: 7px 4px; text-align: center; }
  .sum { display: flex; gap: 8px; margin-bottom: 8px; } .sum div { flex: 1; background: var(--card); border-radius: 14px; padding: 8px 12px; box-shadow: var(--shadow); animation: up .5s calc(var(--k) * 60ms) both; } .sum small { display: block; font-size: 11px; color: var(--muted); } .sum b { font-size: 17px; }
  @keyframes up { from { opacity: 0; transform: translateY(10px); } }
  .r { animation: up .45s calc(var(--k, 0) * 30ms + .1s) both; }
  .bdg { font-style: normal; font-size: 10.5px; font-weight: 700; color: var(--gold); background: var(--gold-soft); border-radius: 99px; padding: 3px 8px; margin-right: 6px; }
  .plus { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 6px 14px -6px rgba(184, 134, 44, .8); transition: transform .2s; }
  .plus:active { transform: scale(.9) rotate(90deg); }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  .warnb { display: flex; gap: 11px; align-items: center; width: 100%; text-align: left; padding: 11px 13px; border-radius: 16px; background: rgba(230, 150, 30, .14); box-shadow: inset 0 0 0 .5px rgba(232, 176, 74, .4); margin-bottom: 14px; color: #B07416; font-size: 13px; line-height: 1.35; }
  .warnb b { display: block; font-size: 14px; } .warnb em { font-style: normal; color: var(--muted); }
  h2 { display: flex; justify-content: space-between; margin: 0 14px 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 600; }
  h2 span { font-weight: 400; }
  .grp, .card { background: var(--card); border-radius: 16px; margin-bottom: 18px; overflow: hidden; box-shadow: var(--shadow); }
  .card { margin-bottom: 14px; }
  .r, .opt { display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 12px 9px 14px; text-align: left; position: relative; min-height: 52px; }
  .r:active, .opt:active { background: var(--fill); }
  .r + .r::before, .opt + .opt::before { content: ""; position: absolute; left: 60px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .ic { width: 34px; height: 34px; border-radius: 50%; background: var(--gold-soft); color: var(--gold); display: grid; place-items: center; flex: none; }
  .m { flex: 1; min-width: 0; } .m b { display: block; font-weight: 500; } .m small { display: block; font-size: 11.5px; color: var(--muted); margin-top: 1px; }
  .ch { flex: none; max-width: 150px; display: flex; align-items: center; }
  .pill { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px 0 7px; border-radius: 99px; background: var(--gold-soft); color: var(--gold); font-size: 12px; font-weight: 600; white-space: nowrap; max-width: 128px; overflow: hidden; text-overflow: ellipsis; }
  .pill.no { background: var(--fill); color: var(--muted); font-weight: 500; padding: 0 10px; }
  .chev { color: var(--muted); opacity: .5; display: flex; transform: rotate(-90deg); }
  .hint { text-align: center; color: var(--muted); font-size: 12px; margin: 2px 12px 0; line-height: 1.35; }
  .er { text-align: center; color: var(--neg); font-size: 13px; margin: 8px 0; }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 12px; }
  .nav b { font-size: 16px; font-weight: 600; }
  .back { color: var(--gold); display: flex; align-items: center; min-width: 76px; height: 32px; } .back :global(svg) { transform: rotate(90deg); }
  .done { color: var(--gold); font-size: 16px; font-weight: 600; min-width: 76px; text-align: right; }
  .done.x { color: var(--neg); } .done:disabled { opacity: .4; } .sp { min-width: 76px; }
  .fr { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; min-height: 50px; font-size: 15px; position: relative; width: 100%; text-align: left; }
  .fr + .fr::before { content: ""; position: absolute; left: 14px; right: 0; top: 0; border-top: .5px solid var(--line); }
  .fr > span:first-child { color: var(--muted); flex: none; }
  .fr input { flex: 1; min-width: 0; text-align: right; border: 0; background: none; color: var(--text); font: inherit; font-size: 16px; outline: none; }
  .env { display: flex; align-items: center; gap: 6px; color: var(--gold); font-weight: 600; } .env.no { color: var(--muted); font-weight: 500; }
  .seg { display: grid; grid-template-columns: repeat(var(--n), auto); background: var(--fill); border-radius: 10px; padding: 2px; position: relative; }
  .seg button { position: relative; z-index: 1; padding: 6px 11px; border-radius: 8px; font-size: 13px; font-weight: 500; }
  .seg .th { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--n)); border-radius: 8px; background: var(--seg-on); box-shadow: 0 1px 4px rgba(0, 0, 0, .18); transform: translateX(calc(var(--i) * 100%)); transition: transform .3s cubic-bezier(.3, 1.2, .4, 1); }
  .tg { width: 51px; height: 31px; border-radius: 99px; background: var(--fill); position: relative; transition: background .3s; flex: none; }
  .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(0, 0, 0, .3); transition: transform .3s cubic-bezier(.3, 1.3, .4, 1); }
  .tg.on { background: linear-gradient(160deg, #EBC77A, #B8862C); } .tg.on::after { transform: translateX(20px); }
  .fl { font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 16px 14px 8px; font-weight: 600; }
  .ig { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; justify-items: center; }
  .ig button { aspect-ratio: 1; width: 100%; max-width: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--card); color: var(--text); transition: transform .2s cubic-bezier(.3, 1.5, .5, 1); }
  .ig .on { background: linear-gradient(160deg, #EBC77A, #B8862C); color: #fff; transform: scale(1.1); }
  .st { display: flex; align-items: center; gap: 12px; } .st button { width: 30px; height: 30px; border-radius: 50%; background: var(--fill); font-size: 18px; } .st b { min-width: 16px; text-align: center; }
  .dl { width: 100%; height: 48px; border-radius: 14px; background: var(--card); color: var(--neg); font-weight: 500; margin: 6px 0 4px; box-shadow: var(--shadow); }
  .ck { width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); display: grid; place-items: center; flex: none; transition: .25s; }
  .opt.on .ck { background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: none; }
  .opt.on .ck::after { content: ""; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }
  @media (prefers-reduced-motion: reduce) { .vs { transition: none; } }
</style>
