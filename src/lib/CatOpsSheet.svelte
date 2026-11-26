<script>
  import Sheet from './Sheet.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import { co, closeCatOps } from './budget.svelte.js';
  import { opsLoader } from './data.js';
  import { peek, refresh } from './cache.svelte.js';
  import { openOp } from './opcard.svelte.js';
  import { fmt, cash } from './format.js';

  const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  let full = $state(false), data = $state(null), err = $state('');
  // оставляем последнюю открытую категорию, пока окно закрывается
  let last = $state(null);
  $effect(() => { if (co.cat) last = co.cat; });
  const c = $derived(co.cat ?? last);
  const key = $derived(c ? `ops.m.${Math.floor(c.ym / 12)}-${c.ym % 12}` : '');

  $effect(() => { if (co.cat) { const t = setTimeout(() => (full = true), 0); return () => clearTimeout(t); } });
  $effect(() => {
    if (!co.cat) return;
    const k = key; err = ''; data = peek(k);
    refresh(k, opsLoader(k)).then((d) => { if (key === k) data = d; }).catch((e) => { if (!data) err = e.message || 'Не удалось загрузить операции'; });
  });

  const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' });
  const titleFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  const dayKey = (iso) => dayFmt.format(new Date(iso));
  function dayTitle(k) {
    const diff = Math.round((new Date(dayKey(new Date().toISOString())) - new Date(k)) / 86400000);
    return diff <= 0 ? 'Сегодня' : diff === 1 ? 'Вчера' : titleFmt.format(new Date(k + 'T12:00:00'));
  }
  const list = $derived((data?.ops ?? []).filter((o) => c && o.category_id === c.id));
  const groups = $derived((() => {
    const out = [];
    for (const o of list) {
      const k = dayKey(o.date); let g = out.at(-1);
      if (!g || g.k !== k) out.push((g = { k, title: dayTitle(k), sum: 0, items: [] }));
      g.items.push(o); g.sum += o.v;
    }
    return out;
  })());
  const total = $derived(-list.reduce((s, o) => s + o.v, 0));
  const amt = (o) => (o.v > 0 ? '+' : '−') + fmt(Math.abs(o.v), Math.abs(o.amount) % 1 ? 2 : 0) + ' ' + o.sym;
</script>

<Sheet open={!!co.cat} ceil={66} onclose={closeCatOps} title={c?.name ?? ''} sub={c ? `${MON[c.ym % 12]} ${Math.floor(c.ym / 12)} · потрачено ${fmt(Math.max(0, total))} ₴ · ${list.length} оп.` : ''} z={55} bind:full>
  <div class="bd">
    {#each groups as g (g.k)}
      <div class="dh"><span>{g.title}</span><b>{g.sum ? (g.sum > 0 ? '+' : '−') + cash(Math.abs(g.sum), 0) : ''}</b></div>
      <div class="cd">
        {#each g.items as o, i (o.id)}
          <div class="op" class:top={i > 0} role="button" tabindex="0" onclick={() => openOp(o, key)} onkeydown={(e) => e.key === 'Enter' && openOp(o, key)}>
            <OpAvatar icon={o.icon} size={38} name={o.splits ? '' : o.name} />
            <div class="nm"><b>{o.name}</b><small>{o.acc || o.cat}</small></div>
            <span class="ar"><span class="am" class:pos={o.v > 0}>{amt(o)}</span>{#if o.net != null}<small class="nt">итого {fmt(o.net, o.net % 1 ? 2 : 0)} {o.sym}</small>{/if}</span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="msg">{err || (data ? 'В этом месяце операций по категории нет' : 'Загружаю…')}</p>
    {/each}
  </div>
</Sheet>

<style>
  .bd { padding: 0 6px 24px; min-height: 50vh; margin-top: -8px; }
  .bd > .dh:first-child { margin-top: 2px; }
  .dh { display: flex; justify-content: space-between; margin: 14px 8px 6px; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; font-variant-numeric: tabular-nums; }
  .dh b { text-transform: none; letter-spacing: 0; }
  .cd { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .op { position: relative; display: flex; align-items: center; gap: 11px; padding: 10px 14px; min-height: 56px; cursor: pointer; }
  .op:active { background: var(--fill); }
  .op.top::before { content: ""; position: absolute; top: 0; left: 63px; right: 0; height: .5px; background: var(--line); }
  .nm { flex: 1; min-width: 0; } .nm b { display: block; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm small { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .am { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; } .pos { color: var(--pos); }
  .ar { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
  .nt { font-size: 12px; font-weight: 600; color: var(--gold); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .msg { text-align: center; color: var(--muted); padding: 40px 0; }
</style>
