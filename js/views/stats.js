/* Página "Tu progreso": estadísticas de la ruta activa. */
import { $, escapeHtml } from '../util.js';
import { route, questionsByModule, moduleShort } from '../study-routes.js';
import { STATE, last7DaysLog, confidenceStats } from '../state.js';
import { registerPage } from '../router.js';
import { levelFromXp, achievements } from '../progress.js';
import { masteredCount, seenCount, modulePct } from '../bank.js';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function renderStats() {
  $('statsSub').textContent = `Estadísticas de tu estudio · ${route.label}.`;
  $('statMastered').textContent = masteredCount(route.questions) + '/' + route.questions.length;
  $('statAnswered').textContent = STATE.quiz.answered;
  const totalAns = STATE.quiz.correct + STATE.quiz.wrong;
  $('statCorrectPct').textContent = totalAns ? Math.round((STATE.quiz.correct / totalAns) * 100) + '%' : '0%';
  $('statStreak').textContent = STATE.streak.count + (STATE.streak.count === 1 ? ' día' : ' días');
  const mins = Math.floor(STATE.totalSeconds / 60);
  $('statTime').textContent = mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  $('statLevel').textContent = 'Nivel ' + levelFromXp(STATE.xp);
  $('statXp').textContent = STATE.xp + ' XP total';

  const unit = route.unit.toLowerCase();
  $('statBarsLabel').textContent = `Dominio por ${unit}`;
  $('statExtremesLabel').textContent = `${route.unit} más fuerte / más débil`;
  const modPcts = route.modules.map((m) => ({ m, pct: modulePct(m.id) }));
  $('statModuleBars').innerHTML = modPcts.map(({ m, pct }) => `
    <div class="bar-row">
      <div class="br-label">${m.icon} ${moduleShort(m)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>
      <div class="br-pct">${pct}%</div>
    </div>`).join('');

  /* Actividad de la semana */
  const week = last7DaysLog();
  const maxAnswered = Math.max(1, ...week.map((d) => d.answered));
  $('statWeekChart').innerHTML = week.map((d) => {
    const h = Math.round((d.answered / maxAnswered) * 80);
    return `<div class="wc-col">
      <div class="wc-num">${d.answered || ''}</div>
      <div class="wc-bar" style="height:${Math.max(h, d.answered > 0 ? 4 : 0)}px;"></div>
      <div class="wc-lab">${DAY_NAMES[new Date(d.date + 'T12:00:00').getDay()]}</div>
    </div>`;
  }).join('');

  /* Historial de simulacros */
  const hist = STATE.examHistory;
  $('statExamSummary').innerHTML = hist.length ? `
    <div class="es-box"><div class="es-num">${hist.length}</div><div class="es-lab">Simulacros hechos</div></div>
    <div class="es-box"><div class="es-num">${Math.max(...hist.map((h) => h.pct))}%</div><div class="es-lab">Mejor puntaje</div></div>
    <div class="es-box"><div class="es-num">${Math.round(hist.reduce((s, h) => s + h.pct, 0) / hist.length)}%</div><div class="es-lab">Promedio</div></div>`
    : `<div class="empty-state" style="grid-column:1/-1;">Aún no presentas ningún simulacro de examen.</div>`;

  /* Calibración de confianza */
  const cs = confidenceStats();
  $('statConfidence').innerHTML = cs && cs.total >= 5 ? `
    <div class="exam-summary">
      <div class="es-box"><div class="es-num" style="color:var(--danger);">${cs.overconfidentPct}%</div><div class="es-lab">Falsa seguridad</div></div>
      <div class="es-box"><div class="es-num">${cs.wellCalibratedPct}%</div><div class="es-lab">Bien calibrado</div></div>
      <div class="es-box"><div class="es-num" style="color:var(--accent-2);">${cs.underconfidentPct}%</div><div class="es-lab">Sabes más de lo que crees</div></div>
    </div>
    ${cs.overconfidentPct >= 15 ? `<div class="empty-state" style="text-align:left; padding:12px;"><b style="color:var(--danger);">${cs.overconfidentCount} veces</b> estuviste "seguro" o "totalmente seguro" y fallaste. Eso es más peligroso que no saber — en el examen real marcarías esas con confianza y las perderías. Repasa esas preguntas con calma, no de prisa.</div>` : ''}`
    : `<div class="empty-state">Responde con el nivel de confianza al menos 5 veces en el Quiz para ver tu calibración aquí.</div>`;

  /* Módulo más fuerte / más débil (solo entre los que ya practicaste) */
  const withData = modPcts.filter((x) => seenCount(questionsByModule(x.m.id)) > 0);
  if (withData.length) {
    const strongest = withData.reduce((a, b) => (b.pct > a.pct ? b : a));
    const weakest = withData.reduce((a, b) => (b.pct < a.pct ? b : a));
    $('statModuleExtremes').innerHTML = `
      <div class="ex-box"><div class="ex-ic">Más fuerte</div><div class="ex-title">${strongest.m.icon} ${escapeHtml(strongest.m.title)}</div><div class="ex-pct">${strongest.pct}% dominado</div></div>
      <div class="ex-box"><div class="ex-ic">Más débil</div><div class="ex-title">${weakest.m.icon} ${escapeHtml(weakest.m.title)}</div><div class="ex-pct">${weakest.pct}% dominado — repasa aquí</div></div>`;
  } else {
    $('statModuleExtremes').innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Responde algunas preguntas para ver tus ${route.unitPlural} fuerte/débil.</div>`;
  }

  $('achGrid').innerHTML = achievements().map((a) => `
    <div class="ach-item ${STATE.unlocked.includes(a.id) ? 'unlocked' : ''}">
      <div class="ach-ic">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
    </div>`).join('');
}

registerPage('progreso', { view: 'stats', nav: 'stats', enter: renderStats });
