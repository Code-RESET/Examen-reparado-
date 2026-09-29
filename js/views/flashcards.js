/* Flashcards con repetición espaciada (sistema Leitner). */
import { $, shuffle, formatText } from '../util.js';
import { route, questionsByModule, moduleMeta, onRouteChange, unitTag } from '../study-routes.js';
import { saveState, cardOf, BOX_INTERVALS } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { showToast } from '../ui.js';
import { addXp, touchStreak, checkGlobalAchievements } from '../progress.js';
import { dueCardsFor, correctOption } from '../bank.js';

const XP_PER_CARD = 5;
let deck = [];
let index = 0;
let flipped = false;
let scope = null;         // módulo de origen (para regresar ahí al salir) o null = inicio
let rated = new Set();    // tarjetas ya calificadas en esta sesión: no se vuelven a premiar
let xpEarned = 0;

onRouteChange(() => { deck = []; });

function startFlashSession(modId) {
  touchStreak();
  const pool = modId ? questionsByModule(modId) : route.questions;
  const due = dueCardsFor(pool);
  deck = (due.length ? shuffle(due) : shuffle(pool.slice()).slice(0, 20)).slice(0, 30);
  index = 0;
  scope = modId || null;
  rated = new Set();
  xpEarned = 0;
  go('flashcards');
}

function render() {
  const q = deck[index];
  flipped = false;
  $('flashcard').classList.remove('flipped');
  $('fcFrontTag').textContent = unitTag(q).toUpperCase();
  $('fcQuestion').innerHTML = formatText(q.q);
  $('fcAnswer').innerHTML = q.correct + ') ' + formatText(correctOption(q).text);
  $('fcNote').textContent = route.unit + ': ' + q.moduleTitle;
  $('fcRateRow').hidden = true;
  $('fcRated').hidden = true;
  $('flashProgFill').style.width = Math.round((index / deck.length) * 100) + '%';
}

function flip() {
  flipped = !flipped;
  $('flashcard').classList.toggle('flipped', flipped);
  const already = rated.has(deck[index].id);
  $('fcRateRow').hidden = !flipped || already;
  $('fcRated').hidden = !flipped || !already;
}

function rate(rating) {
  const q = deck[index];
  if (rated.has(q.id)) return;
  rated.add(q.id);
  const c = cardOf(q.id);
  c.seen += 1;
  if (rating === 0) { c.box = 0; c.wrong += 1; }
  else { c.box = Math.min(c.box + rating, 4); c.correct += 1; } // Normal sube 1 caja, Fácil sube 2
  c.next = Date.now() + BOX_INTERVALS[c.box];
  saveState();
  xpEarned += XP_PER_CARD;
  addXp(XP_PER_CARD);
  checkGlobalAchievements();
  next();
}

function next() {
  if (index < deck.length - 1) { index++; render(); return; }
  showToast(xpEarned
    ? `🎉 Terminaste esta sesión de flashcards (+${xpEarned} XP)`
    : '🎉 Terminaste esta sesión de flashcards');
  go('inicio');
}

registerPage('flashcards', {
  view: 'flash', nav: null,
  enter: () => {
    if (!deck.length) return 'inicio';
    $('flashSub').textContent = scope ? moduleMeta(scope).title : 'Repaso general';
    render();
  },
});

registerActions({
  startFlash: ({ id }) => startFlashSession(id),
  flipCard: flip,
  rateCard: ({ rating }) => rate(Number(rating)),
  nextCard: next,
  prevCard: () => { if (index > 0) { index--; render(); } },
  exitFlash: () => go(scope ? `modulo/${scope}/flash` : 'inicio'),
});
