// Testes de "Minhas mesas" com um localStorage em memória (só dados fictícios).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState } from '../assets/js/model.js';
import { DEMO } from '../assets/js/demo.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
globalThis.localStorage = new MemoryStorage();
const lib = await import('../assets/js/library.js');

const demo = () => normalizeState(structuredClone(DEMO));
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

test('cria, lista e abre mesas', () => {
  const id = lib.createTable(demo(), { percent: 56 });
  assert.equal(lib.getActiveId(), id);
  const [t] = lib.listTables();
  assert.equal(t.title, DEMO.title);
  assert.equal(t.people, 14);
  assert.equal(t.percent, 56);
  assert.deepEqual(lib.loadTable(id).seating, demo().seating);
});

test('salvar atualiza a mesa e os dados da lista', () => {
  const id = lib.createTable(demo());
  const st = lib.loadTable(id);
  st.seating = { A0: 'aurora' };
  st.title = 'Versão 2';
  lib.saveTable(id, st, { percent: 12 });
  const t = lib.listTables()[0];
  assert.equal(t.title, 'Versão 2');
  assert.equal(t.seated, 1);
  assert.equal(t.percent, 12);
  assert.deepEqual(lib.loadTable(id).seating, { A0: 'aurora' });
});

test('duplicar guarda uma cópia sem trocar a mesa aberta', () => {
  const id = lib.createTable(demo());
  const copy = lib.duplicateTable(id);
  assert.notEqual(copy, id);
  assert.equal(lib.getActiveId(), id);
  assert.equal(lib.loadTable(copy).title, `${DEMO.title} (cópia)`);
  assert.equal(lib.listTables().length, 2);
});

test('renomear e excluir', () => {
  const a = lib.createTable(demo());
  const b = lib.duplicateTable(a);
  lib.renameTable(b, '  Sugestão 2  ');
  assert.equal(lib.loadTable(b).title, 'Sugestão 2');
  lib.deleteTable(a);
  assert.equal(lib.getActiveId(), null);
  assert.equal(lib.loadTable(a), null);
  assert.deepEqual(lib.listTables().map((t) => t.id), [b]);
});

test('acha mesa idêntica para não duplicar links e o exemplo', () => {
  const id = lib.createTable(demo());
  assert.equal(lib.findIdentical(demo()), id);
  const other = demo();
  other.seating = {};
  assert.equal(lib.findIdentical(other), null);
});

test('migra a mesa única das versões antigas', () => {
  localStorage.setItem('ta-ocupado:v1', JSON.stringify(demo()));
  const id = lib.migrateLegacy();
  assert.ok(id);
  assert.equal(localStorage.getItem('ta-ocupado:v1'), null);
  assert.equal(lib.getActiveId(), id);
  assert.equal(lib.migrateLegacy(), null);
});

test('apagar tudo remove só as chaves da app', () => {
  localStorage.setItem('outra-app', 'x');
  lib.createTable(demo());
  lib.createTable(demo());
  lib.clearAll();
  assert.equal(lib.listTables().length, 0);
  assert.equal(localStorage.getItem('outra-app'), 'x');
});

test('store: editar, desfazer e refazer', async () => {
  const { createStore } = await import('../assets/js/store.js');
  const st = createStore(demo());
  let calls = 0;
  st.subscribe(() => calls++);
  assert.equal(st.update((s) => { s.title = 'Nova'; }), true);
  assert.equal(st.get().title, 'Nova');
  assert.equal(st.undo(), true);
  assert.equal(st.get().title, DEMO.title);
  assert.equal(st.redo(), true);
  assert.equal(st.get().title, 'Nova');
  assert.equal(calls, 3);
});
