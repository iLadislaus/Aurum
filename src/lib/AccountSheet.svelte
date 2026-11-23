<script>
  import { acct, closeAcct } from './acctsheet.svelte.js';
  import { peek, refresh } from './cache.svelte.js';
  import { loadAccountOps } from './data.js';
  import { cash } from './format.js';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';

  let q = $state('');
  let dy = $state(0), y0 = null, dragging = $state(false);
  let full = $state(false), H = $state(700), shEl, vel = 0, ly = 0, lt = 0;
  const half = $derived(Math.round(H * 0.46));
  const base = $derived(full ? 0 : half);
  const pos = $derived(Math.max(0, base + dy));
  let data = $derived(acct.id ? peek('ops.' + acct.id) : null);
  let err = $state('');

  // при открытии: сохранённое видно сразу, свежее подтягивается в фоне
  $effect(() => {
    if (!acct.open || !acct.id) return;
    q = ''; err = ''; full = false; dy = 0;
    if (shEl) H = shEl.offsetHeight;
    const id = acct.id;
    refresh('ops.' + id, () => loadAccountOps(id)).catch((e) => { if (!peek('ops.' + id)) err = e.message || 'Не удалось загрузить операции'; });
  });

  const dayKey = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
  function dayTitle(key) {
    const today = dayKey(new Date().toISOString());
    const diff = Math.round((new Date(today) - new Date(key)) / 86400000);
    if (diff <= 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    return new Date(key + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }
  let groups = $derived.by(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    const list = s ? data.ops.filter((o) => (o.name + ' ' + o.cat).toLowerCase().includes(s)) : data.ops;
    const m = new Map();
    for (const o of list) {
      const k = dayKey(o.date);
      if (!m.has(k)) m.set(k, { key: k, title: dayTitle(k), sum: 0, ops: [] });
      const g = m.get(k); g.sum += o.amount; g.ops.push(o);
    }
    return [...m.values()];
  });
  let avail = $derived(acct.balance + acct.limit);
  let used = $derived(acct.limit > 0 ? Math.min(1, Math.max(0, -acct.balance / acct.limit)) : 0);
  const c = (v) => cash(v, 2, acct.currency);

  function down(e) { y0 = e.clientY; dy = 0; vel = 0; ly = e.clientY; lt = performance.now(); }
  function move(e) {
    if (y0 == null) return;
    dy = Math.max(-base, e.clientY - y0);
    const t = performance.now();
    vel = (e.clientY - ly) / Math.max(1, t - lt); ly = e.clientY; lt = t;
    if (Math.abs(dy) > 4 && !dragging) { dragging = true; e.currentTarget.setPointerCapture(e.pointerId); }
  }
  function up() {
    if (y0 == null) return;
    const p = pos; y0 = null; dragging = false; dy = 0;
    if (vel < -0.5) full = true;
    else if (vel > 0.5) { if (full) full = false; else closeAcct(); }
    else {
      const d = [[0, 'f'], [half, 'h'], [H, 'c']].sort((m, n) => Math.abs(m[0] - p) - Math.abs(n[0] - p))[0][1];
      if (d === 'c') closeAcct(); else full = d === 'f';
    }
  }
</script>

<div class="as" class:open={acct.open} aria-hidden={!acct.open}>
  <button class="ov" aria-label="Закрыть" style:opacity={acct.open ? Math.max(0, Math.min(1, 1 - (pos - half) / (H - half))) : 0} onclick={closeAcct}></button>
  <div class="sh" class:dragging bind:this={shEl} role="dialog" aria-modal="true" aria-label={acct.name} style:transform={acct.open ? `translateY(${pos}px)` : undefined}>
    <div class="top" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
      <div class="gr"></div>
      <h3>{acct.name}</h3>
      <p class="st">{acct.kind}</p>
    </div>
    <div class="sc" class:lock={!full} onpointerdown={(e) => { if (!full) down(e); }} onpointermove={(e) => { if (!full) move(e); }} onpointerup={up} onpointercancel={up}>
      <div class="hero">
        <small>Остаток</small>
        <div class="big" class:neg={acct.balance < 0}>{c(acct.balance)}</div>
        {#if acct.limit > 0}
          <div class="bar"><i style:width="{Math.max(1.5, used * 100)}%"></i></div>
          <div class="cols">
            <div><span>Кредитный лимит</span><b>{cash(acct.limit, 0, acct.currency)}</b></div>
            <div><span>Доступно</span><b>{c(avail)}</b></div>
          </div>
        {/if}
      </div>

      {#if data}
        <div class="mo">
          <div><span>Пришло за месяц</span><b class="pos">{data.inc > 0 ? '+' : ''}{cash(data.inc, 0, acct.currency)}</b></div>
          <div><span>Ушло за месяц</span><b>{cash(data.out, 0, acct.currency)}</b></div>
        </div>
        <label class="srch"><Icon name="search" size={16} /><input type="search" placeholder="Поиск по операциям" bind:value={q} /></label>
        {#each groups as g (g.key)}
          <div class="dh"><span>{g.title}</span><span>{g.sum > 0 ? '+' : ''}{cash(g.sum, 0, acct.currency)}</span></div>
          <div class="cd">
            {#each g.ops as o (o.id)}
              <div class="r">
                <OpAvatar icon={o.icon} size={34} />
                <div class="m"><div class="n">{o.name}</div><div class="s">{o.cat}</div></div>
                <b class:pos={o.amount > 0}>{o.amount > 0 ? '+' : ''}{c(o.amount)}</b>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty">{q ? 'Ничего не найдено' : 'Операций по этому счёту пока нет'}</p>
        {/each}
      {:else if err}
        <p class="empty">{err}</p>
      {:else}
        <p class="empty">Загружаю…</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .as { position: absolute; inset: 0; z-index: 55; pointer-events: none; }
  .as.open { pointer-events: auto; }
  .ov { position: absolute; inset: 0; width: 100%; background: rgba(0, 0, 0, .4); opacity: 0; transition: opacity .45s cubic-bezier(.32, .72, 0, 1); }
  .sh { position: absolute; left: 0; right: 0; bottom: 0; top: calc(env(safe-area-inset-top, 0px) + 14px); display: flex; flex-direction: column;
    background: var(--bg); border-radius: 26px 26px 0 0; overflow: hidden; transform: translateY(105%); transition: transform .5s cubic-bezier(.32, .72, 0, 1);
    box-shadow: inset 0 1px 0 rgba(255, 236, 170, .9), inset 0 0 0 .5px rgba(214, 164, 62, .4), 0 -3px 16px rgba(226, 172, 62, .26); }
  .sh.dragging { transition: none; }
  .sh::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 90px; pointer-events: none; background: radial-gradient(70% 100% at 50% 0, rgba(236, 190, 84, .14), transparent); }
  .top { position: relative; flex: none; touch-action: none; padding-bottom: 8px; }
  .gr { width: 36px; height: 5px; border-radius: 3px; background: #C9A24A; opacity: .8; margin: 8px auto; }
  h3 { margin: 0; text-align: center; font-size: 16px; font-weight: 700; }
  .st { margin: 1px 0 0; text-align: center; font-size: 11.5px; color: var(--muted); }
  .sc { position: relative; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 4px 8px calc(30px + var(--safe-b)); }
  .sc.lock { overflow: hidden; touch-action: none; }
  .hero { border-radius: 22px; padding: 14px 16px; color: #F4EEDD; background: radial-gradient(120% 90% at 85% 0, #2A200C, #120F08 50%, #080807); box-shadow: 0 0 0 .5px rgba(232, 194, 119, .35), 0 14px 30px -18px rgba(232, 194, 119, .45); }
  .hero small { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #B3A47C; }
  .big { font-size: 34px; font-weight: 800; letter-spacing: -.04em; line-height: 1.1; margin: 3px 0 8px; color: #F6E3A1; font-variant-numeric: tabular-nums; }
  .big.neg { color: #FF8A7E; }
  .bar { height: 6px; border-radius: 3px; background: rgba(255, 255, 255, .12); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #C99A3C, #F6E3A1); }
  .cols { display: grid; grid-template-columns: 1fr 1fr; margin-top: 10px; border-top: .5px solid rgba(255, 255, 255, .1); }
  .cols div { padding-top: 8px; min-width: 0; }
  .cols div + div { padding-left: 12px; border-left: .5px solid rgba(255, 255, 255, .1); }
  .cols span { display: block; font-size: 11px; color: #9A917B; }
  .cols b { font-size: 13.5px; font-weight: 600; white-space: nowrap; }
  .mo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
  .mo div { background: var(--card); border-radius: 14px; padding: 9px 12px; min-width: 0; }
  .mo span { display: block; font-size: 11.5px; color: var(--muted); }
  .mo b { font-size: 15px; font-weight: 700; white-space: nowrap; }
  .pos { color: var(--pos); }
  .srch { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; margin-bottom: 4px; border-radius: 11px; background: var(--fill); color: var(--muted); }
  .srch input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: inherit; font-size: 15px; color: var(--text); -webkit-user-select: text; user-select: text; }
  .srch input::-webkit-search-cancel-button { display: none; }
  .dh { display: flex; justify-content: space-between; margin: 12px 6px 5px; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; font-variant-numeric: tabular-nums; }
  .cd { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .r { position: relative; display: flex; align-items: center; gap: 12px; padding: 9px 14px; min-height: 56px; }
  .r + .r::before { content: ""; position: absolute; top: 0; left: 60px; right: 0; height: .5px; background: var(--line); }
  .m { flex: 1; min-width: 0; }
  .n { font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { font-size: 12px; color: var(--muted); line-height: 16px; }
  .r b { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .empty { margin: 24px 0; text-align: center; color: var(--muted); font-size: 14px; }
  @media (prefers-color-scheme: dark) {
    .sh { box-shadow: inset 0 1px 0 rgba(255, 232, 160, .55), inset 0 0 0 .5px rgba(232, 194, 119, .45), 0 -3px 18px rgba(240, 190, 90, .24); }
    .sh::before { background: radial-gradient(70% 100% at 50% 0, rgba(240, 200, 110, .1), transparent); }
  }
  @media (prefers-reduced-motion: reduce) { .ov, .sh { transition: none; } }
</style>
