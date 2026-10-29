/* Página de inicio: selector de ruta, progreso general, atajos y cuadrícula de módulos. */
import { $, escapeHtml, fmtClock, todayStr } from '../util.js';
import { route, setRoute, questionsByModule, moduleShort } from '../study-routes.js';
import { STATE, saveState } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { showToast } from '../ui.js';
import { renderTopbar, touchStreak } from '../progress.js';
import {
  overallPct, masteredCount, modulesCompletedCount, modulePct, hardFactQuestions, weakQuestions, MODULE_DONE_RATIO,
} from '../bank.js';
import { quizSessionLabel } from './quiz.js';

function renderHome() {
  document.querySelectorAll('.route-btn').forEach((b) => {
    const on = b.dataset.route === route.id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });

  const pct = overallPct();
  const ring = $('heroRing');
  const circumference = 2 * Math.PI * 35;
  ring.setAttribute('stroke-dasharray', circumference.toFixed(1));
  ring.style.strokeDashoffset = (circumference * (1 - pct / 100)).toFixed(1);
  $('heroPct').textContent = pct + '%';
  $('heroTitle').textContent = route.heroTitle;
  $('heroMastered').textContent = masteredCount(route.questions);
  $('heroTotal').textContent = route.questions.length;
  $('heroModsDone').textContent = modulesCompletedCount();
  $('heroModsTotal').textContent = route.modules.length;
  $('heroUnit').textContent = route.unitPlural;

  renderPlan();
  renderResumeCards();
  renderQuickActions();

  $('aplicarCard').hidden = !route.examAplicar;
  if (route.examAplicar) $('aplicarCount').textContent = route.examAplicar.length;

  $('modulesLabel').textContent = route.unitPlural[0].toUpperCase() + route.unitPlural.slice(1);
  const c2 = 2 * Math.PI * 18;
  $('moduleGrid').innerHTML = route.modules.map((m) => {
    const mPct = modulePct(m.id);
    return `
      <button class="module-card" data-action="openModule" data-id="${m.id}">
        ${mPct >= MODULE_DONE_RATIO * 100 ? '<div class="mc-done-badge">✓</div>' : ''}
        <div class="mc-top">
          <div class="mc-ring">
            <svg viewBox="0 0 40 40">
              <circle class="bg-c" cx="20" cy="20" r="18"></circle>
              <circle class="fg-c" cx="20" cy="20" r="18" stroke-dasharray="${c2.toFixed(1)}" stroke-dashoffset="${(c2 * (1 - mPct / 100)).toFixed(1)}"></circle>
            </svg>
            <div class="mc-icon">${m.icon}</div>
          </div>
          <div class="mc-num">${moduleShort(m)}</div>
        </div>
        <div class="mc-title">${escapeHtml(m.title)}</div>
        <div class="mc-meta">${questionsByModule(m.id).length} preguntas · ${mPct}%</div>
      </button>`;
  }).join('');
}

/* ---------- Plan hacia el examen ----------
   Con la fecha del examen calcula cuántas preguntas contestar hoy para dominar todo a tiempo
   (una pregunta necesita ~3 aciertos espaciados para quedar dominada) y qué fase de estudio toca. */
const REVIEWS_TO_MASTER = 3;
let editingPlan = false;

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

export function planFor(examDate, pending, answeredToday) {
  const days = daysUntil(examDate);
  const goal = pending === 0 ? 20 : Math.min(150, Math.max(20, Math.ceil((pending * REVIEWS_TO_MASTER) / Math.max(1, days))));
  let phase;
  if (days < 0) phase = 'La fecha ya pasó. Si tu examen se movió, cambia la fecha.';
  else if (days === 0) phase = 'Hoy es tu examen. Repasa solo los datos duros 15 minutos, nada nuevo. ¡Mucha suerte!';
  else if (days <= 3) phase = 'Recta final: un Examen a Aplicar completo al día y datos duros. No estudies temas nuevos.';
  else if (days <= 14) phase = 'Fase de repaso: juega Supervivencia y Parejas a diario y ataca tus puntos débiles.';
  else phase = 'Fase de aprendizaje: un módulo por día (teoría y flashcards) y un juego para cerrar.';
  return { days, goal, done: Math.min(answeredToday, goal), phase };
}

