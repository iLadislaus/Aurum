<script>
  import FloatWin from './FloatWin.svelte';
  import Horizon from '../home/Horizon.svelte';
  import { peek } from './cache.svelte.js';
  import { hz, closeHorizon } from './horizon.svelte.js';
  let d = $derived(peek('home'));
</script>

<FloatWin open={hz.open} onclose={closeHorizon} title="На горизонте" top={hz.top} z={56}>
  {#if d}<Horizon items={d.horizon} shown={hz.open} />{/if}
</FloatWin>
