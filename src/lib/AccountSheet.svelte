<script>
  import { acct, closeAcct } from './acctsheet.svelte.js';
  import { peek, refresh, put } from './cache.svelte.js';
  import { loadAccountOps } from './data.js';
  import { cash } from './format.js';
  import { openOp } from './opcard.svelte.js';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import OpAvatar from './OpAvatar.svelte';

  let q = $state('');
  let data = $derived(acct.id ? peek('ops.' + acct.id) : null);
  let err = $state('');
  let k = $state(0), kn = 0;

  // при открытии: сохранённое видно сразу, свежее подтягивается в фоне
  $effect(() => {
    if (!acct.open || !acct.id) return;
    q = ''; err = ''; k = ++kn;
    const id = acct.id;
    refresh('ops.' + id, () => loadAccountOps(id)).catch((e) => { if (!peek('ops.' + id)) err = e.message || 'Не удалось загрузить операции'; });
  });

  // форматтеры создаём один раз: toLocaleDateString с часовым поясом на каждую операцию заметно тормозит
  const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' });
  const titleFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  const dayKey = (iso) => dayFmt.format(new Date(iso));
  function dayTitle(key) {
    const today = dayKey(new Date().toISOString());
    const diff = Math.round((new Date(today) - new Date(key)) / 86400000);
    if (diff <= 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    return titleFmt.format(new Date(key + 'T12:00:00'));
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
  // свежий остаток из списка счетов: после изменения операции он меняется прямо в открытом окне
  let balance = $derived.by(() => {
    const d = peek('accounts');
    const all = d ? [...d.cards, ...d.cashes, ...d.envs, ...d.debts, ...d.foreign.flatMap((f) => f.list)] : [];
    return all.find((a) => a.id === acct.id)?.balance ?? acct.balance;
  });
  let avail = $derived(balance + acct.limit);
  let used = $derived(acct.limit > 0 ? Math.min(1, Math.max(0, -balance / acct.limit)) : 0);
  function show(o) {
    if (!o.op) return; // сохранённый список старого вида: через мгновение придёт свежий
    put('ops.one', { ops: [o.op] });
    openOp(o.op, 'ops.one');
  }
  const c = (v) => cash(v, 2, acct.currency);
</script>

<Sheet open={acct.open} onclose={closeAcct} title={acct.name} sub={acct.kind} z={55} snap={0.3}>
      {#key k}
      <div class="hero">
        <small>Остаток</small>
        <div class="big" class:neg={balance < 0}>{c(balance)}</div>
        {#if acct.limit > 0}
          <div class="bar"><i style:width="{Math.max(1.5, used * 100)}%"></i></div>
          <div class="cols">
            <div><span>Кредитный лимит</span><b>{cash(acct.limit, 0, acct.currency)}</b></div>
            <div><span>Доступно</span><b>{c(avail)}</b></div>
          </div>
        {/if}
      </div>

      {#if data}
        <div class="mo rise" style="--i:1">
          <div><span>Пришло за месяц</span><b class="pos">{data.inc > 0 ? '+' : ''}{cash(data.inc, 0, acct.currency)}</b></div>
          <div><span>Ушло за месяц</span><b>{cash(data.out, 0, acct.currency)}</b></div>
        </div>
        <label class="srch rise" style="--i:2"><Icon name="search" size={16} /><input type="search" placeholder="Поиск по операциям" bind:value={q} /></label>
        {#each groups as g, gi (g.key)}
          <div class="dh rise" style="--i:{Math.min(3 + gi * 2, 11)}"><span>{g.title}</span><span>{g.sum > 0 ? '+' : ''}{cash(g.sum, 0, acct.currency)}</span></div>
          <div class="cd rise" style="--i:{Math.min(4 + gi * 2, 12)}">
            {#each g.ops as o (o.id)}
              <div class="r" role="button" tabindex="0" onclick={() => show(o)} onkeydown={(e) => e.key === 'Enter' && show(o)}>
                <OpAvatar icon={o.icon} size={34} name={o.splits ? '' : o.name} />
                <div class="m"><div class="n">{o.name}</div><div class="s">{o.cat}</div></div>
                <span class="ar"><b class:pos={o.amount > 0}>{o.amount > 0 ? '+' : ''}{c(o.amount)}</b>{#if o.net != null}<small class="nt">итого {c(o.net)}</small>{/if}</span>
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
      {/key}
</Sheet>

<style>
  .hero { position: relative; border-radius: 22px; padding: 14px 16px; color: #F4EEDD; background: radial-gradient(120% 90% at 85% 0, #2A200C, #120F08 50%, #080807); box-shadow: 0 0 0 .5px rgba(232, 194, 119, .35), 0 14px 30px -18px rgba(232, 194, 119, .45); }
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
  .r:active { background: var(--fill); }
  .r + .r::before { content: ""; position: absolute; top: 0; left: 60px; right: 0; height: .5px; background: var(--line); }
  .m { flex: 1; min-width: 0; }
  .n { font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { font-size: 12px; color: var(--muted); line-height: 16px; }
  .r b { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .rise { animation: rise .35s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(.14s + var(--i, 0) * 45ms); }
  @keyframes pop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
  @keyframes sweep { from { left: -70%; } to { left: 130%; } }
  .hero { overflow: hidden; animation: pop .6s cubic-bezier(.2, .9, .3, 1.1) .1s both; }
  .hero::after { content: ""; position: absolute; top: 0; bottom: 0; width: 60%; left: -70%; pointer-events: none; transform: skewX(-18deg); background: linear-gradient(100deg, transparent, rgba(255, 236, 170, .22), transparent); animation: sweep .9s cubic-bezier(.4, 0, .2, 1) .45s both; }
  .empty { margin: 24px 0; text-align: center; color: var(--muted); font-size: 14px; }
  @media (prefers-reduced-motion: reduce) { .rise, .hero, .hero::after { animation: none; } }
  .ar { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .nt { font-size: 12px; font-weight: 600; color: var(--gold); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
