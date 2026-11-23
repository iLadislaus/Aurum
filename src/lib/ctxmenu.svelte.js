// Контекстное меню по долгому нажатию: строка приподнимается, фон размывается, меню выпрыгивает рядом
export const ctx = $state({ open: false, items: [], html: '', top: 0, left: 0, width: 0, height: 0, mtop: 0, mbottom: 0, up: false });

const ROW = 46;

export function openCtx(el, items) {
  const r = el.getBoundingClientRect();
  const h = items.length * ROW;
  const vh = window.innerHeight;
  const up = r.bottom + 10 + h > vh - 96;
  Object.assign(ctx, {
    items, html: el.outerHTML, top: r.top, left: r.left, width: r.width, height: r.height,
    up, mtop: r.bottom + 10, mbottom: vh - r.top + 10
  });
  ctx.open = true;
}

export const closeCtx = () => { ctx.open = false; };
