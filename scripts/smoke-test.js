#!/usr/bin/env node
// Pruebas de extremo a extremo en un navegador real (Chromium vía Playwright), con vista de celular.
// Uso: npm install && npm test      (o: node scripts/smoke-test.js)
// Levanta un servidor local, abre la app y recorre los flujos principales de ambas rutas.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const RSTI_KEY = 'rstiStudyState_v1';
const DEV_KEY = 'rstiStudyState_dev_v1';
let passed = 0, failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); } else { failed++; console.error('  ✗ ' + msg); }
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

/* Abre la app en un contexto limpio. opts.seed = {llave: objeto} precarga localStorage. */
async function open({ seed, clock, timezoneId, initScript } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  if (clock) await page.clock.install({ time: clock });
  if (seed) await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return; // solo en la primera carga
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, seed);
  if (initScript) await ctx.addInitScript(initScript);
  await page.goto(BASE);
  await page.waitForSelector('#moduleGrid .module-card');
  return page;
}
const ls = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);
const lsRaw = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const hash = (page) => page.evaluate(() => location.hash);
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/* Cierra las celebraciones (insignias / nivel) que estén en pantalla, como haría una persona. */
async function dismiss(page) {
  while (await page.isVisible('#celebrateOverlay.show')) await page.click('#celebrateOverlay [data-action="closeCelebrate"]');
}
async function tap(page, selector) { await dismiss(page); await page.click(selector); }
const quizNext = (page) => tap(page, '#quizNextBtn');

/* Contesta la pregunta actual del quiz: correcta si wantCorrect, si no una incorrecta. */
async function answerQuiz(page, wantCorrect, confidence = 4) {
  const letter = await page.evaluate((ok) => {
    const s = JSON.parse(localStorage.getItem(localStorage.getItem('studyRoute') === 'dev' ? 'rstiStudyState_dev_v1' : 'rstiStudyState_v1')).quizSession;
    const correct = window.__correctOf(s.ids[s.index]);
    const letters = [...document.querySelectorAll('#quizOptions .opt-item')].map((b) => b.dataset.letter);
    return ok ? correct : letters.find((l) => l !== correct);
  }, wantCorrect);
  await dismiss(page);
  await page.click(`#quizOptions .opt-item[data-letter="${letter}"]`);
  await page.click(`.conf-btn[data-level="${confidence}"]`);
}
/* Expone la letra correcta de cualquier pregunta para las pruebas (lee los bancos como módulos). */
async function exposeAnswers(page) {
  await page.evaluate(async () => {
    const [{ QUESTIONS }, { DEV_QUESTIONS }] = await Promise.all([import('./data/rsti.js'), import('./data/dev.js')]);
    const map = new Map([...QUESTIONS, ...DEV_QUESTIONS].map((q) => [String(q.id), q.correct]));
    window.__correctOf = (id) => map.get(String(id));
  });
}

