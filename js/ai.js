/* Tutor IA con Google Gemini (API gratuita). La clave se guarda solo en este dispositivo. */
import { $, escapeHtml } from './util.js';
import { safeGet, safeSet, safeRemove } from './storage.js';
import { route, questionById } from './study-routes.js';
import { registerActions } from './actions.js';
import { showToast } from './ui.js';

const KEY_STORAGE = 'rsti_gemini_key';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite'];

export const getGeminiKey = () => safeGet(KEY_STORAGE) || '';

export function openApiKeyModal() {
  $('apiKeyInput').value = getGeminiKey();
  $('apiKeyOverlay').classList.add('show');
}

/* Prueba varios modelos en orden; cada intento tiene 15 s de límite. */
export async function callGemini(prompt, key) {
  let lastMsg = 'Error desconocido';
  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1000 } }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        lastMsg = err.error?.message || 'HTTP ' + resp.status;
        continue;
      }
      const data = await resp.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n').trim();
      if (text) return { ok: true, text };
      lastMsg = 'Respuesta vacía del modelo';
    } catch (e) {
      lastMsg = e.name === 'AbortError' ? 'Tiempo de espera agotado (15s)' : e.message;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return { ok: false, error: lastMsg };
}

/* ---------- "¿Por qué las otras están mal?" ---------- */
const liveExplainCache = {};
const EXPLAIN_LABEL = { quiz: '¿Por qué las otras están mal?', exam: '¿Por qué?' };

export function explainButton(qid, chosenLetter, ctx) {
  return `<button class="btn btn-outline btn-sm" data-action="explainWhy" data-qid="${qid}" data-letter="${chosenLetter || ''}" data-ctx="${ctx}">${EXPLAIN_LABEL[ctx]}</button>
    <div id="liveExplain-${ctx}-${qid}" class="live-explain"></div>`;
}

async function explainWhyLive({ qid, letter, ctx }, btn) {
  const cacheKey = `${route.id}-${ctx}-${qid}`;
  const container = $(`liveExplain-${ctx}-${qid}`);
  container.classList.add('show');
  if (liveExplainCache[cacheKey]) { container.innerHTML = liveExplainCache[cacheKey]; return; }
  const key = getGeminiKey();
  if (!key) {
    container.innerHTML = 'Configura tu clave API de Google Gemini primero (botón de la llave, arriba).';
    openApiKeyModal();
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Pensando…';
  container.innerHTML = '';
  const q = questionById(qid);
  const prompt = `${route.aiExplainIntro}
"${q.q}"
Opciones:
${q.options.map((o) => `${o.letter}) ${o.text}`).join('\n')}
Respuesta correcta: ${q.correct}
El usuario eligió: ${letter || '(no marcó ninguna a tiempo)'}
Explica en español, en máximo 4 líneas muy breves y claras, por qué la opción correcta (${q.correct}) es la correcta y por qué cada una de las otras opciones NO lo es. Sé directo, sin preámbulo, usa un tono de tutor amigable. No repitas el texto completo de las opciones, solo la letra y la razón.`;
  const result = await callGemini(prompt, key);
  if (result.ok) {
    liveExplainCache[cacheKey] = escapeHtml(result.text).replace(/\n/g, '<br>');
    container.innerHTML = liveExplainCache[cacheKey];
  } else {
    container.innerHTML = `Error de API: ${escapeHtml(result.error)}<br>Verifica tu clave o tu cuota disponible.`;
  }
  btn.textContent = EXPLAIN_LABEL[ctx];
  btn.disabled = false;
}

registerActions({
  openApiKey: openApiKeyModal,
  closeApiKey: () => $('apiKeyOverlay').classList.remove('show'),
  saveApiKey: () => {
    const val = $('apiKeyInput').value.trim();
    if (val) safeSet(KEY_STORAGE, val); else safeRemove(KEY_STORAGE);
    $('apiKeyOverlay').classList.remove('show');
    showToast(val ? 'Clave guardada' : 'Clave eliminada');
  },
  explainWhy: (data, btn) => explainWhyLive(data, btn),
});
