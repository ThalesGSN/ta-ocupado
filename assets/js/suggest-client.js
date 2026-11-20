// Chama o otimizador num Web Worker; se não der, roda na thread principal.
import { suggest } from './solver.js';

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker === false) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (e) => {
      const { id, ok, result, error } = e.data || {};
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error));
    });
    worker.addEventListener('error', () => {
      worker = false;
      for (const [, p] of pending) p.fallback();
      pending.clear();
    });
    return worker;
  } catch {
    worker = false;
    return null;
  }
}

export function runSuggest(state, seed) {
  const w = getWorker();
  const local = () => suggest(state, { seed });
  if (!w) return new Promise((resolve) => setTimeout(() => resolve(local()), 20));
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, fallback: () => resolve(local()) });
    w.postMessage({ id, state, seed });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve(local());
      }
    }, 8000);
  });
}
