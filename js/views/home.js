/* Página de inicio: selector de ruta, progreso general, atajos y cuadrícula de módulos. */
import { $, escapeHtml, fmtClock } from '../util.js';
import { route, setRoute, questionsByModule, moduleShort } from '../study-routes.js';
import { STATE } from '../state.js';
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

/* Tarjetas "Reanudar" para lo que quedó a medias (quiz, simulacro, examen a aplicar). */
function renderResumeCards() {
  const cards = [];
  const qs = STATE.quizSession;
  if (qs?.ids?.length) {
    cards.push(resumeCard('quiz', '▶️ Reanudar quiz',
      `${quizSessionLabel(qs)} · pregunta ${Math.min(qs.index + 1, qs.ids.length)}/${qs.ids.length} · ✔ ${qs.score.correct} ✘ ${qs.score.wrong}`));
  }
  const es = STATE.examSession;
  if (es) {
    const left = (es.endAt - Date.now()) / 1000;
    cards.push(resumeCard('examen/curso', '⏱️ Reanudar simulacro',
      left > 0 ? `Pregunta ${es.index + 1}/${es.ids.length} · quedan ${fmtClock(left)}` : 'Se acabó el tiempo — toca para ver tu calificación'));
  }
  const as = STATE.aplicarSession;
  if (as && route.examAplicar) {
    cards.push(resumeCard('aplicar/curso', '📋 Reanudar Examen a Aplicar',
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
    `<button class="qa-btn primary" data-action="startQuiz"><span class="qa-ic">⚡</span>Quiz rápido</button>`,
    `<button class="qa-btn" data-action="startFlash"><span class="qa-ic">🗂️</span>Flashcards<br>repaso</button>`,
    `<button class="qa-btn" data-action="go" data-to="examen"><span class="qa-ic">⏱️</span>Modo examen</button>`,
  ];
  if (route.hardFacts) {
    items.push(`<button class="qa-btn" data-action="startHardFacts"><span class="qa-ic">🔢</span>Datos duros<br><span class="qa-sub">${hardFactQuestions().length} detectados</span></button>`);
  }
  items.push(`<button class="qa-btn" data-action="startWeak"><span class="qa-ic">🎯</span>Puntos débiles<br><span class="qa-sub">${weakN ? weakN + ' por repasar' : 'ninguno aún'}</span></button>`);
  if (items.length % 2) items[items.length - 1] = items[items.length - 1].replace('class="qa-btn"', 'class="qa-btn wide"');
  $('quickActions').innerHTML = items.join('');
}

registerPage('inicio', { view: 'home', nav: 'home', enter: renderHome });

registerActions({
  go: ({ to }) => go(to),
  openModule: ({ id }) => go(`modulo/${id}/teoria`),
  switchRoute: ({ route: id }) => {
    if (!setRoute(id)) return;
    touchStreak();
    renderTopbar();
    renderHome();
    showToast(`${id === 'dev' ? '💻' : '📋'} ${route.label} activa — tu progreso se guarda por separado`);
  },
});
