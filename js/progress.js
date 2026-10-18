/* XP, niveles, racha, insignias y barra superior. */
import { $, todayStr, daysAgoStr } from './util.js';
import { route } from './study-routes.js';
import { STATE, saveState, onStudy, totalPracticed } from './state.js';
import { showCelebrate } from './ui.js';
import { masteredCount, seenCount, modulePct, MODULE_DONE_RATIO } from './bank.js';

/* ---------------- XP / nivel ---------------- */
export const levelFromXp = (xp) => Math.floor(xp / 100) + 1;

export function addXp(n) {
  const before = levelFromXp(STATE.xp);
  STATE.xp += n;
  saveState();
  renderTopbar();
  const after = levelFromXp(STATE.xp);
  if (after > before) showCelebrate('🆙', '¡Subiste de nivel!', `Ahora eres Nivel ${after}. Sigue así.`);
}

/* ---------------- Racha ----------------
   Solo cuenta un día cuando de verdad estudias (contestas o calificas algo), no al abrir la app. */
export function touchStreak() {
  const today = todayStr();
  if (STATE.streak.lastDay === today) return;
  STATE.streak.count = STATE.streak.lastDay === daysAgoStr(1) ? STATE.streak.count + 1 : 1;
  STATE.streak.lastDay = today;
  saveState();
  renderTopbar();
  if (STATE.streak.count >= 3) unlockAchievement('streak3');
  if (STATE.streak.count >= 7) unlockAchievement('streak7');
}
onStudy(touchStreak);

/* Racha vigente: si el último día de estudio fue antes de ayer, ya se rompió (aunque el número guardado siga ahí). */
export function streakCount() {
  const last = STATE.streak.lastDay;
  return last === todayStr() || last === daysAgoStr(1) ? STATE.streak.count : 0;
}
export const studiedToday = () => STATE.streak.lastDay === todayStr();

/* ---------------- Insignias ----------------
   Las generales son iguales en ambas rutas; las de módulo vienen de route.moduleBadges.
   Cada ruta guarda sus insignias desbloqueadas en su propio estado. */
export function achievements() {
  const n = route.questions.length;
  return [
    { id: 'first_step', icon: '🌱', name: 'Primer Paso', desc: 'Practica tu primera pregunta' },
    { id: 'ten', icon: '🔟', name: 'Calentando motores', desc: 'Practica 10 preguntas' },
    { id: 'hundred', icon: '💯', name: 'Centenario', desc: 'Practica 100 preguntas' },
    { id: 'all_seen', icon: '📚', name: 'Todo Revisado', desc: `Revisa las ${n} preguntas al menos una vez` },
    { id: 'streak3', icon: '🔥', name: 'Racha x3', desc: 'Estudia 3 días seguidos' },
    { id: 'streak7', icon: '🚀', name: 'Racha x7', desc: 'Estudia 7 días seguidos' },
    { id: 'quiz_perfect', icon: '🎯', name: 'Perfeccionista', desc: '100% en un quiz de 10+ preguntas' },
    { id: 'exam_pass', icon: '🏅', name: 'Examen Aprobado', desc: '80% o más en Modo Examen' },
    { id: 'feynman_first', icon: '🗣️', name: 'Maestro Feynman', desc: 'Explica un tema con tus palabras por primera vez' },
    { id: 'feynman_pro', icon: '🎓', name: 'Tutor Nato', desc: 'Completa 10 explicaciones estilo Feynman' },
    { id: 'mission_first', icon: '🏆', name: 'Misión Cumplida', desc: 'Completa tu primera misión del día' },
    { id: 'mission7', icon: '🗓️', name: 'Constancia', desc: 'Completa 7 misiones del día' },
    { id: 'combo10', icon: '⚡', name: 'Imparable', desc: 'Combo de 10 aciertos seguidos en un juego' },
    { id: 'ta_300', icon: '⏱️', name: 'Relámpago', desc: '300 puntos en Contrarreloj' },
    { id: 'vf_20', icon: '❤️', name: 'Superviviente', desc: '20 aciertos en una partida de Verdadero o Falso' },
    ...route.modules.map((m) => ({ id: 'mod' + m.id, ...route.moduleBadges[m.id] })),
    { id: 'full_master', icon: '👑', name: route.masterBadge.name, desc: `Domina las ${n} preguntas` },
  ];
}

export function unlockAchievement(id) {
  if (STATE.unlocked.includes(id)) return;
  STATE.unlocked.push(id);
  saveState();
  const ach = achievements().find((a) => a.id === id);
  if (ach) showCelebrate(ach.icon, '¡Insignia desbloqueada!', ach.name + ' — ' + ach.desc);
}

export function checkGlobalAchievements() {
  const answered = totalPracticed(); // quiz, simulacro, flashcards y juegos
  if (answered >= 1) unlockAchievement('first_step');
  if (answered >= 10) unlockAchievement('ten');
  if (answered >= 100) unlockAchievement('hundred');
  if (seenCount(route.questions) >= route.questions.length) unlockAchievement('all_seen');
  if (masteredCount(route.questions) >= route.questions.length) unlockAchievement('full_master');
  route.modules.forEach((m) => {
    if (modulePct(m.id) >= MODULE_DONE_RATIO * 100) unlockAchievement('mod' + m.id);
  });
}

/* ---------------- Barra superior ---------------- */
export function renderTopbar() {
  $('brandMark').textContent = route.brand.mark;
  $('brandTitle').textContent = route.brand.title;
  $('brandSub').textContent = route.brand.sub;
  $('lvlChip').textContent = levelFromXp(STATE.xp);
  $('xpChip').textContent = STATE.xp + ' XP';
  const chip = $('streakChip');
  chip.textContent = '🔥 ' + streakCount();
  chip.classList.toggle('pending', !studiedToday()); // atenuada hasta que estudies hoy
  chip.title = studiedToday() ? 'Ya estudiaste hoy' : 'Estudia hoy para mantener tu racha';
}
