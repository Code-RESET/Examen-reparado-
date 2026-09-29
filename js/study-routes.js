/* Rutas de estudio. Cada ruta trae SU banco, SUS módulos y SU llave de localStorage,
   así el progreso de una nunca toca el de la otra.
   - "rsti": la app de siempre. Conserva la llave original 'rstiStudyState_v1'.
   - "dev":  Ruta Dev (JavaScript, Firebase, Git, Backend) con su propia llave.
   Para agregar otra ruta: crea su banco en data/, agrégala a ROUTES y ya aparece en el selector. */
import { QUESTIONS, MODULES, EXAM_APLICAR } from '../data/rsti.js';
import { DEV_QUESTIONS, DEV_MODULES } from '../data/dev.js';
import { safeGet, safeSet } from './storage.js';

const ROUTE_KEY = 'studyRoute'; // recuerda la última ruta elegida

const ROUTES = {
  rsti: {
    id: 'rsti',
    label: 'Examen RSTI',
    brand: { mark: 'R', title: 'RSTI Study', sub: 'Primera Categoría · IMSS' },
    storageKey: 'rstiStudyState_v1',
    questions: QUESTIONS,
    modules: MODULES,
    examAplicar: EXAM_APLICAR,   // ficha "Examen a Aplicar" (solo esta ruta)
    hardFacts: true,             // atajo "Datos duros" (solo esta ruta)
    shuffleOptions: true,        // se mezcla el orden en pantalla; la letra de cada opción se conserva
    unit: 'Módulo', unitPlural: 'módulos',
    heroTitle: 'Dominio general del examen',
    searchPlaceholder: 'Ej. contraseña, NEXT, dominio, ePO...',
    examSizes: [
      { n: 20, label: '20 preguntas' },
      { n: 40, label: '40 preguntas' },
      { n: 63, label: '63 (Módulo 1 real)' },
      { n: QUESTIONS.length, label: `${QUESTIONS.length} (todo)` },
    ],
    // Contexto que se le da al tutor IA
    aiExplainIntro: 'Pregunta de examen RSTI (soporte técnico IMSS):',
    aiFeynmanWho: 'un estudiante que se prepara para el examen RSTI (Auxiliar de Soporte Técnico, IMSS)',
    moduleBadges: {
      1: { icon: '💻', name: 'Micro Master', desc: 'Domina el módulo de Microcomputadoras' },
      2: { icon: '🛠️', name: 'Técnico Preventivo', desc: 'Domina Mantenimiento' },
      3: { icon: '🌐', name: 'Networker', desc: 'Domina Redes' },
      4: { icon: '🔌', name: 'Cableador Pro', desc: 'Domina Cableado Estructurado' },
      5: { icon: '🛡️', name: 'Cazavirus', desc: 'Domina Antivirus' },
      6: { icon: '🗂️', name: 'Admin de Dominio', desc: 'Domina Directorio Activo' },
      7: { icon: '⚙️', name: 'Instalador Experto', desc: 'Domina Instalación y Configuración' },
      8: { icon: '📧', name: 'Mensajero Oficial', desc: 'Domina Correo Institucional' },
      9: { icon: '📜', name: 'Guardián de la Norma', desc: 'Domina Normatividad y Seguridad' },
      10: { icon: '🏢', name: 'Sistemista IMSS', desc: 'Domina Sistemas Institucionales' },
    },
    masterBadge: { name: 'Maestro RSTI' },
  },
  dev: {
    id: 'dev',
    label: 'Ruta Dev',
    brand: { mark: 'D', title: 'Ruta Dev', sub: 'Desarrollo Fullstack' },
    storageKey: 'rstiStudyState_dev_v1',
    questions: DEV_QUESTIONS,
    modules: DEV_MODULES,
    examAplicar: null,
    hardFacts: false,
    shuffleOptions: false,       // respeta el orden A-B-C-D tal como está en el banco
    unit: 'Área', unitPlural: 'áreas',
    heroTitle: 'Dominio de la Ruta Dev',
    searchPlaceholder: 'Ej. await, reglas, git push, 404...',
    examSizes: [
      { n: 10, label: '10 preguntas' },
      { n: 20, label: '20 preguntas' },
      { n: DEV_QUESTIONS.length, label: `${DEV_QUESTIONS.length} (todo)` },
    ],
    aiExplainIntro: 'Pregunta de estudio de desarrollo web fullstack:',
    aiFeynmanWho: 'un estudiante que aprende desarrollo web fullstack (JavaScript, Firebase, Git y Backend)',
    moduleBadges: {
      js: { icon: '🟨', name: 'JS Ninja', desc: 'Domina JavaScript' },
      firebase: { icon: '🔥', name: 'Guardián de Reglas', desc: 'Domina Firebase Seguridad' },
      git: { icon: '🌿', name: 'Maestro de Ramas', desc: 'Domina Git' },
      backend: { icon: '🖥️', name: 'Backend Builder', desc: 'Domina Backend' },
    },
    masterBadge: { name: 'Dev Fullstack' },
  },
};

// Índices para buscar rápido por id (los ids pueden ser números o texto)
for (const r of Object.values(ROUTES)) {
  r.byId = new Map(r.questions.map((q) => [String(q.id), q]));
  r.byModule = new Map(r.modules.map((m) => [String(m.id), r.questions.filter((q) => q.module === m.id)]));
}

export let route = ROUTES[safeGet(ROUTE_KEY)] || ROUTES.rsti;

const listeners = [];
/* Los módulos que guardan cosas en memoria (mazos, sesiones) se suscriben para limpiarse al cambiar de ruta. */
export function onRouteChange(fn) { listeners.push(fn); }

export function setRoute(id) {
  if (!ROUTES[id] || id === route.id) return false;
  route = ROUTES[id];
  safeSet(ROUTE_KEY, id);
  listeners.forEach((fn) => fn(route));
  return true;
}

/* ---------- Consultas sobre el banco de la ruta activa ---------- */
export const questionById = (id) => route.byId.get(String(id));
export const questionsByModule = (modId) => route.byModule.get(String(modId)) || [];
export const moduleMeta = (modId) => route.modules.find((m) => String(m.id) === String(modId));
/* "M3" en RSTI, "JS" en Ruta Dev */
export const moduleShort = (m) => m.short || 'M' + m.id;
/* Etiqueta de una pregunta: "💻 Módulo 1 · Introducción..." / "🟨 Área · JavaScript" */
export function unitTag(q) {
  return route.id === 'rsti'
    ? `${q.icon} Módulo ${q.module} · ${q.moduleTitle}`
    : `${q.icon} ${route.unit} · ${q.moduleTitle}`;
}
