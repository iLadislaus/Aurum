<script>
  import Screen from '../lib/Screen.svelte';
  import Skeleton from '../lib/Skeleton.svelte';
  import { openCats, openPlan, openDist } from '../lib/budget.svelte.js';
</script>

<Screen title="Бюджет">
  <div class="bt"><button class="cb" onclick={openPlan}>План</button><button class="cb" onclick={openCats}>Категории</button><button class="cb" onclick={openDist}>Разложить</button></div>
  <Skeleton count={10} />
</Screen>

<style>
  .bt { display: flex; gap: 8px; } .cb { height: 40px; padding: 0 18px; margin-bottom: 14px; border-radius: 12px; background: var(--card); color: var(--gold); font-weight: 600; box-shadow: var(--shadow); border: 0; }
</style>
