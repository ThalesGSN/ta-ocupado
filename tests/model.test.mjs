// Testes do modelo e do otimizador (só dados fictícios).
// Rode com: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, evaluate, geometry, shortNames, moveHints } from '../assets/js/model.js';
import { suggest } from '../assets/js/solver.js';
import { encodeState, decodePayload, readHashPayload } from '../assets/js/share.js';
import { DEMO } from '../assets/js/demo.js';

const demo = () => normalizeState(structuredClone(DEMO));

test('geometria: vizinhos ao lado, em frente e na diagonal', () => {
  const g = geometry(4);
  const a1 = g.index.get('A1');
  const rel = Object.fromEntries(g.nbrs[a1].map((x) => [g.ids[x.s], x.rel]));
  assert.deepEqual(rel, { A0: 'side', A2: 'side', B1: 'front', B0: 'diag', B2: 'diag' });
  assert.equal(g.nbrs[g.index.get('A0')].length, 3);
});

test('normalizeState limpa dados ruins e completa pares', () => {
  const st = normalizeState({
    title: '  Teste  ',
    people: [
      { name: 'Ana', partner: 'beto' },
      { id: 'beto', name: 'Beto' },
      { name: '' },
      { name: 'Caio', role: 'chefe', age: '200', tags: ['ok', 'não ok!'], near: ['fantasma'] },
    ],
    seating: { A0: 'ana', Z9: 'beto', A1: 'ana' },
    seatsPerSide: 2,
  });
  assert.equal(st.title, 'Teste');
  assert.equal(st.people.length, 3);
  assert.equal(st.people.find((p) => p.id === 'beto').partner, 'ana');
  const caio = st.people.find((p) => p.name === 'Caio');
  assert.equal(caio.role, 'membro');
  assert.equal(caio.age, '');
  assert.deepEqual(caio.tags, ['ok']);
  assert.deepEqual(caio.near, []);
  assert.deepEqual(st.seating, { A0: 'ana' });
});

test('nomes curtos diferenciam primeiros nomes repetidos', () => {
  const names = shortNames([
    { id: 'a', name: 'Rosa Quintana' },
    { id: 'b', name: 'Rosa Bragança' },
    { id: 'c', name: 'Zé' },
    { id: 'd', name: 'Bartolomeu Gusmão' },
  ]);
  assert.equal(names.get('a'), 'Rosa Q.');
  assert.equal(names.get('c'), 'Zé');
  assert.equal(names.get('d'), 'Bartolomeu G.');
});

test('o exemplo começa bagunçado, com regras quebradas', () => {
  const ev = evaluate(demo());
  assert.ok(ev.percent < 80);
  assert.ok(ev.hardBroken.includes('lara'));
  assert.ok(ev.hardBroken.includes('elisa'));
});

test('a sugestão cumpre todas as regras obrigatórias', () => {
  for (const seed of [1, 2, 3]) {
    const st = demo();
    const r = suggest(st, { seed });
    st.seating = r.seating;
    const ev = evaluate(st);
    assert.equal(ev.hardBroken.length, 0, `semente ${seed}`);
    assert.equal(ev.counts.out, 0);
    // casal lado a lado
    const g = geometry(st.seatsPerSide);
    const seatOf = (id) => Object.keys(st.seating).find((k) => st.seating[k] === id);
    const sideNbrs = g.nbrs[g.index.get(seatOf('elisa'))].filter((x) => x.rel === 'side').map((x) => g.ids[x.s]);
    assert.ok(sideNbrs.includes(seatOf('fabio')));
  }
});

test('lugar fixado não muda na sugestão', () => {
  const st = demo();
  st.seating = { A3: 'miguel' };
  st.locked = ['A3'];
  const r = suggest(normalizeState(st), { seed: 5 });
  assert.equal(r.seating.A3, 'miguel');
});

test('dicas de arrasto apontam algum lugar melhor', () => {
  const hints = moveHints(demo(), 'fabio');
  const best = [...hints.values()].some((h) => h.delta > 0 || h.hardDelta < 0);
  assert.ok(best);
});

test('link compartilhável vai e volta sem perder nada', async () => {
  const st = demo();
  st.locked = ['A0'];
  const payload = await encodeState(st);
  assert.match(payload, /^[zj][A-Za-z0-9_-]+$/);
  const back = await decodePayload(payload);
  assert.deepEqual(back.seating, st.seating);
  assert.deepEqual(back.locked, st.locked);
  assert.deepEqual(back.people, st.people);
  assert.equal(readHashPayload(`#m=${payload}`), payload);
});

test('link quebrado dá erro claro', async () => {
  await assert.rejects(() => decodePayload('zAAAA'), /incompleto/);
  await assert.rejects(() => decodePayload('x123'), /não é de uma mesa/);
});
