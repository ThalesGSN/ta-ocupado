// Estado da mesa aberta, com desfazer e refazer. Quem salva é app.js (Minhas mesas).

const LIMIT = 120;

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
      emit(reason);
    },
    reset(next, reason = 'reset') {
      undo.length = 0;
      redo.length = 0;
      state = next;
      emit(reason);
    },
    undo() {
      if (!undo.length) return false;
      redo.push(state);
      state = undo.pop();
      emit('undo');
      return true;
    },
    redo() {
      if (!redo.length) return false;
      undo.push(state);
      state = redo.pop();
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
