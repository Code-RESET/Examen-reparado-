# RSTI Study

App de estudio (PWA, funciona sin conexión) con dos **rutas** independientes:

- **📋 Examen RSTI**: 322 preguntas en 10 módulos + el "Examen a Aplicar" (63 preguntas oficiales).
- **💻 Ruta Dev**: 40 preguntas en 4 áreas (JavaScript, Firebase Seguridad, Git, Backend).

Cada ruta tiene quiz, flashcards (Leitner), puntos débiles, simulacro cronometrado, Feynman con tutor IA,
búsqueda y estadísticas. El progreso de cada ruta se guarda por separado.

Sin frameworks, sin build y sin librerías: HTML + CSS + módulos ES nativos. Se publica tal cual en GitHub Pages.

## Probar en tu computadora

Los módulos ES no cargan si abres `index.html` con doble clic (`file://`); hace falta un servidor local:

```bash
python3 -m http.server 8000     # o: npm run serve
# abre http://localhost:8000
```

## Estructura

```
index.html            Estructura de todas las páginas (sin lógica)
css/styles.css        Estilos
data/rsti.js          Banco RSTI (QUESTIONS, EXAM_APLICAR, MODULES) — no editar a mano sin validar
data/dev.js           Banco Ruta Dev (DEV_QUESTIONS, DEV_MODULES)
js/main.js            Punto de entrada: carga las vistas y arranca el router
js/study-routes.js    Rutas de estudio: qué banco, qué llave de guardado y qué opciones usa cada una
js/router.js          Páginas por URL (#/inicio, #/quiz, #/modulo/3/teoria, …) y botón Atrás
js/actions.js         Delegación de clics: data-action="nombre" → función
js/state.js           Progreso guardado (localStorage) y sistema Leitner
js/bank.js            Consultas: dominadas, pendientes, puntos débiles, datos duros
js/progress.js        XP, niveles, racha, insignias, barra superior
js/ui.js              Avisos, celebraciones y paginación
js/ai.js              Tutor IA (Google Gemini)
js/pwa.js             Service worker y botón Instalar
js/storage.js         localStorage seguro (no truena en modo privado)
js/util.js            Utilidades puras
js/views/*.js         Una vista por archivo: home, search, module, flashcards, quiz, exam, aplicar, stats
sw.js                 Service worker (caché sin conexión)
scripts/check-data.js Valida los bancos y que sw.js tenga todos los archivos
scripts/smoke-test.js Pruebas de punta a punta en Chromium (vista de celular)
```

### Páginas (URLs)

| URL | Página |
| --- | --- |
| `#/inicio` | Inicio y selector de ruta |
| `#/buscar` | Buscador (resultados paginados) |
| `#/modulo/<id>/<teoria\|flash\|quiz\|feynman>` | Módulo / área |
| `#/flashcards` · `#/quiz` | Sesión de flashcards / quiz |
| `#/examen` · `#/examen/curso` · `#/examen/resultados` | Simulacro |
| `#/aplicar` · `#/aplicar/curso` · `#/aplicar/resultados` | Examen a Aplicar (solo RSTI) |
| `#/progreso` | Estadísticas e insignias |

### Llaves de localStorage

| Llave | Contenido |
| --- | --- |
| `rstiStudyState_v1` | Progreso de la ruta RSTI (la llave de siempre, sin cambios) |
| `rstiStudyState_dev_v1` | Progreso de la Ruta Dev |
| `studyRoute` | Última ruta elegida (`rsti` o `dev`) |
| `rsti_gemini_key` | Clave de Gemini del tutor IA |

## Tareas comunes

- **Agregar preguntas a la Ruta Dev**: añade una línea `q('dev-js-11', 'js', '¿…?', [A, B, C, D], 'B')` en `data/dev.js`.
- **Agregar un área**: agrégala a `DEV_MODULES` (con su teoría) y su insignia en `moduleBadges` de `js/study-routes.js`.
- **Agregar una ruta nueva**: crea `data/<ruta>.js` y un objeto más en `ROUTES` (`js/study-routes.js`), con su propia `storageKey`.
- **Agregar un archivo JS/CSS**: súmalo a `PRECACHE_URLS` en `sw.js` y sube `CACHE_NAME` (el validador te avisa si falta).

## Validar antes de publicar

```bash
node scripts/check-data.js     # bancos consistentes y sw.js al día
npm install && npm test        # validación + pruebas en navegador (Playwright)
```
