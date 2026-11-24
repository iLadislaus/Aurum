<script>
  import Sheet from './Sheet.svelte';
  import Horizon from '../home/Horizon.svelte';
  import { peek } from './cache.svelte.js';
  import { hz, closeHorizon } from './horizon.svelte.js';
  let d = $derived(peek('home'));
</script>

<Sheet open={hz.open} onclose={closeHorizon} fit title="На горизонте">
  <div class="hzs">{#if d}<Horizon items={d.horizon} shown={hz.open} />{/if}</div>
</Sheet>

<style>
  .hzs { padding: 0 0 8px; }
</style>
