// Roda a sugestão fora da thread principal para a tela não travar.
import { suggest } from './solver.js';

self.addEventListener('message', (e) => {
  const { id, state, seed } = e.data || {};
  try {
    const result = suggest(state, { seed });
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
});
