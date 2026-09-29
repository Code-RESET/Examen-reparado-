#!/usr/bin/env node
// Valida la integridad de los bancos de preguntas (data/rsti.js y data/dev.js) y que el
// service worker precachee todos los archivos de la app. Sin dependencias externas.
// Uso: node scripts/check-data.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTIONS, EXAM_APLICAR, MODULES } from '../data/rsti.js';
import { DEV_QUESTIONS, DEV_MODULES } from '../data/dev.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
function fail(msg) { errors++; console.error('✗ ' + msg); }

function checkBank(name, questions, modules) {
  const moduleIds = new Set(modules.map((m) => m.id));
  const seenText = new Map();
  for (const q of questions) {
    const letters = q.options.map((o) => o.letter);
    if (!letters.includes(q.correct)) fail(`${name} id=${q.id}: correct="${q.correct}" no está entre sus opciones [${letters.join(',')}]`);
    if (new Set(letters).size !== letters.length) fail(`${name} id=${q.id}: letras de opción repetidas`);
    if (!moduleIds.has(q.module)) fail(`${name} id=${q.id}: module=${q.module} no existe`);
    const key = q.q.trim().toLowerCase();
    if (seenText.has(key)) fail(`${name} id=${q.id}: texto duplicado de id=${seenText.get(key)}`);
    else seenText.set(key, q.id);
  }
  for (const m of modules) {
    for (const field of ['title', 'icon', 'explicacion', 'mnemotecnia']) if (!m[field]) fail(`${name} módulo ${m.id}: falta "${field}"`);
    for (const field of ['resumen', 'puntos_clave', 'errores_comunes']) if (!Array.isArray(m[field])) fail(`${name} módulo ${m.id}: "${field}" debe ser lista`);
    if (!questions.some((q) => q.module === m.id)) fail(`${name} módulo ${m.id}: no tiene preguntas`);
  }
}

checkBank('RSTI', QUESTIONS, MODULES);
checkBank('DEV', DEV_QUESTIONS, DEV_MODULES);

// EXAM_APLICAR: cada `correctText` debe existir entre sus propias `opts` (máximo 4: A-D)
for (const q of EXAM_APLICAR) {
  if (!q.opts.includes(q.correctText)) fail(`EXAM_APLICAR id=${q.id}: correctText no está entre sus opts`);
  if (q.opts.length > 4) fail(`EXAM_APLICAR id=${q.id}: más de 4 opciones`);
}

// IDs únicos dentro de cada colección
for (const [name, list] of [['QUESTIONS', QUESTIONS], ['EXAM_APLICAR', EXAM_APLICAR], ['MODULES', MODULES], ['DEV_QUESTIONS', DEV_QUESTIONS], ['DEV_MODULES', DEV_MODULES]]) {
  const ids = list.map((x) => x.id);
  if (new Set(ids).size !== ids.length) fail(`${name}: hay ids duplicados`);
}
// Las preguntas Dev usan ids "dev-..." para que su progreso nunca choque con el del RSTI
for (const q of DEV_QUESTIONS) if (!/^dev-[a-z]+-\d{2}$/.test(q.id)) fail(`DEV_QUESTIONS id=${q.id}: debe tener el formato dev-area-NN`);

// El service worker debe precachear todos los archivos .js/.css de la app
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const f of [...walk('js'), ...walk('css'), ...walk('data')]) {
  if (!sw.includes(`'./${f.split(path.sep).join('/')}'`)) fail(`sw.js: falta './${f}' en PRECACHE_URLS`);
}

if (errors > 0) {
  console.error(`\n${errors} problema(s) encontrados.`);
  process.exit(1);
}
console.log(`✓ Datos OK — RSTI: ${QUESTIONS.length} preguntas, ${EXAM_APLICAR.length} de examen a aplicar, ${MODULES.length} módulos · Dev: ${DEV_QUESTIONS.length} preguntas, ${DEV_MODULES.length} áreas · sw.js al día.`);
