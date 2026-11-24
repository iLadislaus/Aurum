<script>
  import Icon from './Icon.svelte';
  import { logoFor } from './brands.svelte.js';
  // Единый значок Aurum: эмблема магазина, если она есть, иначе золотой круг с белой линейной иконкой
  let { icon = 'tag', size = 42, name = '' } = $props();
  let logo = $derived(logoFor(name));
  let bad = $state('');
</script>

{#if logo && bad !== logo}
  <img class="lg" src={logo} alt="" style:width="{size}px" style:height="{size}px" onerror={() => (bad = logo)} />
{:else}
  <div class="av" style:width="{size}px" style:height="{size}px"><Icon name={icon} size={Math.round(size * 0.48)} /></div>
{/if}

<style>
  .av { border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120,80,10,.25); }
  .lg { border-radius: 50%; flex: none; object-fit: cover; background: #fff; box-shadow: 0 0 0 .5px rgba(232,194,119,.35); }
</style>
