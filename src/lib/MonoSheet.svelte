<script>
  // Окно «Monobank»: подключения, карты с собственными средствами, синхронизация. Размер как у «Аналитики»
  import { untrack } from 'svelte';
  import { mw, closeMono } from './monowin.svelte.js';
  import { callMono, loadMono, addedLabel, shortName, connTitle } from './mono.js';
  import { refresh, peek } from './cache.svelte.js';
  import { prefetchAll } from './prefetch.js';
  import { actualLabel, cash } from './format.js';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';

  let openId = $state(null), busy = $state(null), note = $state({}), err = $state('');
  const data = $derived(peek('mono'));
  const cur = (c) => c.currency || 'UAH';

  async function load() {
    err = '';
    try { await refresh('mono', loadMono, true); }
    catch (e) { err = e.message; }
  }
  $effect(() => {
    if (!mw.open) return;
    untrack(() => { openId = null; note = {}; load(); });
  });

  // собственные средства: баланс в банке без кредитного лимита
  const own = (c) => (c.balanceKop - c.creditLimitKop) / 100;
  const since = (conn) => {
    const t = conn.cards.map((c) => c.updatedAt).filter(Boolean).sort()[0];
    return t ? actualLabel(t).replace('актуально', 'баланс') : 'баланс ещё не получен';
  };
  const warn = (conn) => (conn.webhook === 'missing' || conn.webhook === 'other' ? 'уведомления банка не подключены' : '');

  function show(key, text, bad = false) {
    note = { ...note, [key]: { text, bad } };
    setTimeout(() => { if (note[key]?.text === text) note = { ...note, [key]: null }; }, 6000);
  }
  const done = async (created) => {
    if (created) prefetchAll(true);
    await refresh('mono', loadMono, true).catch(() => {});
  };

  // банк отвечает на один запрос выписки в минуту: карты идут по очереди, на отказе останавливаемся
  async function sync(conn) {
    if (busy) return;
    busy = conn.id;
    let created = 0, asked = 0, fail = '';
    for (const c of conn.cards) {
      try { const r = await callMono('sync', { accountId: c.accountId }); created += r.created || 0; asked++; if (r.errors) fail = r.firstError || 'Часть операций не загрузилась'; }
      catch (e) {
        if (e.code !== 'RATE_LIMITED') fail = e.message;
        else if (!asked) fail = e.message;
        break;
      }
    }
    await done(created);
    if (fail) show(conn.id, fail, true);
    else show(conn.id, `${addedLabel(created)} за 48 часов${asked < conn.cards.length ? '. Остальные карты — через минуту' : ''}`);
    busy = null;
  }
  async function month(conn, c) {
    if (busy) return;
    busy = 'c' + c.accountId;
    try { const r = await callMono('import', { accountId: c.accountId }); await done(r.created); show(conn.id, `${shortName(c.name)}: ${addedLabel(r.created).toLowerCase()} за 31 день`); }
    catch (e) { show(conn.id, e.message, true); }
    busy = null;
  }
</script>

