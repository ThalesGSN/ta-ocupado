// Estado da app com desfazer/refazer e cópia no localStorage deste aparelho.
import { normalizeState } from './model.js';

const KEY = 'ta-ocupado:v1';
const LIMIT = 120;

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(state) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export function createStore(initial) {
  let state = initial;
  const undo = [];
  const redo = [];
  const subs = new Set();
  const emit = (reason) => subs.forEach((f) => f(state, reason));

  return {
    get: () => state,
    // `mutate` recebe uma cópia profunda e pode alterá-la à vontade.
    update(mutate, reason = 'edit') {
      const next = structuredClone(state);
      const res = mutate(next);
      const finalState = res && typeof res === 'object' ? res : next;
      if (JSON.stringify(finalState) === JSON.stringify(state)) return false;
      undo.push(state);
      if (undo.length > LIMIT) undo.shift();
      redo.length = 0;
      state = finalState;
      saveLocal(state);
      emit(reason);
      return true;
    },
    replace(next, reason = 'replace') {
      if (state) {
        undo.push(state);
        if (undo.length > LIMIT) undo.shift();
      }
      redo.length = 0;
      state = next;
      saveLocal(state);
      emit(reason);
    },
    reset(next, reason = 'reset') {
      undo.length = 0;
      redo.length = 0;
      state = next;
      saveLocal(state);
      emit(reason);
    },
    undo() {
      if (!undo.length) return false;
      redo.push(state);
      state = undo.pop();
      saveLocal(state);
      emit('undo');
      return true;
    },
    redo() {
      if (!redo.length) return false;
      undo.push(state);
      state = redo.pop();
      saveLocal(state);
      emit('redo');
      return true;
    },
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    subscribe(f) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}
