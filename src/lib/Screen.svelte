<script>
  let { title, children } = $props();
</script>

<section>
  <h1 class="large-title rise">{title}</h1>
  {@render children?.()}
</section>

<style>
  section { padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(110px + var(--safe-b)); }
  h1 { margin-bottom: 14px; }
</style>
