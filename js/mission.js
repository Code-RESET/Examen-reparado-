/* Misión del día: una sesión corta armada sola para que al abrir la app sepas qué estudiar.
   Mezcla, en este orden de prioridad:
     🎯 puntos débiles (las que más has fallado)
     🔁 repasos que ya tocan (Leitner), las cajas más bajas primero
     🆕 preguntas nuevas del "enfoque": el módulo más débil que ya empezaste, o el siguiente sin terminar
   Completarla una vez al día da un bono de XP. */
import { todayStr, shuffle } from './util.js';
import { route, questionsByModule } from './study-routes.js';
import { STATE, saveState } from './state.js';
import { addXp, unlockAchievement, streakCount } from './progress.js';
import { showCelebrate } from './ui.js';
import { weakQuestions, modulePct, seenCount, MODULE_DONE_RATIO } from './bank.js';

export const MISSION_SIZE = 12;
const MAX_REVIEWS = 5;
const MAX_WEAK = 3;
const MAX_NEW = 4;
export const MISSION_BONUS_XP = 50;

export const TAG_LABEL = { review: '🔁 Repaso', weak: '🎯 Punto débil', new: '🆕 Nueva' };

/* Módulo en el que conviene enfocarse hoy. */
export function focusModule() {
  const done = MODULE_DONE_RATIO * 100;
  const notDone = route.modules
    .map((m) => ({ m, pct: modulePct(m.id), seen: seenCount(questionsByModule(m.id)) }))
    .filter((x) => x.pct < done);
  if (!notDone.length) return null; // todo dominado
  // El más débil entre los que ya empezaste; si no has empezado ninguno, el primero en orden
  const started = notDone.filter((x) => x.seen > 0);
  return started.length ? started.reduce((a, b) => (b.pct < a.pct ? b : a)) : notDone[0];
}

/* Arma la misión. Devuelve las preguntas (en orden de juego) y la etiqueta de cada una. */
export function buildMission() {
  const now = Date.now();
  const chosen = new Map(); // id -> {q, tag}
  const add = (list, n, tag) => {
    for (const q of list) {
      if (n <= 0 || chosen.size >= MISSION_SIZE) break;
      if (chosen.has(q.id)) continue;
      chosen.set(q.id, { q, tag });
      n--;
    }
  };
  const card = (q) => STATE.cards[q.id];
  const isSeen = (q) => (card(q)?.seen ?? 0) > 0;
  const due = shuffle(route.questions.filter((q) => isSeen(q) && card(q).next <= now))
    .sort((a, b) => card(a).box - card(b).box);
  const unseen = (list) => shuffle(list.filter((q) => !isSeen(q)));
  const focus = focusModule();

  add(weakQuestions(), MAX_WEAK, 'weak');
  add(due, MAX_REVIEWS, 'review');
  add(unseen(focus ? questionsByModule(focus.m.id) : route.questions), MAX_NEW, 'new');
  // Completar hasta MISSION_SIZE: más repasos, luego nuevas de cualquier lado, luego lo que sea
  add(due, MISSION_SIZE, 'review');
  add(focus ? unseen(questionsByModule(focus.m.id)) : [], MISSION_SIZE, 'new');
  add(unseen(route.questions), MISSION_SIZE, 'new');
  add(shuffle(route.questions.slice()), MISSION_SIZE, 'review');

  // Se barajan para alternar repasos, débiles y nuevas
  const items = shuffle([...chosen.values()]);
  const counts = { review: 0, weak: 0, new: 0 };
  items.forEach((it) => { counts[it.tag]++; });
  return { questions: items.map((it) => it.q), tags: items.map((it) => it.tag), counts, focus };
}

export const missionDoneToday = () => !!STATE.missions[todayStr()];

/* Se llama al terminar un quiz de tipo misión. El bono solo se da una vez al día. */
export function completeMission(score, total) {
  if (missionDoneToday()) return false;
  STATE.missions[todayStr()] = { correct: score.correct, total };
  saveState();
  const streak = streakCount();
  showCelebrate('🏆', '¡Misión cumplida!',
    `+${MISSION_BONUS_XP} XP de bono · ${score.correct}/${total} aciertos · racha de ${streak} ${streak === 1 ? 'día' : 'días'}. Mañana te espera otra.`);
  addXp(MISSION_BONUS_XP);
  unlockAchievement('mission_first');
  if (Object.keys(STATE.missions).length >= 7) unlockAchievement('mission7');
  return true;
}
