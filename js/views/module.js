/* Detalle de un módulo/área: pestañas Teoría, Flashcards, Quiz y Feynman.
   URL: #/modulo/<id>/<pestaña> */
import { $, escapeHtml } from '../util.js';
import { route, moduleMeta, questionsByModule } from '../study-routes.js';
import { STATE, saveState } from '../state.js';
import { registerPage, go } from '../router.js';
import { registerActions } from '../actions.js';
import { showToast } from '../ui.js';
import { unlockAchievement } from '../progress.js';
import { callGemini, getGeminiKey, openApiKeyModal } from '../ai.js';

const TABS = ['teoria', 'flash', 'quiz', 'feynman'];
let activeModuleId = null;

function enterModule([id, tab = 'teoria']) {
  const m = moduleMeta(id);
  if (!m) return 'inicio';
  if (!TABS.includes(tab)) return `modulo/${id}/teoria`;
  activeModuleId = m.id;
  $('modTitle').textContent = m.icon + ' ' + m.title;
  $('modSub').textContent = `${questionsByModule(m.id).length} preguntas · ${route.unit} ${route.id === 'rsti' ? m.id : ''}`.trim();
  document.querySelectorAll('#modTabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const el = $('modContent');
  if (tab === 'teoria') el.innerHTML = theoryHtml(m);
  else if (tab === 'flash') el.innerHTML = `
    <div class="content-card">
      <h3>Flashcards de este ${route.unit.toLowerCase()}</h3>
      <p style="margin-bottom:14px;">Repasa las ${questionsByModule(m.id).length} preguntas de "${escapeHtml(m.title)}" en formato de tarjetas con repetición espaciada.</p>
      <button class="btn btn-primary" data-action="startFlash" data-id="${m.id}">Empezar flashcards</button>
    </div>`;
  else if (tab === 'quiz') el.innerHTML = `
    <div class="content-card">
      <h3>Quiz de este ${route.unit.toLowerCase()}</h3>
      <p style="margin-bottom:14px;">Ponte a prueba con preguntas de opción múltiple de "${escapeHtml(m.title)}", con retroalimentación inmediata.</p>
      <button class="btn btn-primary" data-action="startQuiz" data-id="${m.id}">Empezar quiz</button>
    </div>`;
  else el.innerHTML = `
    <div class="content-card">
      <h3>Explícalo tú (Método Feynman)</h3>
      <p style="margin-bottom:10px;">Explica "<b>${escapeHtml(m.title)}</b>" con tus propias palabras, como si se lo enseñaras a alguien que no sabe nada del tema. No copies el resumen — entre más simple lo digas, mejor se ve si de verdad lo entiendes.</p>
      <textarea id="feynmanInput" class="field" rows="6" placeholder="Escribe tu explicación aquí..."></textarea>
      <button class="btn btn-primary" style="margin-top:12px;" data-action="submitFeynman" id="feynmanSubmitBtn">Revisar mi explicación</button>
      <div id="feynmanFeedback" style="margin-top:14px;"></div>
    </div>`;
}

/* El contenido teórico viene de data/*.js (texto propio de confianza, puede traer <b>/<code>). */
const theoryHtml = (m) => `
  <div class="content-card"><h3>Explicación</h3><p>${m.explicacion}</p></div>
  <div class="content-card"><h3>Resumen</h3><ul>${m.resumen.map((x) => '<li>' + x + '</li>').join('')}</ul></div>
  <div class="content-card"><h3>Puntos clave</h3><ul>${m.puntos_clave.map((x) => '<li>' + x + '</li>').join('')}</ul></div>
  <div class="content-card"><h3>Errores comunes</h3><ul>${m.errores_comunes.map((x) => '<li>' + x + '</li>').join('')}</ul></div>
  <div class="mnemo-box"><div><b>Truco para recordar</b><br>${m.mnemotecnia}</div></div>`;

async function submitFeynman() {
  const m = moduleMeta(activeModuleId);
  const input = $('feynmanInput').value.trim();
  if (input.length < 15) { showToast('Escribe una explicación un poco más completa primero.'); return; }
  const btn = $('feynmanSubmitBtn');
  const fbEl = $('feynmanFeedback');
  const key = getGeminiKey();
  if (!key) {
    fbEl.innerHTML = `<div class="feedback-box bad">Configura tu clave API de Google Gemini primero (botón de la llave, arriba).</div>`;
    openApiKeyModal();
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Revisando tu explicación…';
  fbEl.innerHTML = '';
  const prompt = `Eres un tutor que aplica la Técnica Feynman con ${route.aiFeynmanWho}.
Tema oficial: "${m.title}"
Definición/resumen oficial del material de estudio:
${m.explicacion.replace(/<[^>]+>/g, '')}
Puntos clave oficiales: ${m.puntos_clave.join(' | ')}
El estudiante escribió esta explicación del tema CON SUS PROPIAS PALABRAS:
"${input}"
Evalúa su explicación como tutor Feynman:
1. Dile en 1 línea si está bien encaminado o no.
2. Señala QUÉ le faltó o qué dijo mal (comparado con los puntos clave oficiales), en 2-3 líneas máximo.
3. Si usó jerga técnica sin explicarla en simple, dile cuál y pídele que la explique más simple.
4. Termina con UNA pregunta puntual para que profundice.
Responde en español, tono de tutor cercano y directo, máximo 8 líneas totales, sin preámbulo tipo "Claro, aquí está mi evaluación".`;
  const result = await callGemini(prompt, key);
  if (result.ok) {
    fbEl.innerHTML = `<div class="feedback-box ok"><b>Feedback del tutor</b><br><br>${escapeHtml(result.text).replace(/\n/g, '<br>')}</div>`;
    STATE.feynmanCount = (STATE.feynmanCount || 0) + 1;
    saveState();
    unlockAchievement('feynman_first');
    if (STATE.feynmanCount >= 10) unlockAchievement('feynman_pro');
  } else {
    fbEl.innerHTML = `<div class="feedback-box bad">Error de API: ${escapeHtml(result.error)}<br><br>Verifica tu clave o tu cuota disponible.</div>`;
  }
  btn.disabled = false;
  btn.textContent = 'Revisar mi explicación';
}

registerPage('modulo', { view: 'module', nav: 'home', enter: enterModule });

registerActions({
  modTab: ({ tab }) => go(`modulo/${activeModuleId}/${tab}`, { replace: true }),
  submitFeynman,
});
