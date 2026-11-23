<script>
  import Screen from '../lib/Screen.svelte';
  import Skeleton from '../lib/Skeleton.svelte';
</script>

<Screen title="Ещё">
  <Skeleton count={8} />
  <p class="ver">Aurum · версия {__APP_VERSION__}</p>
</Screen>

<style>
  .ver { margin: 18px 0 0; text-align: center; font-size: 12px; color: var(--muted); }
</style>
