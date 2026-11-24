<script>
  import Screen from '../lib/Screen.svelte';
  import Skeleton from '../lib/Skeleton.svelte';
  import { openCats } from '../lib/budget.svelte.js';
</script>

<Screen title="Бюджет">
  <button class="cb" onclick={openCats}>Категории</button>
  <Skeleton count={10} />
</Screen>

<style>
  .cb { height: 40px; padding: 0 18px; margin-bottom: 14px; border-radius: 12px; background: var(--card); color: var(--gold); font-weight: 600; box-shadow: var(--shadow); border: 0; }
</style>