<Sheet open={mw.open} onclose={closeMono} title="Monobank" sub={data?.polling === false ? 'автообновление выключено' : 'операции приходят сами'} z={50}>
  {#snippet lead()}
    <button class="add" aria-label="Подключить Monobank" onpointerdown={(e) => e.stopPropagation()} onclick={() => (mw.connect = true)}><Icon name="plus" size={20} /></button>
  {/snippet}
  {#if err}<p class="msg bad">{err}</p>{/if}
  {#if !data}
    {#if !err}<p class="msg">Спрашиваю банк…</p>{:else}<button class="again" onclick={load}>Повторить</button>{/if}
  {:else if !data.connections.length}
    <p class="msg">Monobank не подключён. Нажмите «+»</p>
  {:else}
    {#each data.connections as conn, i (conn.id)}
      <div class="card rise" style="--i:{i * 3}">
        <div class="who">
          <span class="dot" class:warn={!!warn(conn) || data.polling === false}></span>
          <span class="t"><b>{connTitle(conn)}</b><small>{busy === conn.id ? 'спрашиваю банк…' : warn(conn) || since(conn)}</small></span>
          <button class="rb" class:spin={busy === conn.id} disabled={!!busy} aria-label="Синхронизировать" onclick={() => sync(conn)}><Icon name="sync" size={17} /></button>
          <button class="rb" aria-label="Настройки подключения" onclick={() => (mw.conn = conn.id)}><Icon name="gear" size={17} /></button>
        </div>
        <div class="res" class:o={!!note[conn.id]}><div>{#if note[conn.id]}<p class:bad={note[conn.id].bad} role="status">{#if !note[conn.id].bad}<Icon name="check" size={15} />{/if}{note[conn.id].text}</p>{/if}</div></div>
        {#each conn.cards as c (c.accountId)}
          <div class="cw">
            <button class="r" onclick={() => (openId = openId === c.accountId ? null : c.accountId)} aria-expanded={openId === c.accountId}>
              <span class="cd {c.type}"></span>
              <span class="m"><b>{shortName(c.name)}</b>{#if c.mask}<small>•• {c.mask.slice(-4)}</small>{/if}</span>
              <span class="bal num" class:neg={c.balanceKop != null && own(c) < 0}>{c.balanceKop == null ? '—' : cash(own(c), 2, cur(c))}</span>
              <span class="ch" class:up={openId === c.accountId}><Icon name="chevron" size={14} /></span>
            </button>
            <div class="x" class:o={openId === c.accountId} inert={openId !== c.accountId}><div><div class="act">
              {#if c.balanceKop != null}
                {#if c.creditLimitKop}<p class="ln">Кредитный лимит<b class="num">{cash(c.creditLimitKop / 100, 2, cur(c))}</b></p>{/if}
                <p class="ln">Баланс в банке<b class="num">{cash(c.balanceKop / 100, 2, cur(c))}</b></p>
              {/if}
              <button class="btn" disabled={!!busy} onclick={() => month(conn, c)}>{busy === 'c' + c.accountId ? 'Загружаю…' : 'Догрузить операции за 31 день'}</button>
            </div></div></div>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</Sheet>

<style>
  .add { position: absolute; right: 10px; top: 14px; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--gold-soft); color: var(--gold); }
  .card { background: var(--card); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; margin-bottom: 10px; }
  .who { display: flex; align-items: center; gap: 8px; padding: 10px 8px 4px 14px; }
  .dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: #30D158; animation: pu 2s infinite; }
  .dot.warn { background: #FF9F0A; animation: none; }
  @keyframes pu { 0% { box-shadow: 0 0 0 0 rgba(48, 209, 88, .6); } 70%, 100% { box-shadow: 0 0 0 7px rgba(48, 209, 88, 0); } }
  .t { flex: 1; min-width: 0; }
  .t b { display: block; font-size: 14px; }
  .t small { display: block; font-size: 11.5px; color: var(--muted); }
  .rb { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--gold); background: radial-gradient(circle, var(--gold-soft) 17px, transparent 18px); }
  .rb:disabled { opacity: .5; }
  .rb.spin { opacity: 1; }
  .rb.spin :global(svg) { animation: sp .8s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
  .res { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s; }
  .res.o { grid-template-rows: 1fr; }
  .res > div { overflow: hidden; min-height: 0; }
  .res p { display: flex; align-items: center; gap: 7px; margin: 4px 12px 6px; padding: 9px 12px; border-radius: 12px; font-size: 12.5px; font-weight: 600; color: var(--pos); background: rgba(48, 209, 88, .14); }
  .res p.bad { color: var(--neg); background: rgba(255, 69, 58, .12); }
  .cw { position: relative; }
  .cw + .cw::before { content: ""; position: absolute; top: 0; left: 70px; right: 0; height: .5px; background: var(--line); }
  .r { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 10px 14px; text-align: left; transition: background .15s; }
  .r:active { background: var(--fill); }
  .cd { position: relative; flex: none; width: 44px; height: 29px; border-radius: 6px; overflow: hidden; background: linear-gradient(135deg, #3A3A3D, #050505 70%); box-shadow: inset 0 0 0 .5px rgba(240, 200, 110, .55); }
  .cd.white { background: linear-gradient(135deg, #fff, #CFCAC0); }
  .cd::before { content: ""; position: absolute; left: 6px; top: 9px; width: 9px; height: 7px; border-radius: 2px; background: linear-gradient(#F6E3A1, #B8892B); }
  .cd::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255, 235, 180, .5) 50%, transparent 65%); transform: translateX(-120%); animation: sw 3.6s ease-in-out infinite; }
  @keyframes sw { 40%, 100% { transform: translateX(120%); } }
  .m { flex: 1; min-width: 0; }
  .m b { display: block; font-weight: 500; font-size: 15px; overflow-wrap: anywhere; }
  .m small { display: block; color: var(--muted); font-size: 12px; }
  .bal { font-weight: 600; font-size: 15px; white-space: nowrap; }
  .bal.neg { color: var(--neg); }
  .ch { display: grid; color: var(--muted); opacity: .6; transition: transform .35s; }
  .ch.up { transform: rotate(180deg); }
  .x { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.32, .72, 0, 1); }
  .x.o { grid-template-rows: 1fr; }
  .x > div { overflow: hidden; min-height: 0; }
  .act { padding: 0 14px 12px 70px; }
  .ln { display: flex; justify-content: space-between; gap: 8px; margin: 0 0 5px; font-size: 12.5px; color: var(--muted); }
  .ln b { color: var(--text); font-weight: 500; white-space: nowrap; }
  .btn { display: block; width: 100%; min-height: 44px; margin-top: 8px; border-radius: 22px; font-size: 13.5px; font-weight: 600; color: var(--gold); background: var(--fill); }
  .btn:disabled { opacity: .6; }
  .msg { margin: 28px 0; text-align: center; font-size: 14px; color: var(--muted); }
  .msg.bad { margin: 0 8px 10px; color: var(--neg); }
  .again { display: block; margin: 0 auto; min-height: 44px; padding: 0 20px; color: var(--gold); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .dot, .cd::after { animation: none; } .res, .x, .ch { transition: none; } }
</style>
