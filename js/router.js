/* Router por hash: cada "página" tiene su propia URL (#/inicio, #/quiz, #/modulo/3/teoria...).
   Beneficios: el botón Atrás del celular regresa a la página anterior en vez de cerrar la app,
   y recargar deja al usuario en la misma página.

   Cada vista se registra con registerPage('ruta', { view, nav, enter }):
     view  → id del <div class="view"> (sin el prefijo "view-")
     nav   → qué botón de la barra inferior se ilumina
     enter → función que pinta la página; recibe los segmentos extra de la URL.
             Si devuelve una ruta (string), se redirige ahí (p.ej. no hay quiz activo → 'inicio').
     leave → (opcional) se llama al salir de la página, p.ej. para detener un cronómetro. */
const pages = {};
let current = null;     // clave + parámetros de la página visible
let currentKey = null;  // solo la clave, para llamar a su leave()

export function registerPage(path, def) { pages[path] = def; }

/* Navega a una página y la pinta de inmediato. pushState agrega la entrada al historial
   (para el botón Atrás) sin esperar al evento 'hashchange', que queda para Atrás/Adelante. */
export function go(path, { replace = false } = {}) {
  const hash = '#/' + path;
  if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  render();
}

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  // Busca la ruta registrada más larga que coincida: "examen/curso" antes que "examen"
  for (let n = parts.length; n > 0; n--) {
    const key = parts.slice(0, n).join('/');
    if (pages[key]) return { key, params: parts.slice(n) };
  }
  return { key: 'inicio', params: [] };
}

function render() {
  const { key, params } = parse();
  const page = pages[key];
  if (currentKey && currentKey !== key) pages[currentKey].leave?.();
  currentKey = key;
  const redirect = page.enter?.(params);
  if (typeof redirect === 'string') { go(redirect, { replace: true }); return; }
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + page.view));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === page.nav));
  if (current !== key + params.join('/')) window.scrollTo(0, 0);
  current = key + params.join('/');
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}
