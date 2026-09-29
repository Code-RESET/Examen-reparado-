/* Delegación de eventos: en el HTML los botones llevan data-action="nombre"
   (y datos extra como data-id="3"). Cada módulo registra aquí sus acciones y un único
   listener de clic las despacha. Así el HTML no depende de funciones globales. */

const actions = {};

export function registerActions(map) {
  for (const name of Object.keys(map)) {
    if (actions[name]) throw new Error(`Acción duplicada: ${name}`);
    actions[name] = map[name];
  }
}

export function installActionListener(root = document) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el.dataset, el, e);
  });
}
