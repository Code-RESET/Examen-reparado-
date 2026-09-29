/* Banco de la "Ruta Dev": 40 preguntas en 4 áreas (JavaScript, Firebase Seguridad, Git, Backend).
   Es completamente independiente del banco RSTI (data/rsti.js):
   - IDs de texto con prefijo "dev-" (dev-js-01, ...), que nunca chocan con los números del RSTI.
   - Mismo formato de pregunta que el RSTI: {id, module, moduleTitle, icon, q, options:[{letter,text}], correct}.
   Para agregar una pregunta: añade una línea q(...) en su área y corre `node scripts/check-data.js`. */

export const DEV_MODULES = [
  {
    id: 'js', short: 'JS', icon: '🟨', title: 'JavaScript',
    explicacion: 'JavaScript es el lenguaje que da vida a las páginas web. Aquí repasas lo esencial para una app real: variables con <code>let</code> y <code>const</code>, comparaciones estrictas, transformar listas con <code>map</code> y <code>filter</code>, tocar la página con el DOM y, sobre todo, trabajar con operaciones que tardan (pedir datos a un servidor) usando promesas, <code>async/await</code> y <code>try/catch</code>.',
    resumen: [
      'const no permite reasignar la variable; let sí. Ninguna de las dos es global por fuerza.',
      '=== compara valor y tipo sin convertir; == convierte tipos antes de comparar (evítalo).',
      'map() devuelve un arreglo nuevo transformado; filter() devuelve uno nuevo solo con lo que cumple la condición.',
      'fetch() devuelve una promesa que resuelve en un objeto Response; response.json() lo convierte en objeto JS.',
      'localStorage guarda datos en el navegador de ese dispositivo, no en un servidor.',
    ],
    puntos_clave: [
      'await pausa solo la función async donde está, hasta que la promesa se resuelva; el navegador sigue funcionando.',
      'try/catch alrededor de await captura los errores de la operación asíncrona (red caída, respuesta inválida).',
      'document.querySelector("#id") devuelve el primer elemento que coincide con el selector.',
    ],
    errores_comunes: [
      'Creer que await congela todo el navegador: solo pausa esa función.',
      'Pensar que fetch() ya devuelve el JSON: primero llega un Response y hay que llamar a response.json().',
      'Confundir JSON.stringify (objeto → texto) con response.json() (respuesta → objeto).',
    ],
    mnemotecnia: 'MAP = Modifica cada uno y Arma un arreglo nuevo, sin Perder el original. FILTER = el FILTRO de café: solo pasa lo que cumple.',
  },
  {
    id: 'firebase', short: 'FB', icon: '🔥', title: 'Firebase Seguridad',
    explicacion: 'En Firebase la seguridad real no está en tu HTML sino en las <b>reglas de seguridad</b>, que se ejecutan en los servidores de Firebase antes de cada lectura o escritura. Cualquiera puede abrir la consola del navegador y consultar tu base, así que ocultar botones no protege nada. Las reglas deciden quién puede leer o escribir (<code>request.auth</code>) y qué datos son válidos (<code>request.resource.data</code>).',
    resumen: [
      'allow read, write: if true; = cualquiera en internet puede leer y escribir (peligroso).',
      'if request.auth != null = solo usuarios autenticados.',
      'if request.auth.uid == uid = cada usuario accede solo a su propio documento.',
      'La apiKey de Firebase identifica el proyecto; no es secreta. La protección depende de las reglas.',
      'Prueba las reglas en el Rules Playground o el Emulator, nunca directo en producción.',
    ],
    puntos_clave: [
      'request.resource.data = los datos que se INTENTAN escribir. resource.data = los datos YA guardados.',
      'Validar tipos y rangos en la regla: request.resource.data.monto is number && request.resource.data.monto > 0.',
      'Las reglas corren en los servidores de Firebase, no en el navegador ni en el celular.',
    ],
    errores_comunes: [
      'Creer que ocultar un botón o minificar el código protege los datos.',
      'Pensar que la apiKey visible es una fuga de seguridad y que da acceso de administrador.',
      'Confundir resource.data (lo guardado) con request.resource.data (lo que llega).',
    ],
    mnemotecnia: 'REQUEST = lo que la persona PIDE hacer (lo que llega). RESOURCE = lo que ya RESIDE en la base.',
  },
  {
    id: 'git', short: 'GIT', icon: '🌿', title: 'Git',
    explicacion: 'Git guarda el historial de tu proyecto como una serie de fotos (commits). El flujo básico es: modificas archivos, los preparas con <code>git add</code>, guardas la foto con <code>git commit</code> y la envías a GitHub con <code>git push</code>. Las ramas te dejan experimentar sin tocar <code>main</code>, y <code>git revert</code> deshace cambios publicados de forma segura.',
    resumen: [
      'git add = preparar cambios (staging). git commit -m = guardar la foto en el historial local.',
      'git push = enviar tus commits al remoto. git pull = traer y fusionar cambios del remoto.',
      'git status = qué está modificado o preparado. git log = historial de commits.',
      'git switch -c nombre = crear una rama nueva y cambiarte a ella.',
      '.gitignore = lista de archivos que Git no debe rastrear.',
    ],
    puntos_clave: [
      'Una rama sirve para trabajar cambios aislados sin afectar main.',
      'Para deshacer un commit ya publicado usa git revert: crea un commit nuevo que invierte el anterior.',
      'commit guarda en TU computadora; solo push lo sube al remoto.',
    ],
    errores_comunes: [
      'Creer que git commit ya sube los cambios a GitHub (falta git push).',
      'Usar git reset --hard y push --force en una rama compartida: borra trabajo de otros.',
      'Confundir git status (estado actual) con git log (historial).',
    ],
    mnemotecnia: 'A-C-P: Add (pongo en la caja), Commit (cierro la caja con etiqueta), Push (la mando por paquetería).',
  },
  {
    id: 'backend', short: 'BE', icon: '🖥️', title: 'Backend',
    explicacion: 'El backend es la parte que corre en el servidor, fuera del alcance del usuario. Ahí van la lógica sensible (validar pagos) y los secretos (claves de pasarelas), porque el código del navegador se puede modificar. Se comunica con el frontend mediante APIs REST sobre HTTP, usando métodos (GET, POST, ...) y códigos de estado (200, 401, 404, 500). Node.js permite escribir ese servidor en JavaScript.',
    resumen: [
      'API REST = interfaz que expone recursos por HTTP con métodos como GET y POST.',
      'GET obtiene datos; POST crea un recurso.',
      '401 = no autenticado; 404 = recurso no encontrado; 500 = error interno del servidor.',
      'Node.js = entorno para ejecutar JavaScript fuera del navegador, en el servidor.',
      'Firestore guarda documentos dentro de colecciones, en lugar de tablas con filas y columnas.',
    ],
    puntos_clave: [
      'Valida pagos en el servidor (Cloud Functions): el usuario puede modificar el código del navegador.',
      'Las claves secretas van en el servidor como variables de entorno o secretos, nunca en el HTML ni en localStorage.',
      'Los códigos 4xx son errores del cliente (la petición); los 5xx, errores del servidor.',
    ],
    errores_comunes: [
      'Confiar en validaciones hechas solo en el navegador.',
      'Confundir 401 (no autenticado) con 404 (no encontrado) o 500 (falla del servidor).',
      'Pensar que Firestore funciona igual que una base SQL con tablas.',
    ],
    mnemotecnia: '4xx = "tú (cliente) te equivocaste"; 5xx = "yo (servidor) me caí". 401 = sin credencial, 404 = no está.',
  },
];

