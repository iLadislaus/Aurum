<script>
  import { oc, closeOp } from './opcard.svelte.js';
  import { peek, refresh, put } from './cache.svelte.js';
  import { loadCategories, setOpCategory, setOpType, loadSplits, saveSplits, clearSplits, rememberRule, countUncat, applyUncat, deleteOp, repeatOp } from './data.js';
  import { prefetchAll } from './prefetch.js';
  import { openNewOp } from './newop.svelte.js';
  import { fmt } from './format.js';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';

  let dy = $state(0), y0 = null, dragging = $state(false);
  let full = $state(false), H = $state(700), shEl, vel = 0, ly = 0, lt = 0;
  const half = $derived(Math.round(H * 0.5));
  const base = $derived(full ? 0 : half);
  const pos = $derived(Math.max(0, base + dy));

  let split = $state(false), parts = $state([]), typePick = $state(false), pick = $state(false), remember = $state(true), armed = $state(false), busy = $state(false), err = $state(''), more = $state(0), timer;
  let cats = $derived(peek('cats')?.list ?? []);
  // всегда берём свежую версию операции из списка (после смены категории и т. п.)
  let o = $derived(oc.op ? (peek(oc.key)?.ops.find((x) => x.id === oc.op.id) ?? oc.op) : null);
  const kind = { EXPENSE: 'Расход', INCOME: 'Доход', RETURN: 'Возврат', TRANSFER: 'Перевод' };
  const tr = $derived(o?.action === 'TRANSFER');
  const sgn = $derived(!o || tr ? '' : o.v > 0 ? '+' : '−');
  const amt = $derived(o ? sgn + fmt(Math.abs(tr ? o.amount : o.v), o.foreign || Math.abs(o.amount) % 1 ? 2 : 0) + ' ' + o.sym : '');
  const when = $derived(o ? new Date(o.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }) : '');
  const list = $derived(cats.filter((c) => (o?.action === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE')));

  $effect(() => {
    if (!oc.open) return;
    pick = false; typePick = false; split = false; parts = []; remember = true; armed = false; err = ''; more = 0; full = false; dy = 0;
    if (shEl) H = shEl.offsetHeight;
    refresh('cats', loadCategories).catch(() => {});
  });

  function patch(fn) {
    const old = peek(oc.key);
    if (old) put(oc.key, { ...old, ops: old.ops.map((x) => (x.id === oc.op.id ? fn(x) : x)) });
  }
  async function choose(c) {
    busy = true; err = '';
    const was = o;
    patch((x) => ({ ...x, category_id: c.id, cat: c.name, icon: c.icon, uncat: false, name: x.note.trim() ? x.name : c.name }));
    pick = false;
    try {
      await setOpCategory(was.id, c.id);
      if (remember && was.note.trim()) {
        await rememberRule(was.action, was.note, c.id);
        more = await countUncat(was.action, was.note.trim(), was.id);
      }
      prefetchAll(true);
    } catch (e) { err = e.message || 'Не удалось сохранить'; patch(() => was); }
    busy = false;
  }
  async function chooseType(a) {
    if (a === o.action) { typePick = false; return; }
    busy = true; err = ''; const was = o;
    const keep = cats.find((c) => c.id === was.category_id && (a === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE'));
    patch((x) => ({ ...x, action: a, v: a === 'EXPENSE' ? -x.amount : x.amount, category_id: keep ? keep.id : null, cat: keep ? keep.name : 'Без категории', icon: keep ? keep.icon : 'tag', uncat: !keep, name: x.note.trim() ? x.name : keep ? keep.name : 'Операция' }));
    typePick = false;
    try { await setOpType(was.id, a, keep ? keep.id : null); prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось сменить тип'; patch(() => was); }
    busy = false;
  }
  const total = $derived(o ? Math.abs(o.amount) : 0);
  const left = $derived(+(total - parts.reduce((t, p) => t + (Number(p.v) || 0), 0)).toFixed(2));
  const catOf = (id) => cats.find((c) => c.id === id);
  async function openSplit() {
    split = true; pick = false; typePick = false; full = true;
    let ex = [];
    if (o.splits) { try { ex = await loadSplits(o.id); } catch {} }
    parts = ex.length ? ex.map((x) => ({ id: x.category_id, v: x.amount })) : [{ id: o.category_id ?? list[0]?.id, v: total }];
  }
  function addPart(c) { parts = [...parts, { id: c.id, v: Math.max(0, left) }]; }
  function setPart(i, val) { parts[i].v = parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0; }
  async function doSplit() {
    busy = true; err = '';
    try {
      const ps = parts.map((p) => ({ category_id: p.id, amount: +Number(p.v).toFixed(2) }));
      await saveSplits(o.id, total, ps);
      const top = [...ps].sort((a, b) => b.amount - a.amount)[0];
      patch((x) => ({ ...x, splits: ps.length, cat: `${ps.length} категории`, category_id: top.category_id, uncat: false }));
      split = false; prefetchAll(true);
    } catch (e) { err = e.message || 'Не удалось разделить'; }
    busy = false;
  }
  async function undoSplit() {
    busy = true;
    try { await clearSplits(o.id); const c = catOf(o.category_id); patch((x) => ({ ...x, splits: 0, cat: c?.name ?? 'Без категории' })); split = false; prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось убрать разделение'; }
    busy = false;
  }
  async function applyMore() {
    const cid = o.category_id; busy = true;
    try { await applyUncat(o.action, o.note.trim(), cid); more = 0; prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось применить'; }
    busy = false;
  }
  async function del() {
    if (o?.mono) return;
    if (!armed) { armed = true; clearTimeout(timer); timer = setTimeout(() => (armed = false), 3000); return; }
    const old = peek(oc.key), id = o.id;
    put(oc.key, { ...old, ops: old.ops.filter((x) => x.id !== id) });
    closeOp();
    try { await deleteOp(id); prefetchAll(true); } catch (e) { put(oc.key, old); }
  }
  async function rep() {
    if (o?.mono) return;
    busy = true;
    try { await repeatOp(o); closeOp(); prefetchAll(true); } catch (e) { err = e.message || 'Не удалось повторить'; }
    busy = false;
  }

  function down(e) { y0 = e.clientY; dy = 0; vel = 0; ly = e.clientY; lt = performance.now(); }
  function move(e) {
    if (y0 == null) return;
    dy = Math.max(-base, e.clientY - y0);
    const t = performance.now();
    vel = (e.clientY - ly) / Math.max(1, t - lt); ly = e.clientY; lt = t;
    if (Math.abs(dy) > 4 && !dragging) { dragging = true; e.currentTarget?.setPointerCapture?.(e.pointerId); }
  }
  function up() {
    if (y0 == null) return;
    const p = pos; y0 = null; dragging = false; dy = 0;
    if (vel < -0.5) full = true;
    else if (vel > 0.5) { if (full) full = false; else closeOp(); }
    else {
      const d = [[0, 'f'], [half, 'h'], [H, 'c']].sort((m, n) => Math.abs(m[0] - p) - Math.abs(n[0] - p))[0][1];
      if (d === 'c') closeOp(); else full = d === 'f';
    }
  }
</script>

<div class="oc" class:open={oc.open} aria-hidden={!oc.open}>
  <button class="ov" aria-label="Закрыть" style:opacity={oc.open ? Math.max(0, Math.min(1, 1 - (pos - half) / (H - half))) : 0} onclick={closeOp}></button>
  <div class="sh" class:dragging bind:this={shEl} role="dialog" aria-modal="true" aria-label="Операция" style:transform={oc.open ? `translateY(${pos}px)` : undefined}>
    <div class="top" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}><div class="gr"></div></div>
    {#if o}
      <div class="sc" class:lock={!full && !pick}>
        <div class="hd">
          <div class="av">{#if o.uncat}<span class="q">?</span>{:else}<OpAvatar icon={o.icon} size={54} />{/if}</div>
          <div class="nm">{o.name}</div>
          <div class="am" class:pos={o.v > 0 && !tr} class:tr>{amt}</div>
        </div>

        <div class="lst">
          {#if !o.mono && !tr}
            <button class="lr cat" onclick={() => { typePick = !typePick; if (typePick) { pick = false; full = true; } }}><span>Тип</span><b>{kind[o.action]}</b><Icon name="chevron" size={14} /></button>
          {:else}
            <div class="lr"><span>Тип</span><b>{kind[o.action]}</b></div>
          {/if}
          <button class="lr cat" onclick={() => { pick = !pick; if (pick) { typePick = false; full = true; } }}>
            <span>Категория</span>
            <b class:red={o.uncat}>{o.cat}</b>
            <Icon name="chevron" size={14} />
          </button>
          <div class="lr"><span>{tr ? 'Перевод' : 'Счёт'}</span><b>{o.acc || '—'}</b></div>
          <div class="lr"><span>Дата</span><b>{when}</b></div>
          {#if o.rate}<div class="lr"><span>Курс</span><b>{fmt(Number(o.rate), 2)}</b></div>{/if}
          {#if o.note.trim() && o.note.trim() !== o.name}<div class="lr"><span>Заметка</span><b>{o.note}</b></div>{/if}
          {#if o.mono}<div class="lr lk"><svg viewBox="0 0 24 24" width="13" height="13"><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg><span>Банковская операция: можно менять только категорию</span></div>{/if}
        </div>

        {#if typePick}
          <div class="seg">
            {#each ['EXPENSE', 'INCOME', 'RETURN'] as a}<button class:on={o.action === a} onclick={() => chooseType(a)}>{kind[a]}</button>{/each}
          </div>
        {/if}

        {#if pick}
          <div class="pk">
            <div class="chips">
              {#each list as c (c.id)}
                <button class:on={c.id === o.category_id} onclick={() => choose(c)}><OpAvatar icon={c.icon} size={26} /><span>{c.name}</span></button>
              {/each}
            </div>
            {#if o.note.trim()}
              <label class="rm"><span>Запомнить для «{o.note.trim().slice(0, 22)}»</span><input type="checkbox" bind:checked={remember} /><i class="tg"></i></label>
            {/if}
          </div>
        {/if}

        {#if split}
          <div class="sp">
            <div class="sbar">{#each parts as p}<i style:width="{Math.min(100, (Number(p.v) || 0) / total * 100)}%"></i>{/each}</div>
            <div class="sleft"><span>Сумма {fmt(total, 2)} {o.sym}</span><b class:ok={left === 0}>Осталось {fmt(left, 2)}</b></div>
            {#each parts as p, i (i)}
              <div class="pt"><OpAvatar icon={catOf(p.id)?.icon ?? 'tag'} size={30} /><span>{catOf(p.id)?.name ?? '—'}</span>
                <input inputmode="decimal" value={fmt(p.v, 2)} oninput={(e) => setPart(i, e.currentTarget.value)} onblur={(e) => (e.currentTarget.value = fmt(p.v, 2))} />
                {#if parts.length > 1}<button aria-label="Убрать" onclick={() => (parts = parts.filter((_, k) => k !== i))}>✕</button>{/if}
              </div>
            {/each}
            <div class="chips add">{#each list.filter((c) => !parts.some((p) => p.id === c.id)) as c (c.id)}<button onclick={() => addPart(c)}><OpAvatar icon={c.icon} size={22} /><span>{c.name}</span></button>{/each}</div>
            <button class="ap" disabled={busy || left !== 0 || parts.length < 2} onclick={doSplit}>Сохранить разделение</button>
          </div>
        {:else if !tr}
          <button class="ap" onclick={openSplit}>{o.splits ? 'Изменить разделение' : 'Разделить на категории'}</button>
          {#if o.splits}<button class="ap un" onclick={undoSplit}>Убрать разделение</button>{/if}
        {/if}

        {#if more > 0}
          <button class="ap" onclick={applyMore}>Применить ещё к {more} операциям без категории</button>
        {/if}
        {#if err}<p class="er">{err}</p>{/if}

        <div class="act">
          {#if !o.mono}<button class="g" onclick={() => { const e = o; closeOp(); setTimeout(() => openNewOp(e), 250); }}>Изменить</button>{/if}
          {#if !o.mono}<button class="s" disabled={busy} onclick={rep}>Повторить</button>{/if}
          {#if !o.mono}<button class="d" class:armed onclick={del}>{armed ? 'Точно удалить?' : 'Удалить'}</button>{/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .oc { position: absolute; inset: 0; z-index: 56; pointer-events: none; }
  .oc.open { pointer-events: auto; }
  .ov { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .4); opacity: 0; transition: opacity .45s cubic-bezier(.32, .72, 0, 1); }
  .sh { position: absolute; left: 14px; right: 14px; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 14px); display: flex; flex-direction: column;
    background: var(--bg); border-radius: 26px 26px 0 0; overflow: hidden; transform: translateY(105%); transition: transform .5s cubic-bezier(.32, .72, 0, 1);
    box-shadow: inset 0 1px 0 rgba(255, 236, 170, .9), inset 0 0 0 .5px rgba(214, 164, 62, .4), 0 -3px 16px rgba(226, 172, 62, .26); }
  .sh.dragging { transition: none; }
  .top { flex: none; touch-action: none; padding-bottom: 4px; }
  .gr { width: 36px; height: 5px; border-radius: 3px; background: #C9A24A; opacity: .8; margin: 8px auto; }
  .sc { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 0 12px calc(24px + var(--safe-b)); }
  .sc.lock { overflow: hidden; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
  .hd { text-align: center; padding: 2px 0 12px; }
  .av { display: grid; place-items: center; animation: pop .55s cubic-bezier(.2, .9, .3, 1.1) both; }
  .q { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: #E5584D; font-size: 22px; font-weight: 700; }
  .nm { margin-top: 8px; font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
  .am { font-size: 32px; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; animation: rise .45s ease .1s both; }
  .am.pos { color: var(--pos); } .am.tr { color: var(--text); }
  .lst { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .lr { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 11px 14px; font-size: 14.5px; text-align: left; animation: rise .35s cubic-bezier(.2, .8, .2, 1) both; }
  .lr + .lr::before { content: ""; position: absolute; top: 0; left: 14px; right: 0; height: .5px; background: var(--line); }
  .lr span { color: var(--muted); flex: none; }
  .lr b { font-weight: 500; text-align: right; margin-left: auto; overflow-wrap: anywhere; }
  .lr b.red { color: #E5584D; }
  .cat :global(svg) { color: var(--muted); flex: none; }
  .lk { justify-content: flex-start; gap: 7px; font-size: 12px; color: var(--muted); padding: 9px 14px; }
  .lk svg { flex: none; fill: none; stroke: #C9A24A; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .lk span { color: var(--muted); }
  .seg { display: flex; gap: 4px; margin-top: 10px; padding: 3px; border-radius: 12px; background: var(--fill); animation: rise .3s cubic-bezier(.2, .8, .2, 1) both; }
  .seg button { flex: 1; padding: 8px 0; border-radius: 9px; font-size: 13.5px; font-weight: 600; transition: background .25s, color .25s; }
  .seg button.on { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .pk { margin-top: 10px; animation: rise .3s cubic-bezier(.2, .8, .2, 1) both; }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .chips button { display: flex; align-items: center; gap: 6px; padding: 4px 11px 4px 4px; border-radius: 99px; background: var(--fill); font-size: 13px; font-weight: 500; }
  .chips button.on { background: var(--gold-soft); color: var(--gold); }
  .rm { position: relative; display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 9px 14px; border-radius: 14px; background: var(--card); font-size: 13.5px; }
  .rm input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; }
  .tg { flex: none; width: 51px; height: 31px; border-radius: 99px; background: rgba(120, 120, 128, .32); position: relative; transition: background .25s; }
  .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .25); transition: transform .25s cubic-bezier(.32, .72, 0, 1); }
  .rm input:checked + .tg { background: #D9A93F; }
  .rm input:checked + .tg::after { transform: translateX(20px); }
  .sp { margin-top: 10px; animation: rise .3s cubic-bezier(.2, .8, .2, 1) both; }
  .sbar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--fill); }
  .sbar i { background: linear-gradient(90deg, #C99A3C, #F0D18A); border-right: 1px solid var(--bg); transition: width .4s cubic-bezier(.32, .72, 0, 1); }
  .sleft { display: flex; justify-content: space-between; margin: 7px 2px 8px; font-size: 12.5px; color: var(--muted); }
  .sleft b { font-weight: 600; color: #E5584D; transition: color .3s; } .sleft b.ok { color: var(--pos); }
  .pt { display: flex; align-items: center; gap: 9px; margin-bottom: 6px; padding: 6px 10px; border-radius: 14px; background: var(--card); }
  .pt span { flex: 1; font-size: 14px; font-weight: 600; }
  .pt input { width: 92px; padding: 7px 9px; border: 0; outline: 0; border-radius: 9px; background: var(--fill); color: var(--text); font: inherit; font-weight: 600; text-align: right; -webkit-user-select: text; user-select: text; }
  .pt button { color: var(--muted); font-size: 15px; padding: 0 2px; }
  .chips.add { margin: 8px 0 2px; }
  .ap:disabled { opacity: .4; }
  .ap.un { background: var(--fill); color: var(--muted); margin-top: 8px; }
  .ap { display: block; width: 100%; margin-top: 10px; padding: 11px; border-radius: 14px; background: var(--gold-soft); color: var(--gold); font-size: 13.5px; font-weight: 600; }
  .er { margin: 10px 0 0; text-align: center; font-size: 13px; color: #E5584D; }
  .act { display: flex; gap: 8px; margin-top: 14px; }
  .act button { flex: 1; height: 46px; border-radius: 14px; font-size: 15px; font-weight: 600; transition: background .25s, color .25s; }
  .act .g { background: linear-gradient(180deg, #F0D18A, #C9963A); color: #1a1206; }
  .act .s { background: var(--fill); }
  .act .d { background: rgba(229, 72, 77, .14); color: #E5484D; }
  .act .d.armed { background: #E5484D; color: #fff; }
  @media (prefers-color-scheme: dark) { .sh { box-shadow: inset 0 1px 0 rgba(255, 232, 160, .55), inset 0 0 0 .5px rgba(232, 194, 119, .45), 0 -3px 18px rgba(240, 190, 90, .24); } }
  @media (prefers-reduced-motion: reduce) { .ov, .sh { transition: none; } .av, .am, .lr, .pk { animation: none; } }
</style>
