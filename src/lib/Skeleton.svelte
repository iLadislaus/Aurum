<script>
  // Временные строки-заглушки: пока экраны пустые, под стеклом панели есть что разглядывать
  let { count = 8 } = $props();
</script>

{#each Array(count) as _, i}
  <div class="row rise" style:--i={i + 1}><i></i><u></u></div>
{/each}

<style>
  .row { height: 52px; background: var(--card); border-radius: 12px; margin-top: 10px; display: flex; align-items: center; gap: 12px; padding: 0 14px; }
  i { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(160deg, #EBC77A, #B8862C); flex: none; }
  u { flex: 1; height: 8px; border-radius: 4px; background: var(--muted); opacity: .25; }
</style>
