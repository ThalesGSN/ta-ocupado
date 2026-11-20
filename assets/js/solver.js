// Sugestão automática de lugares por recozimento simulado (simulated annealing).
// Respeita lugares fixados e trata regras obrigatórias com penalidade alta.
import { compile, prefSatisfied, happinessSum } from './model.js';

const HARD = 1000;
const UNSEATED = 60;
const EMPTY_END_BONUS = 2;
const LEADER_SIDE_BY_SIDE = 0.6;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function personObjective(m, a, pos, occ) {
  let v = 0;
  const prefs = m.prefs[a];
  for (let i = 0; i < prefs.length; i++) {
    const pr = prefs[i];
    if (prefSatisfied(m, a, pr, pos, occ)) v += pr.w;
    else if (pr.hard) v -= HARD;
  }
  const s = pos[a];
  if (s < 0 || s >= m.S) return v - UNSEATED;
  const nb = m.geo.nbrs[s];
  const row = a * m.N;
  for (let i = 0; i < nb.length; i++) {
    const x = nb[i];
    const q = occ[x.s];
    if (q < 0) continue;
    let pair = m.aff[row + q];
    if (x.side && m.isLeader[a] && m.isLeader[q]) pair -= LEADER_SIDE_BY_SIDE;
    v += 0.5 * pair * x.w;
  }
  return v;
}

const seatBonus = (m, s, occ) => (s < m.S && occ[s] < 0 && m.geo.isEnd[s] ? EMPTY_END_BONUS : 0);

