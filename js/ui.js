/* Piezas de interfaz compartidas: aviso (toast), celebración y paginación. */
import { $ } from './util.js';
import { registerActions } from './actions.js';

let toastTimer = null;
export function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* Celebraciones en cola: si subes de nivel y ganas una insignia a la vez, se muestran una tras otra
   (antes la segunda tapaba a la primera). */
const celebrations = [];
export function showCelebrate(emoji, title, desc) {
  celebrations.push({ emoji, title, desc });
  if (celebrations.length === 1) showNextCelebration();
}
function showNextCelebration() {
  const c = celebrations[0];
  if (!c) { $('celebrateOverlay').classList.remove('show'); return; }
  $('ccEmoji').textContent = c.emoji;
  $('ccTitle').textContent = c.title;
  $('ccDesc').textContent = c.desc;
  $('celebrateOverlay').classList.add('show');
}

/* ---------- Paginación ----------
   paginate('resWrongList', items, renderItem) pinta la página 1 y unos botones
   Anterior / Siguiente. Cada contenedor recuerda su lista y su página actual. */
const PAGE_SIZE = 10;
const pagers = new Map();

export function paginate(containerId, items, renderItem, emptyHtml = '') {
  pagers.set(containerId, { items, renderItem, emptyHtml, page: 0 });
  renderPage(containerId);
}

function renderPage(containerId) {
  const p = pagers.get(containerId);
  const el = $(containerId);
  if (!p || !el) return;
  if (!p.items.length) { el.innerHTML = p.emptyHtml; return; }
  const pages = Math.ceil(p.items.length / PAGE_SIZE);
  p.page = Math.min(Math.max(p.page, 0), pages - 1);
  const start = p.page * PAGE_SIZE;
  const body = p.items.slice(start, start + PAGE_SIZE).map((it, i) => p.renderItem(it, start + i)).join('');
  const controls = pages < 2 ? '' : `
    <div class="pager">
      <button class="btn btn-outline" data-action="page" data-target="${containerId}" data-dir="-1" ${p.page === 0 ? 'disabled' : ''}>← Anterior</button>
      <span class="pg-info">Página ${p.page + 1}/${pages} · ${p.items.length} en total</span>
      <button class="btn btn-outline" data-action="page" data-target="${containerId}" data-dir="1" ${p.page === pages - 1 ? 'disabled' : ''}>Siguiente →</button>
    </div>`;
  el.innerHTML = body + controls;
}

registerActions({
  closeCelebrate: () => { celebrations.shift(); showNextCelebration(); },
  page: ({ target, dir }) => {
    const p = pagers.get(target);
    if (!p) return;
    p.page += Number(dir);
    renderPage(target);
    $(target).scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
});
