<script>
  import Icon from './Icon.svelte';
  // Единый значок Aurum: золотой круг с белой линейной иконкой
  let { icon = 'tag', size = 42 } = $props();
</script>

<div class="av" style:width="{size}px" style:height="{size}px"><Icon name={icon} size={Math.round(size * 0.48)} /></div>

<style>
  .av { border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(160deg, #EBC77A, #B8862C); box-shadow: 0 1px 2px rgba(120,80,10,.25); }
</style>