const MOD = Object.fromEntries(DEV_MODULES.map((m) => [m.id, m]));

/* q(id, área, texto, [A, B, C, D], letraCorrecta) → objeto con el mismo formato que el banco RSTI */
function q(id, moduleId, text, opts, correct) {
  const m = MOD[moduleId];
  return {
    id, module: moduleId, moduleTitle: m.title, icon: m.icon, q: text,
    options: opts.map((t, i) => ({ letter: 'ABCD'[i], text: t })),
    correct,
  };
}

export const DEV_QUESTIONS = [
  // ---------- JavaScript ----------
  q('dev-js-01', 'js', '¿Qué hace `await` dentro de una función async?', ['Congela todo el navegador', 'Pausa esa función hasta que la promesa se resuelva', 'Vuelve síncrono todo el código', 'Repite la petición'], 'B'),
  q('dev-js-02', 'js', '¿Qué diferencia hay entre let y const?', ['let siempre es global', 'const solo guarda números', 'const no permite reasignar la variable', 'No hay diferencia'], 'C'),
  q('dev-js-03', 'js', '¿Qué devuelve fetch()?', ['Una promesa que resuelve en un objeto Response', 'El JSON directamente', 'Un string', 'undefined'], 'A'),
  q('dev-js-04', 'js', '¿Qué método convierte la respuesta de fetch en objeto JS?', ['response.text()', 'JSON.stringify()', 'response.parse()', 'response.json()'], 'D'),
  q('dev-js-05', 'js', '¿Para qué sirve try/catch junto con await?', ['Acelerar la petición', 'Cifrar los datos', 'Capturar errores de la operación asíncrona', 'Repetir la operación'], 'C'),
  q('dev-js-06', 'js', "¿Qué hace document.querySelector('#total')?", ['Crea un elemento nuevo', 'Devuelve el primer elemento con id "total"', 'Devuelve todos los elementos con clase "total"', 'Borra el elemento'], 'B'),
  q('dev-js-07', 'js', '¿Qué diferencia hay entre === y ==?', ['== es más estricto', 'Son iguales', '=== solo compara strings', '=== compara valor y tipo sin convertir'], 'D'),
  q('dev-js-08', 'js', '¿Qué hace array.map()?', ['Devuelve un arreglo nuevo transformando cada elemento', 'Filtra elementos', 'Ordena el arreglo', 'Modifica el original y devuelve undefined'], 'A'),
  q('dev-js-09', 'js', '¿Qué hace array.filter()?', ['Suma los elementos', 'Devuelve solo el primer elemento', 'Devuelve un arreglo nuevo con los elementos que cumplen la condición', 'Elimina elementos del original'], 'C'),
  q('dev-js-10', 'js', '¿Dónde se guarda localStorage?', ['En Firebase', 'En el servidor', 'En GitHub', 'En el navegador de ese dispositivo'], 'D'),

  // ---------- Firebase Seguridad ----------
  q('dev-fb-01', 'firebase', 'La regla `allow read, write: if true;` significa:', ['Solo usuarios logueados', 'Cualquiera en internet puede leer y escribir', 'Solo el administrador', 'Nadie tiene acceso'], 'B'),
  q('dev-fb-02', 'firebase', '`if request.auth != null` permite el acceso a:', ['Cualquier persona', 'Nadie', 'Solo usuarios autenticados', 'Solo el dueño del proyecto'], 'C'),
  q('dev-fb-03', 'firebase', 'Para que cada usuario lea solo su documento en /usuarios/{uid}:', ['if request.auth.uid == uid', 'if true', 'if request.auth == null', 'if resource == null'], 'A'),
  q('dev-fb-04', 'firebase', '¿Dónde se ejecutan las reglas de seguridad?', ['En el navegador', 'En GitHub Pages', 'En el celular del usuario', 'En los servidores de Firebase'], 'D'),
  q('dev-fb-05', 'firebase', '¿Ocultar un botón en el HTML protege los datos?', ['Sí, siempre', 'Solo en móvil', 'No; cualquiera puede consultar la base desde la consola, la protección real son las reglas', 'Sí, si el código está minificado'], 'C'),
  q('dev-fb-06', 'firebase', 'La apiKey de Firebase visible en tu HTML:', ['Identifica el proyecto y no es secreta; la seguridad depende de las reglas', 'Es secreta; si se ve, hackean todo', 'Da acceso de administrador', 'Debe cambiarse cada día'], 'A'),
  q('dev-fb-07', 'firebase', '¿Qué es request.resource.data?', ['Los datos ya guardados', 'Los datos que se intentan escribir', 'Los datos del usuario en Auth', 'Los logs'], 'B'),
  q('dev-fb-08', 'firebase', '¿Qué es resource.data?', ['Los datos que se intentan escribir', 'La configuración del proyecto', 'Los datos actuales ya guardados en el documento', 'El token del usuario'], 'C'),
  q('dev-fb-09', 'firebase', '¿Qué regla valida que "monto" sea un número positivo?', ['if monto', 'resource.monto > 0', 'validate(monto)', 'request.resource.data.monto is number && request.resource.data.monto > 0'], 'D'),
  q('dev-fb-10', 'firebase', '¿Dónde pruebas reglas sin arriesgar datos reales?', ['En el Rules Playground o el Emulator de Firebase', 'Directo en producción', 'En GitHub Pages', 'En localStorage'], 'A'),

  // ---------- Git ----------
  q('dev-git-01', 'git', '¿Qué comando crea una rama nueva y cambia a ella?', ['git commit -b', 'git switch -c nombre', 'git push nombre', 'git init nombre'], 'B'),
  q('dev-git-02', 'git', '¿Qué hace git add?', ['Sube a GitHub', 'Crea un repositorio', 'Borra archivos', 'Prepara cambios (staging) para el siguiente commit'], 'D'),
  q('dev-git-03', 'git', '¿Qué hace git commit -m "mensaje"?', ['Sube los cambios', 'Guarda una instantánea de los cambios preparados en el historial local', 'Descarga cambios', 'Crea una rama'], 'B'),
  q('dev-git-04', 'git', '¿Qué hace git push?', ['Descarga cambios', 'Deshace el último commit', 'Envía tus commits locales al repositorio remoto', 'Crea un commit'], 'C'),
  q('dev-git-05', 'git', '¿Qué hace git pull?', ['Trae y fusiona los cambios del remoto', 'Sube tus cambios', 'Borra una rama', 'Muestra el historial'], 'A'),
  q('dev-git-06', 'git', '¿Qué muestra git status?', ['El historial de commits', 'Los usuarios del repo', 'La velocidad de subida', 'Qué archivos están modificados o preparados'], 'D'),
  q('dev-git-07', 'git', '¿Qué muestra git log?', ['Errores de la app', 'El historial de commits', 'Archivos ignorados', 'Ramas remotas borradas'], 'B'),
  q('dev-git-08', 'git', '¿Cómo deshaces de forma segura un commit ya publicado?', ['Borrar el repositorio', 'git init', 'git revert', 'git reset --hard y push --force siempre'], 'C'),
  q('dev-git-09', 'git', '¿Para qué sirve una rama?', ['Respaldar en la nube', 'Acelerar la app', 'Guardar contraseñas', 'Trabajar cambios aislados sin afectar main'], 'D'),
  q('dev-git-10', 'git', '¿Para qué sirve el archivo .gitignore?', ['Lista archivos que Git no debe rastrear', 'Ignora errores del código', 'Oculta el repositorio', 'Borra archivos viejos'], 'A'),

  // ---------- Backend ----------
  q('dev-be-01', 'backend', '¿Por qué validar un pago en Cloud Functions y no en el navegador?', ['Es más rápido', 'Ahorra datos', 'El usuario puede modificar el código del navegador', 'Firebase no permite JS en el navegador'], 'C'),
  q('dev-be-02', 'backend', '¿Qué es una API REST?', ['Una base de datos', 'Una interfaz que expone recursos por HTTP usando métodos como GET y POST', 'Un lenguaje de programación', 'Un tipo de servidor físico'], 'B'),
  q('dev-be-03', 'backend', '¿Qué método HTTP se usa para crear un recurso?', ['GET', 'DELETE', 'POST', 'HEAD'], 'C'),
  q('dev-be-04', 'backend', '¿Qué método HTTP se usa para obtener datos?', ['GET', 'POST', 'PUT', 'PATCH'], 'A'),
  q('dev-be-05', 'backend', '¿Qué significa el código HTTP 404?', ['Error del servidor', 'No autenticado', 'Éxito', 'Recurso no encontrado'], 'D'),
  q('dev-be-06', 'backend', '¿Qué significa el código HTTP 500?', ['Recurso no encontrado', 'Error interno del servidor', 'Petición exitosa', 'Sin permiso'], 'B'),
  q('dev-be-07', 'backend', '¿Qué significa el código HTTP 401?', ['No autenticado: faltan credenciales válidas', 'Éxito', 'Error del servidor', 'Redirección'], 'A'),
  q('dev-be-08', 'backend', '¿Qué es Node.js?', ['Un framework de CSS', 'Una base de datos', 'Un navegador', 'Un entorno para ejecutar JavaScript fuera del navegador (en servidor)'], 'D'),
  q('dev-be-09', 'backend', '¿Dónde deben guardarse las claves secretas de una pasarela de pago?', ['En el HTML', 'En localStorage', 'En el servidor, como variables de entorno o secretos', 'En un comentario del código'], 'C'),
  q('dev-be-10', 'backend', '¿Cómo organiza los datos Firestore comparado con SQL?', ['Igual que SQL', 'Documentos dentro de colecciones, en lugar de tablas con filas y columnas', 'Solo en archivos de texto', 'En hojas de Excel'], 'B'),
];
