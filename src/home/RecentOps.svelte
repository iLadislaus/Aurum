<script>
  import OpAvatar from '../lib/OpAvatar.svelte';
  import { fmt, signed } from '../lib/format.js';
  let { rows, shown } = $props();
</script>

<div class="grp" class:in={shown}>
  {#each rows as t (t.id)}
    <div class="row">
      <OpAvatar icon={t.icon} />
      <div class="mid">
        <div class="t">{t.name}</div>
        <div class="s">{t.cat} · {t.when}</div>
      </div>
      <div class="r" class:pos={t.amount > 0}>{t.amount > 0 ? signed(t.amount) : '−' + fmt(Math.abs(t.amount), 2)}&nbsp;₴</div>
    </div>
  {:else}
    <div class="empty">Операций пока нет</div>
  {/each}
</div>

<style>
  .grp { background: var(--card); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; opacity: 0; transform: translateY(10px); transition: opacity .6s, transform .6s; }
  .grp.in { opacity: 1; transform: none; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 16px; position: relative; min-height: 64px; }
  .row + .row::before { content: ""; position: absolute; top: 0; left: 70px; right: 0; height: .5px; background: var(--line); }
  .mid { flex: 1; min-width: 0; }
  .t { font-size: 15px; line-height: 20px; overflow-wrap: anywhere; }
  .s { font-size: 12px; color: var(--muted); line-height: 17px; }
  .r { font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
  .r.pos { color: var(--pos); }
  .empty { padding: 18px 16px; color: var(--muted); text-align: center; }
</style>
