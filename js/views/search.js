/* Buscador en el banco de la ruta activa. Resultados paginados; tocar uno muestra la respuesta. */
import { $, escapeHtml } from '../util.js';
import { route } from '../study-routes.js';
import { registerPage } from '../router.js';
import { registerActions } from '../actions.js';
import { paginate } from '../ui.js';
import { correctOption } from '../bank.js';

function highlight(text, term) {
  const idx = text.toLowerCase().indexOf(term);
  if (idx < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) + '<mark>' + escapeHtml(text.slice(idx, idx + term.length)) + '</mark>' + escapeHtml(text.slice(idx + term.length));
}

function doSearch() {
  const term = $('searchInput').value.trim().toLowerCase();
  if (term.length < 2) { $('searchResults').innerHTML = ''; return; }
  const results = route.questions.filter((q) =>
    q.q.toLowerCase().includes(term) || q.options.some((o) => o.text.toLowerCase().includes(term)));
  paginate('searchResults', results, (q) => `
    <div class="search-item" data-action="toggleSearchItem">
      <div class="si-mod">${q.icon} ${route.id === 'rsti' ? 'M' + q.module + ' · ' : ''}${escapeHtml(q.moduleTitle)}</div>
      <div class="si-q">${highlight(q.q, term)}</div>
      <div class="si-answer">${q.correct}) ${highlight(correctOption(q).text, term)}
        <br><button class="btn btn-outline" data-action="openModule" data-id="${q.module}">Ir a la teoría →</button>
      </div>
    </div>`,
  `<div class="empty-state">Sin resultados para "${escapeHtml(term)}"</div>`);
}

$('searchInput').addEventListener('input', doSearch);

registerPage('buscar', {
  view: 'search', nav: 'search',
  enter: () => {
    $('searchSub').textContent = `en las ${route.questions.length} preguntas`;
    $('searchInput').placeholder = route.searchPlaceholder;
    doSearch(); // si cambió la ruta, los resultados se recalculan con el banco correcto
  },
});

registerActions({
  toggleSearchItem: (_, el) => el.classList.toggle('open'),
});
