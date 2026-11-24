<script>
  import { np, closeNewPay } from './newpay.svelte.js';
  import { addPlanned, loadHome, loadCategories } from './data.js';
  import { refresh, peek } from './cache.svelte.js';
  import { onMount } from 'svelte';
  import Sheet from './Sheet.svelte';
  import OpAvatar from './OpAvatar.svelte';

  const PER = [{ k: 'week', t: 'Неделя' }, { k: 'month', t: 'Месяц' }, { k: 'year', t: 'Год' }];
  const iso = (d) => d.toLocaleDateString('sv-SE');
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return iso(d); };

  let name = $state(''), amount = $state(''), cat = $state(null), period = $state('month'), date = $state(nextMonth());
  let busy = $state(false), err = $state('');
  let cats = $state(peek('cats')?.list ?? []);
  onMount(async () => { try { cats = (await refresh('cats', loadCategories)).list; } catch { /* оставим что есть */ } });
  let list = $derived((() => { const ex = cats.filter((c) => /exp|расх/i.test(c.type || '')); return ex.length ? ex : cats; })());

  $effect(() => { if (np.open) { name = ''; amount = ''; cat = null; period = 'month'; date = nextMonth(); busy = false; err = ''; } });

  const num = $derived(Number(String(amount).replace(/\s/g, '').replace(',', '.')) || 0);

  async function save() {
    if (busy) return;
    if (!name.trim()) { err = 'Введите название'; return; }
    if (!num) { err = 'Введите сумму'; return; }
    busy = true; err = '';
    try {
      await addPlanned({ name: name.trim(), amount: num, categoryId: cat, period, nextDate: date });
      await refresh('home', loadHome);
      closeNewPay();
    } catch (e) { err = e.message || 'Не удалось сохранить'; busy = false; }
  }
</script>

<Sheet open={np.open} onclose={closeNewPay} title="Новый платёж" z={57} fit>
  <div class="bd">
    <div class="grp">
      <label class="r"><span>Название</span><input placeholder="Например, Netflix" maxlength="40" bind:value={name} oninput={() => (err = '')} /></label>
      <label class="r"><span>Сумма</span><input class="n" inputmode="decimal" placeholder="0" bind:value={amount} oninput={() => (err = '')} /><em>₴</em></label>
    </div>
    <div class="lb">Категория</div>
    <div class="strip">
      {#each list as c (c.id)}
        <button class:on={cat === c.id} onclick={() => (cat = cat === c.id ? null : c.id)}><OpAvatar icon={c.icon} size={24} /><span>{c.name}</span></button>
      {/each}
    </div>
    <div class="seg">{#each PER as p (p.k)}<button class:on={period === p.k} onclick={() => (period = p.k)}>{p.t}</button>{/each}</div>
    <div class="grp"><label class="r"><span>Следующий платёж</span><input class="d" type="date" bind:value={date} /></label></div>
    {#if err}<p class="er">{err}</p>{/if}
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
  </div>
</Sheet>

<style>
  .bd { padding: 0 6px 6px; }
  .grp { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); padding: 0 14px; }
  .r { display: flex; align-items: center; gap: 10px; min-height: 46px; font-size: 15px; }
  .r + .r { border-top: .5px solid var(--line); }
  .r span { color: var(--muted); flex: none; }
  .r input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; font-weight: 600; text-align: right; -webkit-user-select: text; user-select: text; }
  .r input.n { font-variant-numeric: tabular-nums; }
  .r input.d { color-scheme: light dark; }
  .r em { font-style: normal; color: var(--muted); }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 12px 4px 6px; }
  .strip { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 4px; scrollbar-width: none; }
  .strip::-webkit-scrollbar { display: none; }
  .strip button { flex: none; display: flex; align-items: center; gap: 6px; padding: 5px 12px 5px 5px; border-radius: 99px; background: var(--fill); color: var(--text); font-size: 13px; }
  .strip button.on { box-shadow: inset 0 0 0 1px #C9A24A; background: var(--gold-soft); }
  .seg { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; margin: 10px 0; }
  .seg button { flex: 1; min-height: 32px; border-radius: 8px; font-size: 14px; font-weight: 600; color: var(--muted); transition: background .2s, color .2s; }
  .seg .on { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 3px rgba(0, 0, 0, .15); }
  .er { margin: 10px 4px 0; font-size: 13px; color: var(--neg); }
  .go { display: block; width: 100%; margin: 14px 0 6px; height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); box-shadow: 0 6px 16px -6px rgba(226, 172, 62, .6); }
  .go:disabled { opacity: .6; }
</style>
