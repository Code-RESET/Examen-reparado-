/* Acceso a localStorage que nunca rompe la app.
   En modo privado de Safari o con el almacenamiento lleno, setItem lanza una excepción;
   antes eso dejaba el quiz congelado a media respuesta. */

export function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function safeSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* sin almacenamiento: nada que borrar */ }
}
