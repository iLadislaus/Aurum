<script>
  // Новое правило из окна «Правила». Если правило с таким названием уже есть, у него меняется категория
  import { untrack } from 'svelte';
  import { rl, closeNewRule } from './rules.svelte.js';
  import { rememberRule, loadRules } from './data.js';
  import { refresh, peek } from './cache.svelte.js';
  import FloatWin from './FloatWin.svelte';
  import OpAvatar from './OpAvatar.svelte';

  const KINDS = [['EXPENSE', 'Расход'], ['INCOME', 'Доход'], ['RETURN', 'Возврат']];

  let kind = $state('EXPENSE'), name = $state(''), cat = $state(null), busy = $state(false), err = $state('');
  const cats = $derived((peek('cats')?.list ?? []).filter((c) => (kind === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE')));

  $effect(() => {
    if (!rl.add) return;
    untrack(() => { kind = rl.kind; name = ''; cat = null; busy = false; err = ''; });
  });

  async function save() {
    if (busy) return;
    if (!name.trim()) { err = 'Введите название'; return; }
    if (!cat) { err = 'Выберите категорию'; return; }
    busy = true; err = '';
    try {
      await rememberRule(kind, name, cat);
      await refresh('rules', loadRules, true);
      closeNewRule();
    } catch (e) { err = e.message || 'Не удалось сохранить'; }
    busy = false;
  }
</script>

<FloatWin open={rl.add} onclose={closeNewRule} title="Новое правило" top={150} z={57}>
  <div class="bd">
    <div class="seg">{#each KINDS as [k, t] (k)}<button class:on={kind === k} onclick={() => { kind = k; cat = null; }}>{t}</button>{/each}</div>
    <div class="grp"><label class="r"><span>Название</span><input placeholder="Как в операции" bind:value={name} oninput={() => (err = '')} /></label></div>
    <div class="lb">Категория</div>
    <div class="strip">
      {#each cats as c (c.id)}
        <button class:on={cat === c.id} onclick={() => { cat = c.id; err = ''; }}><OpAvatar icon={c.icon} size={24} /><span>{c.name}</span></button>
      {/each}
    </div>
    {#if err}<p class="er">{err}</p>{/if}
    <button class="go" disabled={busy} onclick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
  </div>
</FloatWin>

<style>
  .bd { padding: 0 6px 6px; }
  .grp { background: var(--card); border-radius: 16px; box-shadow: var(--shadow); padding: 0 14px; }
  .r { display: flex; align-items: center; gap: 10px; min-height: 46px; font-size: 15px; }
  .r span { color: var(--muted); flex: none; }
  .r input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--text); font: inherit; font-size: 16px; font-weight: 600; text-align: right; }
  .lb { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 12px 4px 6px; }
  .strip { display: flex; flex-wrap: wrap; gap: 8px; padding: 2px; }
  .strip button { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 5px 12px 5px 8px; border-radius: 99px; background: var(--fill); color: var(--text); font-size: 13px; }
  .strip button.on { box-shadow: inset 0 0 0 1px #C9A24A; background: var(--gold-soft); }
  .seg { display: flex; background: var(--fill); border-radius: 10px; padding: 2px; margin: 0 0 10px; }
  .seg button { flex: 1; min-height: 40px; border-radius: 8px; font-size: 14px; font-weight: 600; color: var(--muted); transition: background .2s, color .2s; }
  .seg .on { background: var(--seg-on); color: var(--text); box-shadow: 0 1px 3px rgba(0, 0, 0, .15); }
  .er { margin: 10px 4px 0; font-size: 13px; color: var(--neg); }
  .go { display: block; width: 100%; margin: 14px 0 6px; height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); box-shadow: 0 6px 16px -6px rgba(226, 172, 62, .6); }
  .go:disabled { opacity: .6; }
</style>
