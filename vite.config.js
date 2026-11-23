import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' — относительные пути: работает и на iladislaus.github.io/Aurum/, и локально
export default defineConfig({
  base: './',
  plugins: [svelte()]
});
