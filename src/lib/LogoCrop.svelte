<script>
  // Подгонка своей картинки в круг: тянуть пальцем и менять размер ползунком. На выходе маленький JPEG
  let { src, ondone, onback } = $props();
  const BOX = 210, OUT = 192;
  let w = $state(0), h = $state(0), zoom = $state(1), x = $state(0), y = $state(0), img = $state(), bad = $state(false);
  let last = null;
  const scale = $derived(w && h ? (BOX / Math.min(w, h)) * zoom : 1);
  // картинка всегда закрывает весь круг
  const lim = (v, side) => { const m = Math.max(0, (side * scale - BOX) / 2); return Math.max(-m, Math.min(m, v)); };
  const cx = $derived(lim(x, w)), cy = $derived(lim(y, h));

  const down = (e) => { last = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  function move(e) {
    if (!last) return;
    x = cx + e.clientX - last.x; y = cy + e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
  }
  const up = () => (last = null);

  function done() {
    const c = document.createElement('canvas');
    c.width = c.height = OUT;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, OUT, OUT); // прозрачные места белые
    const k = OUT / BOX;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (BOX / 2 + cx - (w * scale) / 2) * k, (BOX / 2 + cy - (h * scale) / 2) * k, w * scale * k, h * scale * k);
    ondone(c.toDataURL('image/jpeg', 0.85));
  }
</script>

<div class="crop" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
  <img bind:this={img} {src} alt="" draggable="false" onload={() => { w = img.naturalWidth; h = img.naturalHeight; zoom = 1; x = y = 0; }} onerror={() => (bad = true)}
    style:width="{w * scale}px" style:height="{h * scale}px" style:transform="translate(calc(-50% + {cx}px), calc(-50% + {cy}px))" />
</div>
{#if bad}<p class="er">Эту картинку открыть не получилось</p>{/if}
<input type="range" min="1" max="4" step="0.01" bind:value={zoom} aria-label="Размер" />
<button class="go" disabled={!w} onclick={done}>Загрузить</button>
<button class="back" onclick={onback}>Назад</button>

<style>
  .crop { position: relative; width: 210px; height: 210px; margin: 4px auto 6px; border-radius: 50%; overflow: hidden; touch-action: none; background: #fff; box-shadow: 0 0 0 2px var(--gold); }
  .crop img { position: absolute; left: 50%; top: 50%; max-width: none; pointer-events: none; }
  input { display: block; width: 80%; height: 44px; margin: 0 auto; accent-color: #D9B24C; }
  .er { margin: 4px; text-align: center; font-size: 13px; color: var(--neg); }
  .go, .back { display: block; width: 100%; min-height: 46px; border-radius: 23px; font-size: 16px; font-weight: 600; }
  .go { margin-top: 6px; color: #2A1D05; background: linear-gradient(#EBC77A, #C99A3C); }
  .go:disabled { opacity: .5; }
  .back { margin-top: 6px; min-height: 44px; font-size: 14px; color: var(--gold); background: var(--fill); }
</style>