export function objective(m, pos, occ) {
  let v = 0;
  for (let a = 0; a < m.P.length; a++) v += personObjective(m, a, pos, occ);
  for (let s = 0; s < m.S; s++) v += seatBonus(m, s, occ);
  return v;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Sugere um arranjo. Retorna { seating, score, hardFails, percent, seed }.
 * opts.seed: semente; opts.iterations: iterações por rodada;
 * opts.restarts: máximo de rodadas; opts.budgetMs: tempo máximo aproximado.
 */
export function suggest(state, opts = {}) {
  const m = compile(state);
  const S = m.S;
  const Pn = m.P.length;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rnd = mulberry32(seed);
  const maxRestarts = opts.restarts ?? 6;
  const iterations = opts.iterations ?? Math.max(15000, 1200 * Pn);
  const budgetMs = opts.budgetMs ?? 1200;
  const started = now();

  const lockedSeats = new Set();
  const fixedOcc = new Int16Array(S).fill(-1);
  for (const id of state.locked) {
    const s = m.geo.index.get(id);
    if (s == null) continue;
    lockedSeats.add(s);
    const pid = state.seating[id];
    if (pid != null && m.idx.has(pid)) fixedOcc[s] = m.idx.get(pid);
  }
  const fixedPeople = new Set([...fixedOcc].filter((a) => a >= 0));
  const freeSeats = [];
  for (let s = 0; s < S; s++) if (!lockedSeats.has(s)) freeSeats.push(s);
  const movable = [];
  for (let a = 0; a < Pn; a++) if (!fixedPeople.has(a)) movable.push(a);
  const benchCount = Math.max(0, movable.length - freeSeats.length);
  const slots = freeSeats.concat(Array.from({ length: benchCount }, (_, k) => S + k));
  const slotCount = S + benchCount;

  if (!movable.length || !slots.length) {
    return { seating: { ...state.seating }, score: 0, hardFails: 0, percent: 100, seed };
  }

  // Pares de lugares lado a lado, ambos livres (para mover casais juntos).
  const pairs = [];
  for (let s = 0; s + 1 < S; s++) {
    const t = s + 1;
    if (Math.floor(s / m.geo.n) === Math.floor(t / m.geo.n) && !lockedSeats.has(s) && !lockedSeats.has(t)) pairs.push([s, t]);
  }

  const stamp = new Int32Array(Pn);
  let stampId = 1;
  const affected = [];
  function collect(occ, seats, count) {
    stampId++;
    affected.length = 0;
    for (let k = 0; k < count; k++) {
      const s = seats[k];
      const q0 = occ[s];
      if (q0 >= 0 && stamp[q0] !== stampId) { stamp[q0] = stampId; affected.push(q0); }
      if (s < S) {
        const nb = m.geo.nbrs[s];
        for (let i = 0; i < nb.length; i++) {
          const q = occ[nb[i].s];
          if (q >= 0 && stamp[q] !== stampId) { stamp[q] = stampId; affected.push(q); }
        }
      }
    }
    return affected;
  }
  function localScore(pos, occ, people, seats, count) {
    let v = 0;
    for (let i = 0; i < people.length; i++) v += personObjective(m, people[i], pos, occ);
    for (let k = 0; k < count; k++) v += seatBonus(m, seats[k], occ);
    return v;
  }
  function swapSlots(pos, occ, s, t) {
    const a = occ[s];
    const b = occ[t];
    occ[s] = b;
    occ[t] = a;
    if (a >= 0) pos[a] = t;
    if (b >= 0) pos[b] = s;
  }

  let best = null;
  let bestScore = -Infinity;
  const T0 = 3;
  const T1 = 0.03;
  const moveSeats = new Int32Array(4);
  const people = [];

  for (let r = 0; r < maxRestarts; r++) {
    const occ = new Int16Array(slotCount).fill(-1);
    const pos = new Int16Array(Pn).fill(-1);
    for (let s = 0; s < S; s++) {
      if (fixedOcc[s] >= 0) {
        occ[s] = fixedOcc[s];
        pos[fixedOcc[s]] = s;
      }
    }
    const order = shuffle(movable.slice(), rnd);
    const sl = shuffle(slots.slice(), rnd);
    order.forEach((a, k) => {
      occ[sl[k]] = a;
      pos[a] = sl[k];
    });
    let cur = objective(m, pos, occ);
    let runBest = cur;
    let runBestOcc = occ.slice();

    for (let it = 0; it < iterations; it++) {
      const T = T0 * Math.pow(T1 / T0, it / iterations);
      let count = 2;
      let block = false;
      let flipPair = false;
      let p1;
      let p2;
      if (pairs.length > 1 && rnd() < 0.3) {
        p1 = pairs[Math.floor(rnd() * pairs.length)];
        p2 = pairs[Math.floor(rnd() * pairs.length)];
        if (p1[0] === p2[0] || p1[0] === p2[1] || p1[1] === p2[0] || p1[1] === p2[1]) continue;
        block = true;
        flipPair = rnd() < 0.5;
        moveSeats[0] = p1[0];
        moveSeats[1] = p1[1];
        moveSeats[2] = p2[0];
        moveSeats[3] = p2[1];
        count = 4;
      } else {
        const s = slots[Math.floor(rnd() * slots.length)];
        const t = slots[Math.floor(rnd() * slots.length)];
        if (s === t || (occ[s] < 0 && occ[t] < 0)) continue;
        moveSeats[0] = s;
        moveSeats[1] = t;
      }
      const aff = collect(occ, moveSeats, count);
      people.length = 0;
      for (let i = 0; i < aff.length; i++) people.push(aff[i]);
      const before = localScore(pos, occ, people, moveSeats, count);
      if (block) {
        if (flipPair) {
          swapSlots(pos, occ, p1[0], p2[1]);
          swapSlots(pos, occ, p1[1], p2[0]);
        } else {
          swapSlots(pos, occ, p1[0], p2[0]);
          swapSlots(pos, occ, p1[1], p2[1]);
        }
      } else {
        swapSlots(pos, occ, moveSeats[0], moveSeats[1]);
      }
      const delta = localScore(pos, occ, people, moveSeats, count) - before;
      if (delta >= 0 || rnd() < Math.exp(delta / T)) {
        cur += delta;
        if (cur > runBest + 1e-9) {
          runBest = cur;
          runBestOcc = occ.slice();
        }
      } else if (block) {
        if (flipPair) {
          swapSlots(pos, occ, p1[1], p2[0]);
          swapSlots(pos, occ, p1[0], p2[1]);
        } else {
          swapSlots(pos, occ, p1[1], p2[1]);
          swapSlots(pos, occ, p1[0], p2[0]);
        }
      } else {
        swapSlots(pos, occ, moveSeats[0], moveSeats[1]);
      }
    }

    // Polimento: trocas gulosas até não melhorar mais.
    const occB = runBestOcc;
    const posB = new Int16Array(Pn).fill(-1);
    for (let s = 0; s < slotCount; s++) if (occB[s] >= 0) posB[occB[s]] = s;
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 20) {
      improved = false;
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const s = slots[i];
          const t = slots[j];
          if (occB[s] < 0 && occB[t] < 0) continue;
          moveSeats[0] = s;
          moveSeats[1] = t;
          const aff = collect(occB, moveSeats, 2);
          people.length = 0;
          for (let k = 0; k < aff.length; k++) people.push(aff[k]);
          const before = localScore(posB, occB, people, moveSeats, 2);
          swapSlots(posB, occB, s, t);
          const after = localScore(posB, occB, people, moveSeats, 2);
          if (after > before + 1e-9) improved = true;
          else swapSlots(posB, occB, s, t);
        }
      }
    }
    const final = objective(m, posB, occB);
    if (final > bestScore) {
      bestScore = final;
      best = { occ: occB.slice(), pos: posB.slice() };
    }
    // Para cedo se todo mundo já está feliz, ou se o tempo acabou.
    const h = happinessSum(m, best.pos, best.occ);
    if (h.got >= h.total && r >= 1) break;
    if (now() - started > budgetMs) break;
  }

  const seating = {};
  for (let s = 0; s < S; s++) {
    const a = best.occ[s];
    if (a >= 0) seating[m.geo.ids[s]] = m.P[a].id;
  }
  const h = happinessSum(m, best.pos, best.occ);
  return {
    seating,
    score: bestScore,
    hardFails: h.hardFails,
    percent: h.total ? (h.got >= h.total ? 100 : Math.min(99, Math.round((100 * h.got) / h.total))) : 100,
    seed,
  };
}
