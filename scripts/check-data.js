#!/usr/bin/env node
// Valida la integridad del banco de preguntas (data.js) sin depender de nada externo.
// Uso: node scripts/check-data.js

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.js');
const src = fs.readFileSync(dataPath, 'utf8');
const load = new Function(src + '\nreturn { QUESTIONS, EXAM_APLICAR, MODULES };');
const { QUESTIONS, EXAM_APLICAR, MODULES } = load();

let errors = 0;
function fail(msg) { errors++; console.error('✗ ' + msg); }

const moduleIds = new Set(MODULES.map(m => m.id));

// QUESTIONS: cada `correct` debe existir entre las letras de sus propias opciones
const seenQuestionText = new Map();
for (const q of QUESTIONS) {
  const letters = q.options.map(o => o.letter);
  if (!letters.includes(q.correct)) {
    fail(`QUESTIONS id=${q.id}: correct="${q.correct}" no está entre sus opciones [${letters.join(',')}]`);
  }
  if (new Set(letters).size !== letters.length) {
    fail(`QUESTIONS id=${q.id}: letras de opción repetidas`);
  }
  if (!moduleIds.has(q.module)) {
    fail(`QUESTIONS id=${q.id}: module=${q.module} no existe en MODULES`);
  }
  const key = q.q.trim().toLowerCase();
  if (seenQuestionText.has(key)) {
    fail(`QUESTIONS id=${q.id}: texto duplicado de id=${seenQuestionText.get(key)}`);
  } else {
    seenQuestionText.set(key, q.id);
  }
}

// EXAM_APLICAR: cada `correctText` debe existir entre sus propias `opts`
for (const q of EXAM_APLICAR) {
  if (!q.opts.includes(q.correctText)) {
    fail(`EXAM_APLICAR id=${q.id}: correctText no está entre sus opts`);
  }
}

// IDs únicos dentro de cada colección
for (const [name, list] of [['QUESTIONS', QUESTIONS], ['EXAM_APLICAR', EXAM_APLICAR], ['MODULES', MODULES]]) {
  const ids = list.map(x => x.id);
  if (new Set(ids).size !== ids.length) {
    fail(`${name}: hay ids duplicados`);
  }
}

if (errors > 0) {
  console.error(`\n${errors} problema(s) encontrados en data.js.`);
  process.exit(1);
} else {
  console.log(`✓ data.js OK — ${QUESTIONS.length} preguntas, ${EXAM_APLICAR.length} de examen a aplicar, ${MODULES.length} módulos, todo consistente.`);
}