try {
  console.log('\n1) Carga inicial y ruta RSTI por defecto');
  {
    const page = await open();
    check(await page.locator('.route-btn.active').getAttribute('data-route') === 'rsti', 'la ruta por defecto es Examen RSTI');
    check(await page.locator('#moduleGrid .module-card').count() === 10, '10 módulos en la cuadrícula');
    check(await page.textContent('#heroTotal') === '322', 'contador dinámico: 322 preguntas');
    check(await page.isVisible('#aplicarCard'), 'se ve la ficha Examen a Aplicar');
    check(await noHorizontalScroll(page), 'sin scroll horizontal en 390px');
    check(page.errors.length === 0, 'sin errores de JavaScript' + (page.errors.length ? ': ' + page.errors : ''));
    await page.context().close();
  }

  console.log('\n2) El progreso guardado antes de esta versión se conserva');
  {
    const legacy = {
      xp: 120, streak: { count: 2, lastDay: '2020-01-01' }, totalSeconds: 600,
      cards: { 1: { box: 3, next: 0, seen: 2, correct: 2, wrong: 0 }, 2: { box: 0, next: 0, seen: 1, correct: 0, wrong: 1 } },
      quiz: { answered: 3, correct: 2, wrong: 1 }, unlocked: ['first_step'], moduleQuizBest: {}, dailyLog: {}, examHistory: [],
      confidenceLog: [], feynmanCount: 0,
      quizSession: { moduleScope: 3, hardOnly: false, ids: [41, 42, 43], index: 1, score: { correct: 1, wrong: 0 } },
    };
    const page = await open({ seed: { [RSTI_KEY]: legacy } });
    check((await page.textContent('#xpChip')).startsWith('120'), 'XP anterior (120) intacto');
    check(await page.textContent('#heroMastered') === '1', 'tarjeta dominada anterior cuenta');
    check((await page.textContent('#resumeCards')).includes('pregunta 2/3'), 'quiz a medias (formato viejo) se ofrece para reanudar');
    await tap(page, '#resumeCards .card-btn');
    check(await hash(page) === '#/quiz' && (await page.textContent('#quizProgressLabel')) === 'Pregunta 2/3', 'reanuda en la pregunta 2/3');
    const st = await ls(page, RSTI_KEY);
    check(st.cards['1'].box === 3 && !('moduleQuizBest' in st), 'datos intactos y campo muerto eliminado al guardar');
    await page.context().close();
  }

  console.log('\n3) Quiz completo, sin doble respuesta al recargar');
  {
    const page = await open();
    await exposeAnswers(page);
    await tap(page, '[data-action="startQuiz"]');
    check(await hash(page) === '#/quiz', 'Quiz rápido abre #/quiz');
    await answerQuiz(page, true);
    check(await page.isVisible('#quizNextBtn'), 'aparece "Siguiente" tras contestar');
    await page.reload();
    await page.waitForSelector('#quizOptions .opt-item');
    await exposeAnswers(page);
    check(await page.textContent('#quizProgressLabel') === 'Pregunta 2/10', 'tras recargar pasa a la 2 (no se contesta la 1 dos veces)');
    for (let i = 0; i < 9; i++) { await answerQuiz(page, i % 2 === 0); await quizNext(page); }
    check(await hash(page) === '#/inicio' || await hash(page) === '', 'al terminar vuelve al inicio');
    const st = await ls(page, RSTI_KEY);
    check(st.quiz.answered === 10 && st.quizSession === null, '10 respuestas registradas y sesión cerrada');
    await page.context().close();
  }

  console.log('\n4) Ruta Dev: banco propio, progreso separado y se recuerda');
  {
    const page = await open();
    await exposeAnswers(page);
    // algo de progreso RSTI primero
    await tap(page, '[data-action="startQuiz"]');
    await answerQuiz(page, true);
    await page.goto(BASE + '#/inicio');
    const rstiBefore = await lsRaw(page, RSTI_KEY);

    await tap(page, '.route-btn[data-route="dev"]');
    check(await page.locator('#moduleGrid .module-card').count() === 4, '4 áreas en la Ruta Dev');
    check(await page.textContent('#heroTotal') === '40', '40 preguntas en la Ruta Dev');
    check(!(await page.isVisible('#aplicarCard')), 'Examen a Aplicar oculto en la Ruta Dev');
    check(await page.locator('#quickActions [data-action="startHardFacts"]').count() === 0, 'Datos duros oculto en la Ruta Dev');
    check((await page.textContent('#xpChip')).startsWith('0'), 'XP de la Ruta Dev empieza en 0');

    await tap(page, '[data-action="startQuiz"]');
    const letters = await page.$$eval('#quizOptions .opt-item', (els) => els.map((e) => e.dataset.letter).join(''));
    check(letters === 'ABCD', 'opciones en orden A-B-C-D (no se mezclan en la Ruta Dev)');
    check(!(await page.textContent('#quizQuestion')).includes('`'), 'el código entre comillas invertidas se muestra con formato');
    for (let i = 0; i < 10; i++) { await answerQuiz(page, i < 4); await quizNext(page); }
    const dev = await ls(page, DEV_KEY);
    check(Object.keys(dev.cards).length === 10 && Object.keys(dev.cards).every((k) => k.startsWith('dev-')), 'Leitner Dev: 10 tarjetas, todas con id dev-*');
    check(await lsRaw(page, RSTI_KEY) === rstiBefore, 'el progreso RSTI no cambió ni un byte');

    // Puntos débiles solo con preguntas Dev falladas
    await tap(page, '[data-action="startWeak"]');
    const weak = await ls(page, DEV_KEY);
    check(weak.quizSession.kind === 'weak' && weak.quizSession.ids.length === 6 && weak.quizSession.ids.every((id) => dev.cards[id].wrong > 0),
      'Puntos débiles: las 6 falladas de la Ruta Dev');

    // Búsqueda solo en el banco Dev
    await tap(page, '.nav-btn[data-nav="search"]');
    await page.fill('#searchInput', 'git');
    const n = await page.locator('#searchResults .search-item').count();
    check(n > 0 && (await page.textContent('#searchResults')).includes('Git'), `búsqueda "git" encuentra preguntas Dev (${n})`);
    await page.fill('#searchInput', 'McAfee');
    check((await page.textContent('#searchResults')).includes('Sin resultados'), 'búsqueda Dev no mezcla preguntas RSTI');

    // Simulacro con las 40, sin mezclar
    await page.goto(BASE + '#/examen');
    await tap(page, '[data-action="setExamSize"][data-n="40"]');
    await tap(page, '[data-action="startExam"]');
    const ex = await ls(page, DEV_KEY);
    check(ex.examSession.ids.length === 40 && ex.examSession.ids.every((id) => String(id).startsWith('dev-')), 'simulacro Dev: 40 preguntas, todas Dev');
    page.once('dialog', (d) => d.accept());
    await tap(page, '[data-action="abortExam"]');

    // Recordar ruta
    await page.reload();
    await page.waitForSelector('#moduleGrid .module-card');
    check(await page.locator('.route-btn.active').getAttribute('data-route') === 'dev', 'tras recargar sigue en la Ruta Dev');
    await tap(page, '.route-btn[data-route="rsti"]');
    check(await page.locator('#moduleGrid .module-card').count() === 10, 'regresar a RSTI muestra sus 10 módulos');
    const rstiEx = await (async () => { await page.goto(BASE + '#/examen'); await tap(page, '[data-action="setExamSize"][data-n="322"]'); await tap(page, '[data-action="startExam"]'); return ls(page, RSTI_KEY); })();
    check(rstiEx.examSession.ids.every((id) => typeof id === 'number'), 'simulacro RSTI de 322 sin preguntas Dev');
    check(page.errors.length === 0, 'sin errores de JavaScript' + (page.errors.length ? ': ' + page.errors : ''));
    await page.context().close();
  }

  console.log('\n5) Módulo Dev: teoría, Feynman y botón Atrás');
  {
    const page = await open({ seed: { studyRoute: 'dev' } });
    await tap(page, '#moduleGrid .module-card >> nth=1');
    check(await hash(page) === '#/modulo/firebase/teoria', 'abre #/modulo/firebase/teoria');
    check((await page.textContent('#modContent')).includes('reglas de seguridad'), 'muestra la teoría de Firebase');
    await tap(page, '.tab-btn[data-tab="feynman"]');
    check(await page.isVisible('#feynmanInput'), 'pestaña Feynman lista');
    await page.goBack();
    check(await hash(page) !== '#/modulo/firebase/feynman' && await page.isVisible('#moduleGrid'), 'Atrás regresa al inicio (no cierra la app)');
    await page.context().close();
  }

  console.log('\n6) Simulacro: tiempo agotado, reanudar y salir sin que te saque');
  {
    const page = await open({ clock: new Date('2026-09-29T10:00:00') });
    await page.goto(BASE + '#/examen');
    await tap(page, '[data-action="startExam"]');   // 20 preguntas, 15 min
    await tap(page, '#examOptions .opt-item >> nth=0');
    await tap(page, '#examNextBtn');
    await tap(page, '#examNextBtn');                  // 2 contestadas (1 en blanco)
    await page.reload();
    await page.waitForSelector('#examOptions .opt-item');
    check(await page.textContent('#examProgressLabel') === 'Pregunta 3/20', 'tras recargar el simulacro sigue en la 3/20');
    await tap(page, '.nav-btn[data-nav="stats"]');
    await page.clock.runFor(16 * 60 * 1000);
    check(await hash(page) === '#/progreso', 'si sales del examen y se acaba el tiempo, no te saca de donde estás');
    await tap(page, '.nav-btn[data-nav="home"]');
    check((await page.textContent('#resumeCards')).includes('Se acabó el tiempo'), 'inicio avisa que se acabó el tiempo');
    await tap(page, '#resumeCards .card-btn');
    check(await hash(page) === '#/examen/resultados', 'toca → resultados');
    const st = await ls(page, RSTI_KEY);
    check(st.quiz.answered === 2, `solo cuenta 2 respondidas (no 20): ${st.quiz.answered}`);
    const shownWrong = Number(await page.textContent('#resWrong')), shownRight = Number(await page.textContent('#resCorrect'));
    check(shownWrong + shownRight === 20, 'correctas + incorrectas = 20');
    check((await page.textContent('#resUnanswered')).includes('18'), 'avisa 18 sin responder por tiempo');
    check(await page.locator('#resWrongList .weak-item').count() === 10 && await page.locator('#resWrongList .pager').count() === 1, 'lista de falladas paginada (10 por página)');
    await tap(page, '#resWrongList [data-dir="1"]');
    check((await page.textContent('#resWrongList .pg-info')).startsWith('Página 2/'), 'página 2 de falladas');
    check(await page.textContent('#resTime') === '15:00', 'tiempo usado topado en 15:00');
    await page.context().close();
  }

  console.log('\n7) Racha con fecha local (México, 8 pm)');
  {
    const page = await open({ clock: new Date('2026-09-29T20:00:00-06:00'), timezoneId: 'America/Mexico_City' });
    const st = await ls(page, RSTI_KEY);
    check(st.streak.lastDay === '2026-09-29', `el día registrado es el local: ${st.streak.lastDay}`);
    await page.context().close();
  }

  console.log('\n8) Flashcards: sin XP duplicado y salida correcta');
  {
    const page = await open();
    await tap(page, '#moduleGrid .module-card >> nth=2');   // visitar un módulo antes
    await page.goto(BASE + '#/inicio');
    await tap(page, '[data-action="startFlash"]');
    await tap(page, '#flashcard'); await tap(page, '[data-action="rateCard"][data-rating="2"]');
    await tap(page, '[data-action="prevCard"]');
    await tap(page, '#flashcard');
    check(await page.isVisible('#fcRated') && !(await page.isVisible('#fcRateRow')), 'tarjeta ya calificada no se puede volver a calificar');
    check((await ls(page, RSTI_KEY)).xp === 5, 'XP = 5 (no se duplica)');
    await tap(page, '[data-action="exitFlash"]');
    check(await page.isVisible('#moduleGrid'), 'salir de un repaso general vuelve al inicio');
    await page.context().close();
  }

  console.log('\n9) Examen a Aplicar: reanudar tras recargar');
  {
    const page = await open();
    await tap(page, '#aplicarCard');
    await tap(page, '[data-action="startAplicar"]');
    await tap(page, '#eaOptions .opt-item >> nth=0');
    await tap(page, '#eaNextBtn');
    await tap(page, '#eaOptions .opt-item >> nth=1');
    const before = await page.$$eval('#eaOptions .opt-item span:last-child', (e) => e.map((x) => x.textContent).join('|'));
    await page.reload();
    await page.waitForSelector('#eaOptions .opt-item');
    const after = await page.$$eval('#eaOptions .opt-item span:last-child', (e) => e.map((x) => x.textContent).join('|'));
    check(await page.textContent('#eaProgressLabel') === 'Pregunta 2/63', 'sigue en la 2/63');
    check(before === after && await page.isVisible('#eaNextBtn'), 'mismo orden de opciones y la respuesta ya dada se conserva');
    await page.context().close();
  }

  console.log('\n10) Con el almacenamiento lleno la app no se congela');
  {
    const page = await open({
      initScript: () => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; },
    });
    await tap(page, '[data-action="startQuiz"]');
    await tap(page, '#quizOptions .opt-item >> nth=0');
    await tap(page, '.conf-btn >> nth=3');
    check(await page.isVisible('#quizNextBtn'), 'el quiz sigue funcionando (aparece "Siguiente")');
    check(page.errors.length === 0, 'sin errores de JavaScript');
    await page.context().close();
  }

  console.log('\n11) Todas las páginas caben en el celular');
  {
    const page = await open();
    for (const p of ['inicio', 'buscar', 'modulo/1/teoria', 'examen', 'progreso', 'aplicar']) {
      await page.goto(BASE + '#/' + p);
      check(await noHorizontalScroll(page), `#/${p} sin scroll horizontal`);
    }
    await tap(page, '.nav-btn[data-nav="search"]');
    await page.fill('#searchInput', 'de');
    check(await page.locator('#searchResults .search-item').count() === 10 && await page.locator('#searchResults .pager').count() === 1, 'búsqueda amplia paginada de 10 en 10');
    await tap(page, '#searchResults .search-item >> nth=0');
    check(await page.isVisible('#searchResults .search-item.open .si-answer'), 'tocar un resultado muestra la respuesta');
    await page.context().close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${failed ? '✗' : '✓'} ${passed} pruebas OK, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
