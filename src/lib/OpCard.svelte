<script>
  import { untrack } from 'svelte';
  import { oc, closeOp } from './opcard.svelte.js';
  import { peek, refresh, put } from './cache.svelte.js';
  import { loadCategories, setOpCategory, setOpType, loadSplits, saveSplits, clearSplits, rememberRule, countUncat, applyUncat, deleteOp, repeatOp, findBankPair, mergeBankPair } from './data.js';
  import { prefetchAll } from './prefetch.js';
  import { openNewOp } from './newop.svelte.js';
  import { fmt } from './format.js';
  import { cardTheme } from './format.js';
  import Icon from './Icon.svelte';
  import OpAvatar from './OpAvatar.svelte';
  import Sheet from './Sheet.svelte';
  import SwipeRow from './SwipeRow.svelte';
  import CardFace from './CardFace.svelte';

  let split = $state(false), parts = $state([]), typePick = $state(false), pick = $state(false), remember = $state(true), armed = $state(false), busy = $state(false), err = $state(''), more = $state(0), timer, sparts = $state([]), showParts = $state(false);
  let pair = $state(null), mergeOpen = $state(false);
  let cats = $derived(peek('cats')?.list ?? []);
  // всегда берём свежую версию операции из списка (после смены категории и т. п.)
  let o = $derived(oc.op ? (peek(oc.key)?.ops.find((x) => x.id === oc.op.id) ?? oc.op) : null);
  const kind = { EXPENSE: 'Расход', INCOME: 'Доход', RETURN: 'Возврат', TRANSFER: 'Перевод' };
  const tr = $derived(o?.action === 'TRANSFER');
  const amt = $derived(o ? fmt(Math.abs(tr ? o.amount : o.v), o.foreign || Math.abs(o.amount) % 1 ? 2 : 0) : '');
  const theme = $derived(o && !tr ? cardTheme(o.acc) : null);
  const ends = $derived(tr ? (o?.acc ?? '').split(' → ') : []);
  const when = $derived(o ? new Date(o.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }) : '');
  const list = $derived(cats.filter((c) => (o?.action === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE')));

  $effect(() => {
    if (!oc.open) return;
    pick = false; typePick = false; split = false; parts = []; remember = true; armed = false; err = ''; more = 0; showParts = false; sparts = [];
    refresh('cats', loadCategories).catch(() => {});
    const cur = untrack(() => o);
    untrack(() => {
      pair = null; mergeOpen = false;
      if (cur?.mono) { findBankPair(cur).then((r) => { if (oc.open && oc.op?.id === cur.id) pair = r; }).catch(() => {}); }
    });
    const act = oc.act;
    untrack(() => {
      if (o?.splits) loadSplits(o.id).then((r) => { if (oc.open) sparts = r.sort((a, b) => b.amount - a.amount); }).catch(() => {});
      if (act === 'split') setTimeout(() => { if (oc.open && o && o.action !== 'TRANSFER') openSplit(); }, 350);
    });
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
  // первая часть — основная: из неё вычитаются остальные, меньше нуля она не бывает
  const rest = $derived(parts.slice(1).reduce((t, p) => t + (Number(p.v) || 0), 0));
  // пока первую строку не трогали, она считается сама; если поправили — остаётся как ввели
  let autoFirst = $state(true), firstEdit = $state(null);
  const plain = (v) => (v ? String(+Number(v).toFixed(2)).replace('.', ',') : '');
  const parse = (t) => parseFloat(String(t).replace(/\s/g, '').replace(',', '.')) || 0;
  const eff = $derived(parts.map((p, i) => (i === 0 ? (autoFirst ? Math.max(0, +(total - rest).toFixed(2)) : Number(p.v) || 0) : Number(p.v) || 0)));
  const left = $derived(+(total - eff.reduce((t, v) => t + v, 0)).toFixed(2));
  const catOf = (id) => cats.find((c) => c.id === id);
  async function openSplit() {
    split = true; pick = false; typePick = false; autoFirst = true; firstEdit = null;
    let ex = [];
    if (o.splits) { try { ex = await loadSplits(o.id); } catch {} }
    parts = ex.length ? ex.map((x) => ({ id: x.category_id, v: x.amount, s: plain(x.amount) })) : [{ id: o.category_id ?? list[0]?.id, v: total, s: '' }, { id: null, v: 0, s: '' }];
  }
  function addPart() { parts = [...parts, { id: null, v: 0, s: '' }]; }
  function setPart(i, val) { parts[i].s = val; parts[i].v = parse(val); }
  async function doSplit() {
    busy = true; err = '';
    try {
      const ps = parts.map((p, i) => ({ category_id: p.id, amount: +eff[i].toFixed(2) }));
      await saveSplits(o.id, total, ps);
      const top = [...ps].sort((a, b) => b.amount - a.amount)[0];
      patch((x) => ({ ...x, splits: ps.length, icon: 'split', cat: ps.map((q) => catOf(q.category_id)?.name ?? '').filter(Boolean).slice(0, 2).join(' + '), category_id: top.category_id, uncat: false }));
      split = false; sparts = [...ps].sort((a, b) => b.amount - a.amount); showParts = true; prefetchAll(true);
    } catch (e) { err = e.message || 'Не удалось разделить'; }
    busy = false;
  }
  async function undoSplit() {
    busy = true;
    try { await clearSplits(o.id); const c = catOf(o.category_id); patch((x) => ({ ...x, splits: 0, icon: c?.icon ?? 'tag', cat: c?.name ?? 'Без категории' })); split = false; sparts = []; showParts = false; prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось убрать разделение'; }
    busy = false;
  }
  async function applyMore() {
    const cid = o.category_id; busy = true;
    try { await applyUncat(o.action, o.note.trim(), cid); more = 0; prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось применить'; }
    busy = false;
  }
  const pMoney = $derived(o ? fmt(Math.abs(o.amount), 2) : '');
  async function doMerge() {
    busy = true; err = '';
    try { await mergeBankPair(o, pair); mergeOpen = false; closeOp(); prefetchAll(true); }
    catch (e) { err = e.message || 'Не удалось объединить'; }
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

</script>

<Sheet open={oc.open} onclose={closeOp} fit title="Операция" z={56}>
  {#if o}
    <div class="bd" class:in={oc.open}>
      <CardFace {theme} kind={kind[o.action].toUpperCase()}>
        {#snippet amount()}<div class="big"><span class="v">{amt}</span><u>{o.sym}</u></div>{/snippet}
        {#snippet chip()}
          {#if !tr && !theme}<div class="ct">{#if o.uncat}<span class="q">?</span>{:else}<OpAvatar icon={o.icon} size={34} name={o.splits ? '' : o.name} />{/if}<span class="cn">{o.name}{#if o.splits}<small>{sparts.length > 1 ? '+ ' + sparts.slice(1).map((x) => catOf(x.category_id)?.name ?? '').filter(Boolean).join(', ') : o.cat}</small>{:else if o.cat !== o.name}<small>{o.cat}</small>{/if}</span></div>{/if}
        {/snippet}
        {#snippet acct()}
          {#if tr}
            <span class="dd ro"><small>Откуда</small><span>{ends[0] ?? '—'}</span></span>
            <span class="sw"><Icon name="swap" size={22} /></span>
            <span class="dd ro"><small>Куда</small><span>{ends[1] ?? '—'}</span></span>
          {:else}
            <span class="dd ro"><small>{o.action === 'EXPENSE' ? 'Со счёта' : 'На счёт'}</small><span>{o.acc || '—'}</span></span>
          {/if}
        {/snippet}
      </CardFace>
      {#if theme && !tr}
        <div class="mct"><div class="ct">{#if o.uncat}<span class="q">?</span>{:else}<OpAvatar icon={o.icon} size={38} name={o.splits ? '' : o.name} />{/if}<span class="cn">{o.name}{#if o.splits}<small>{sparts.length > 1 ? '+ ' + sparts.slice(1).map((x) => catOf(x.category_id)?.name ?? '').filter(Boolean).join(', ') : o.cat}</small>{:else if o.cat !== o.name}<small>{o.cat}</small>{/if}</span></div></div>
      {/if}

      <div class="grp">
        <div class="lst">
          {#if !o.mono && !tr}
            <button class="lr cat" onclick={() => { typePick = !typePick; if (typePick) pick = false; }}><span>Тип</span><b>{kind[o.action]}</b><Icon name="chevron" size={14} /></button>
          {/if}
          {#if !tr}
            <button class="lr cat" onclick={() => { if (o.splits) { showParts = !showParts; pick = false; typePick = false; } else { pick = !pick; if (pick) typePick = false; } }}>
              <span>Категория</span>
              <b class:red={o.uncat}>{o.cat}</b>
              <Icon name="chevron" size={14} />
            </button>
          {/if}
          <div class="lr"><span>Дата</span><b>{when}</b></div>
          {#if o.net != null}
            <div class="lr"><span>Списано</span><b>{fmt(o.amount, o.amount % 1 ? 2 : 0)} {o.sym}</b></div>
            <div class="lr"><span>Возврат</span><b>+{fmt(o.amount - o.net, 2)} {o.sym}</b></div>
            <div class="lr"><span>Итого</span><b class="gold">{fmt(o.net, o.net % 1 ? 2 : 0)} {o.sym}</b></div>
          {/if}
          {#if o.rate}<div class="lr"><span>Курс</span><b>{fmt(Number(o.rate), 2)}</b></div>{/if}
          {#if o.note.trim() && o.note.trim() !== o.name}<div class="lr"><span>Заметка</span><b>{o.note}</b></div>{/if}
        </div>

        {#if typePick}
          <div class="seg">
            {#each ['EXPENSE', 'INCOME', 'RETURN'] as a}<button class:on={o.action === a} onclick={() => chooseType(a)}>{kind[a]}</button>{/each}
          </div>
        {/if}

        {#if showParts && o.splits}
          <div class="pk sps">
            {#each sparts as x, i (i)}
              <div class="spr"><OpAvatar icon={catOf(x.category_id)?.icon ?? 'tag'} size={28} /><span class="n">{catOf(x.category_id)?.name ?? 'Категория'}{#if i === 0}<em>главная</em>{/if}</span><b>{fmt(x.amount, 2)} {o.sym}</b></div>
            {/each}
            <div class="spb"><button onclick={openSplit}>Изменить разделение</button><button class="un" disabled={busy} onclick={undoSplit}>Убрать</button></div>
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
      </div>

      {#if o.mono}<div class="pill"><Icon name="lock" size={14} />Из банка: меняется только категория</div>{/if}

      {#if split}
        <div class="sp">
          <div class="sbar">{#each eff as v}<i style:width="{Math.min(100, v / total * 100)}%"></i>{/each}</div>
          <div class="sleft"><span>Сумма {fmt(total, 2)} {o.sym}</span><b class:ok={left === 0}>{left === 0 ? 'Сходится' : left < 0 ? `Больше на ${fmt(-left, 2)}` : `Осталось ${fmt(left, 2)}`}</b></div>
          {#each parts as p, i (i)}
            <div class="ptw"><SwipeRow id={'sp' + i} norepeat dconfirm={false} nodelete={i === 0 || parts.length <= 2} ondelete={() => (parts = parts.filter((_, k) => k !== i))}>
            <div class="pt">
              <label class="pc"><OpAvatar icon={catOf(p.id)?.icon ?? 'tag'} size={30} /><span class:ph={!p.id}>{catOf(p.id)?.name ?? 'Категория'}</span><Icon name="chevron" size={13} />
                <select value={p.id ?? 0} onchange={(e) => { parts[i].id = Number(e.currentTarget.value) || null; }}><option value={0}>Категория</option>{#each list as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</select></label>
              {#if i === 0}<input class:au={autoFirst} inputmode="decimal" placeholder="0" value={firstEdit ?? plain(eff[0])}
                onfocus={() => (firstEdit = plain(eff[0]))}
                oninput={(e) => { firstEdit = e.currentTarget.value; parts[0].v = parse(firstEdit); autoFirst = firstEdit.trim() === ''; }}
                onblur={() => (firstEdit = null)} />
              {:else}<input inputmode="decimal" placeholder="0" value={p.s ?? ''} oninput={(e) => setPart(i, e.currentTarget.value)} onblur={() => (parts[i].s = plain(parts[i].v))} />{/if}
            </div>
            </SwipeRow></div>
          {/each}
          <button class="ad" onclick={addPart}>+ Добавить категорию</button>
          <button class="ap" disabled={busy || left !== 0 || parts.length < 2 || parts.some((p, i) => !p.id || !(eff[i] > 0))} onclick={doSplit}>Сохранить разделение</button>
        </div>
      {/if}

      {#if pair && !tr}
        {#if !mergeOpen}
          <div class="hint"><span class="hi">🔁</span><div><b>Похоже на перевод между счетами</b>{o.action === 'EXPENSE' ? '+' : '−'}{pMoney} {o.sym} на {pair.acc} в то же время</div></div>
          <button class="ap" onclick={() => (mergeOpen = true)}>Сделать переводом</button>
        {:else}
          <div class="pair">
            <div class="p"><div>{o.action === 'EXPENSE' ? o.name : pair.note}<small>{o.action === 'EXPENSE' ? pair.mine : pair.acc}</small></div><b>−{pMoney}</b></div>
            <div class="arr">↓</div>
            <div class="p"><div>{o.action === 'EXPENSE' ? pair.note : o.name}<small>{o.action === 'EXPENSE' ? pair.acc : pair.mine}</small></div><b class="gr">+{pMoney}</b></div>
          </div>
          <p class="pn">Две банковские операции станут одним переводом: в расходах и доходах он не считается.</p>
          <button class="ap" disabled={busy} onclick={doMerge}>Объединить</button>
          <button class="ap sc" onclick={() => (mergeOpen = false)}>Отмена</button>
        {/if}
      {/if}

      {#if more > 0}<button class="ap" onclick={applyMore}>Применить ещё к {more} операциям без категории</button>{/if}
      {#if err}<p class="er">{err}</p>{/if}

    </div>
  {/if}
</Sheet>

<style>
  .bd { display: flex; flex-direction: column; gap: 20px; padding: 0 12px 14px; }
  .bd.in > :global(.cf), .bd.in .grp, .bd.in .act { animation: rise .55s cubic-bezier(.2, .9, .3, 1) both; }
  .bd.in .grp { animation-delay: .1s; } .bd.in .act { animation-delay: .16s; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  .q { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--fill); color: #E5584D; font-size: 16px; font-weight: 700; flex: none; }
  .grp > * + * { margin-top: 10px; }
  .lst { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
  .lr { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 13px 16px; font-size: 15px; text-align: left; }
  .lr + .lr::before { content: ""; position: absolute; top: 0; left: 16px; right: 0; height: .5px; background: var(--line); }
  .lr span { color: var(--muted); flex: none; }
  .lr b { font-weight: 500; text-align: right; margin-left: auto; overflow-wrap: anywhere; }
  .lr b.red { color: #E5584D; }
  .hint { display: flex; gap: 10px; align-items: center; background: rgba(217, 180, 91, .12); border: 1px solid rgba(217, 180, 91, .4); border-radius: 14px; padding: 12px; font-size: 13px; color: var(--muted); } .hint b { display: block; font-size: 14px; color: var(--text, #fff); margin-bottom: 2px; } .hi { font-size: 22px; }
  .pair { background: var(--fill); border-radius: 14px; } .pair .p { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; font-size: 14px; } .pair .p small { display: block; color: var(--muted); font-size: 12px; } .pair .gr { color: #30d158; } .pair .arr { text-align: center; color: #d9b45b; padding: 0; }
  .pn { font-size: 12px; color: var(--muted); } .ap.sc { background: var(--fill); color: inherit; }
  .mct { margin: 14px 4px 2px; } .mct .ct { display: flex; align-items: center; gap: 12px; min-width: 0; } .mct .cn { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; font-size: 17px; font-weight: 600; overflow-wrap: anywhere; } .mct .cn small { font-size: 13px; font-weight: 500; color: var(--muted); margin-top: 1px; } .mct .q { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: rgba(229, 88, 77, .14); color: #E5584D; font-weight: 700; flex: none; }
  .lr b.gold { color: var(--gold); font-weight: 600; }
  .cat :global(svg) { color: var(--muted); flex: none; }
  .seg { display: flex; gap: 4px; padding: 3px; border-radius: 12px; background: var(--fill); animation: rise2 .3s cubic-bezier(.2, .8, .2, 1) both; }
  @keyframes rise2 { from { opacity: 0; transform: translateY(8px); } }
  .seg button { flex: 1; padding: 8px 0; border-radius: 9px; font-size: 13.5px; font-weight: 600; transition: background .25s, color .25s; }
  .seg button.on { background: linear-gradient(180deg, #F2D58F, #CD9A3A); color: #1a1206; }
  .pk { animation: rise2 .3s cubic-bezier(.2, .8, .2, 1) both; }
  .chips { display: flex; flex-wrap: wrap; gap: 7px; }
  .chips button { display: flex; align-items: center; gap: 6px; padding: 4px 11px 4px 4px; border-radius: 99px; background: var(--fill); font-size: 13px; font-weight: 500; }
  .chips button.on { background: var(--gold-soft); color: var(--gold); }
  .rm { position: relative; display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 9px 14px; border-radius: 14px; background: var(--card); font-size: 13.5px; }
  .rm input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; }
  .tg { flex: none; width: 51px; height: 31px; border-radius: 99px; background: rgba(120, 120, 128, .32); position: relative; transition: background .3s, box-shadow .3s; }
  .tg::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .25); transition: transform .38s cubic-bezier(.3, 1.5, .5, 1); }
  .rm input:checked + .tg { background: linear-gradient(180deg, #F2D58F, #D49E36); box-shadow: 0 0 14px -2px rgba(226, 172, 62, .55); }
  .rm input:checked + .tg::after { transform: translateX(20px); }
  .sp { animation: rise2 .3s cubic-bezier(.2, .8, .2, 1) both; }
  .sbar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--fill); }
  .sbar i { background: linear-gradient(90deg, #C99A3C, #F0D18A); border-right: 1px solid var(--bg); transition: width .4s cubic-bezier(.32, .72, 0, 1); }
  .sleft { display: flex; justify-content: space-between; margin: 7px 2px 8px; font-size: 12.5px; color: var(--muted); }
  .sleft b { font-weight: 600; color: #E5584D; transition: color .3s; } .sleft b.ok { color: var(--pos); }
  .ptw { margin-bottom: 6px; border-radius: 14px; overflow: hidden; }
  .pt { display: flex; align-items: center; gap: 9px; padding: 6px 10px; background: var(--card); }
  .pc { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; color: var(--muted); }
  .pc span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; color: var(--text); }
  .pc span.ph { color: var(--muted); font-weight: 500; }
  .pc select { position: absolute; inset: 0; width: 100%; opacity: 0; font-size: 16px; }
  .pt input.au { background: var(--gold-soft); color: var(--gold); }
  .ad { display: block; width: 100%; margin: 2px 0 0; padding: 11px 14px; border-radius: 14px; background: var(--card); color: var(--gold); font-size: 14px; font-weight: 500; text-align: left; }
  .pt input { width: 92px; padding: 7px 9px; border: 0; outline: 0; border-radius: 9px; background: var(--fill); color: var(--text); font: inherit; font-weight: 600; text-align: right; -webkit-user-select: text; user-select: text; }
  .pt button { color: var(--muted); font-size: 15px; padding: 0 2px; }
  .ap { display: block; width: 100%; margin-top: 10px; padding: 12px; border-radius: 14px; background: var(--gold-soft); color: var(--gold); font-size: 13.5px; font-weight: 600; }
  .ap:disabled { opacity: .4; }
  .sps { padding: 4px 16px 12px; }
  .spr { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 15px; }
  .spr .n { flex: 1; min-width: 0; }
  .spr em { font-style: normal; font-size: 10px; color: var(--gold); border: .5px solid var(--gold); border-radius: 6px; padding: 1px 5px; margin-left: 8px; }
  .spr b { font-weight: 500; }
  .spb { display: flex; gap: 8px; margin-top: 6px; }
  .spb button { flex: 1; padding: 11px; border-radius: 12px; font-size: 13.5px; font-weight: 600; background: var(--gold-soft); color: var(--gold); }
  .spb button.un { flex: none; padding: 11px 18px; background: var(--fill); color: var(--muted); }
  .ap.un { background: var(--fill); color: var(--muted); margin-top: -10px; }
  .er { margin: 0; text-align: center; font-size: 13px; color: #E5584D; }
  .act { display: flex; justify-content: space-between; padding: 12px 6px calc(env(safe-area-inset-bottom) + 14px); }
  .act.one { justify-content: center; }
  .act button { display: flex; flex-direction: column; align-items: center; gap: 7px; width: 76px; font-size: 12px; font-weight: 500; color: var(--text); }
  .act .c { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 50%; background: var(--card); color: var(--gold); box-shadow: inset 0 0 0 .5px rgba(214, 177, 95, .45); transition: transform .25s cubic-bezier(.3, 1.6, .5, 1), background .25s, color .25s; }
  .act button:active .c { transform: scale(.9); }
  .act button:disabled { opacity: .45; }
  .act .g .c { background: linear-gradient(180deg, #F4D48A, #D09A32); color: #1a1206; box-shadow: 0 8px 18px -8px rgba(226, 172, 62, .6); }
  .act .d .c { background: rgba(229, 72, 77, .14); color: #E5484D; box-shadow: none; }
  .act .d.armed .c { background: #E5484D; color: #fff; transform: scale(1.08); }
  .act .d.armed span { color: #E5484D; }
  .pill { display: flex; align-items: center; justify-content: center; gap: 7px; width: max-content; max-width: 100%; margin: 14px auto 12px; padding: 7px 13px; border-radius: 99px; background: rgba(214, 177, 95, .16); color: var(--gold); font-size: 12.5px; font-weight: 500; }
  @media (prefers-reduced-motion: reduce) { .bd.in > :global(.cf), .bd.in .grp, .bd.in .act, .seg, .pk, .sp { animation: none; } }
</style>