function renderPlan() {
  const card = $('planCard');
  const date = STATE.examDate;
  if (!date || editingPlan) {
    card.innerHTML = `
      <h3>Mi plan para el examen</h3>
      <p class="muted" style="font-size:15px; margin-bottom:10px;">Pon la fecha de tu examen y la app te dice cuántas preguntas contestar cada día para llegar con todo dominado.</p>
      <div class="plan-form">
        <input type="date" id="planDateInput" class="field" aria-label="Fecha del examen" value="${date || ''}" min="${todayStr()}">
        <button class="btn btn-primary" data-action="savePlanDate">Guardar</button>
      </div>`;
    return;
  }
  const pending = route.questions.length - masteredCount(route.questions);
  const answered = STATE.dailyLog[todayStr()]?.answered || 0;
  const p = planFor(date, pending, answered);
  const pct = Math.round((p.done / p.goal) * 100);
  const daysLabel = p.days > 1 ? `Faltan ${p.days} días` : p.days === 1 ? 'Mañana es tu examen' : p.days === 0 ? 'Hoy es el examen' : 'Fecha pasada';
  card.innerHTML = `
    <div class="plan-head">
      <div><div class="plan-days">${daysLabel}</div><div class="muted plan-sub">${pending} preguntas por dominar</div></div>
      <button class="btn btn-sm" data-action="editPlanDate">Cambiar fecha</button>
    </div>
    ${p.days >= 0 ? `
    <div class="plan-goal"><span>Meta de hoy</span><b>${p.done}/${p.goal} preguntas</b></div>
    <div class="fc-progress-bar"><div class="fill${pct >= 100 ? ' done' : ''}" style="width:${pct}%"></div></div>
    ${pct >= 100 ? '<div class="plan-ok">✓ Meta de hoy cumplida</div>' : ''}` : ''}
    <p class="plan-phase">${escapeHtml(p.phase)}</p>`;
}

/* Tarjetas "Reanudar" para lo que quedó a medias (quiz, simulacro, examen a aplicar). */
function renderResumeCards() {
  const cards = [];
  const qs = STATE.quizSession;
  if (qs?.ids?.length) {
    cards.push(resumeCard('quiz', 'Reanudar quiz',
      `${quizSessionLabel(qs)} · pregunta ${Math.min(qs.index + 1, qs.ids.length)}/${qs.ids.length} · ✔ ${qs.score.correct} ✘ ${qs.score.wrong}`));
  }
  const es = STATE.examSession;
  if (es) {
    const left = (es.endAt - Date.now()) / 1000;
    cards.push(resumeCard('examen/curso', 'Reanudar simulacro',
      left > 0 ? `Pregunta ${es.index + 1}/${es.ids.length} · quedan ${fmtClock(left)}` : 'Se acabó el tiempo — toca para ver tu calificación'));
  }
  const as = STATE.aplicarSession;
  if (as && route.examAplicar) {
    cards.push(resumeCard('aplicar/curso', 'Reanudar Examen a Aplicar',
      `Pregunta ${as.index + 1}/${as.order.length} · ✔ ${as.score.correct} ✘ ${as.score.wrong}`));
  }
  $('resumeCards').innerHTML = cards.join('');
}
const resumeCard = (to, title, sub) => `
  <button class="content-card card-btn resume" data-action="go" data-to="${to}">
    <h3>${title}</h3><p>${escapeHtml(sub)}</p>
  </button>`;

function renderQuickActions() {
  const weakN = weakQuestions().length;
  const items = [
    `<button class="qa-btn primary" data-action="startQuiz"><span class="qa-ic"><svg><use href="#i-bolt"/></svg></span><span class="qa-label">Quiz rápido<span class="qa-sub">10 preguntas</span></span></button>`,
    `<button class="qa-btn" data-action="go" data-to="juegos"><span class="qa-ic"><svg><use href="#i-game"/></svg></span><span class="qa-label">Juegos<span class="qa-sub">Supervivencia y Parejas</span></span></button>`,
    `<button class="qa-btn" data-action="startFlash"><span class="qa-ic"><svg><use href="#i-cards"/></svg></span><span class="qa-label">Flashcards<span class="qa-sub">Repaso espaciado</span></span></button>`,
    `<button class="qa-btn" data-action="go" data-to="examen"><span class="qa-ic"><svg><use href="#i-timer"/></svg></span><span class="qa-label">Modo examen<span class="qa-sub">Simulacro con tiempo</span></span></button>`,
  ];
  if (route.hardFacts) {
    items.push(`<button class="qa-btn" data-action="startHardFacts"><span class="qa-ic"><svg><use href="#i-hash"/></svg></span><span class="qa-label">Datos duros<span class="qa-sub">${hardFactQuestions().length} detectados</span></span></button>`);
  }
  items.push(`<button class="qa-btn" data-action="startWeak"><span class="qa-ic"><svg><use href="#i-target"/></svg></span><span class="qa-label">Puntos débiles<span class="qa-sub">${weakN ? weakN + ' por repasar' : 'ninguno aún'}</span></span></button>`);
  if (items.length % 2) items[items.length - 1] = items[items.length - 1].replace('class="qa-btn"', 'class="qa-btn wide"');
  $('quickActions').innerHTML = items.join('');
}

registerPage('inicio', { view: 'home', nav: 'home', enter: renderHome });

registerActions({
  go: ({ to }) => go(to),
  openModule: ({ id }) => go(`modulo/${id}/teoria`),
  savePlanDate: () => {
    const v = $('planDateInput').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { showToast('Elige la fecha de tu examen.'); return; }
    STATE.examDate = v;
    editingPlan = false;
    saveState();
    renderPlan();
  },
  editPlanDate: () => { editingPlan = true; renderPlan(); },
  switchRoute: ({ route: id }) => {
    if (!setRoute(id)) return;
    touchStreak();
    renderTopbar();
    renderHome();
    showToast(`${route.label} · tu progreso se guarda por separado`);
  },
});
