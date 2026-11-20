// Modelo da mesa: geometria dos lugares, preferências de cada pessoa e
// cálculo de felicidade. Não depende do DOM, roda no navegador e no Node.
import { DEFAULT_TAGS, AGE_BANDS, ROLES } from './tags.js';

export const SIDES = ['A', 'B'];
export const MAX_PEOPLE = 300;
export const MAX_SEATS_PER_SIDE = 60;
export const REL_WEIGHT = { side: 1, front: 0.8, diag: 0.5 };
export const REL_LABEL = { side: 'ao lado', front: 'em frente', diag: 'na diagonal' };

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/i;

// Frases das preferências por assunto ("Papo de tecnologia").
const WANT_PHRASES = {
  casados: 'Outros casados por perto',
  jovens: 'Gente jovem por perto',
  estudos: 'Outro estudante por perto',
  adolescentes: 'Outro adolescente por perto',
};

export const seatId = (side, i) => `${side}${i}`;

export function parseSeat(id) {
  const m = /^([AB])(\d{1,3})$/.exec(String(id));
  return m ? { side: m[1], i: Number(m[2]) } : null;
}

export const seatLabel = (id) => {
  const p = parseSeat(id);
  return p ? `${p.side}${p.i + 1}` : '';
};

// Lugares: A0..A(n-1) de um lado, B0..B(n-1) do outro. B_i fica em frente de A_i.
export function geometry(n) {
  const ids = [];
  for (const side of SIDES) for (let i = 0; i < n; i++) ids.push(seatId(side, i));
  const index = new Map(ids.map((id, k) => [id, k]));
  const nbrs = ids.map((_, k) => {
    const side = k < n ? 0 : 1;
    const i = k % n;
    const base = side * n;
    const other = (1 - side) * n;
    const list = [];
    const add = (s, rel) => list.push({ s, rel, w: REL_WEIGHT[rel], side: rel === 'side' });
    if (i > 0) add(base + i - 1, 'side');
    if (i < n - 1) add(base + i + 1, 'side');
    add(other + i, 'front');
    if (i > 0) add(other + i - 1, 'diag');
    if (i < n - 1) add(other + i + 1, 'diag');
    return list;
  });
  const isEnd = ids.map((_, k) => k % n === 0 || k % n === n - 1);
  return { n, ids, index, nbrs, isEnd };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function uniqStrings(v, max) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export function slugify(s) {
  const base = String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'pessoa';
}

export function uniqueId(base, taken) {
  let id = base;
  let k = 2;
  while (taken.has(id)) id = `${base}-${k++}`;
  return id;
}

// Valida e limpa qualquer estado vindo de arquivo, link ou localStorage.
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('O arquivo não tem o formato de uma mesa.');
  }
  const tags = {};
  if (raw.tags && typeof raw.tags === 'object') {
    for (const [k, v] of Object.entries(raw.tags).slice(0, 100)) {
      if (!ID_RE.test(k) || !v || typeof v !== 'object') continue;
      tags[k] = { label: str(v.label, 40) || k, icon: str(v.icon, 8) || '🏷️' };
    }
  }

  const people = [];
  const taken = new Set();
  const list = Array.isArray(raw.people) ? raw.people.slice(0, MAX_PEOPLE) : [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const name = str(p.name, 60);
    if (!name) continue;
    const wanted = typeof p.id === 'string' && ID_RE.test(p.id) ? p.id : slugify(name);
    const id = uniqueId(wanted, taken);
    taken.add(id);
    people.push({
      id,
      name,
      role: Object.hasOwn(ROLES, p.role) ? p.role : 'membro',
      ministry: str(p.ministry, 60),
      about: str(p.about, 120),
      age: AGE_BANDS.includes(p.age) ? p.age : '',
      gender: p.gender === 'f' || p.gender === 'm' ? p.gender : '',
      food: str(p.food, 60),
      tags: uniqStrings(p.tags, 20).filter((t) => ID_RE.test(t)),
      wants: uniqStrings(p.wants, 4).filter((t) => ID_RE.test(t)),
      partner: typeof p.partner === 'string' ? p.partner : '',
      near: uniqStrings(p.near, 10),
      avoid: uniqStrings(p.avoid, 10),
      present: p.present !== false,
    });
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  for (const p of people) {
    if (p.partner && (!byId.has(p.partner) || p.partner === p.id)) p.partner = '';
    p.near = p.near.filter((x) => byId.has(x) && x !== p.id);
    p.avoid = p.avoid.filter((x) => byId.has(x) && x !== p.id);
  }
  // Casal é simétrico: se A aponta B e B não aponta ninguém, completa.
  for (const p of people) {
    if (!p.partner) continue;
    const q = byId.get(p.partner);
    if (!q.partner) q.partner = p.id;
    else if (q.partner !== p.id) p.partner = '';
  }
  for (const p of people) {
    for (const t of [...p.tags, ...p.wants]) {
      if (!Object.hasOwn(DEFAULT_TAGS, t) && !tags[t]) tags[t] = { label: t, icon: '🏷️' };
    }
  }

  const presentCount = people.filter((p) => p.present).length;
  let seatsPerSide = Number.isInteger(raw.seatsPerSide)
    ? raw.seatsPerSide
    : Math.ceil(presentCount / 2);
  seatsPerSide = Math.min(MAX_SEATS_PER_SIDE, Math.max(1, seatsPerSide || 1));

  const seating = {};
  const placed = new Set();
  if (raw.seating && typeof raw.seating === 'object') {
    for (const [seat, pid] of Object.entries(raw.seating)) {
      const ps = parseSeat(seat);
      if (!ps || ps.i >= seatsPerSide) continue;
      if (typeof pid !== 'string' || !byId.has(pid) || placed.has(pid)) continue;
      if (!byId.get(pid).present) continue;
      seating[seatId(ps.side, ps.i)] = pid;
      placed.add(pid);
    }
  }
  const locked = uniqStrings(raw.locked, 2 * seatsPerSide).filter((s) => {
    const ps = parseSeat(s);
    return ps && ps.i < seatsPerSide && seating[s];
  });

  return {
    app: 'ta-ocupado',
    version: 1,
    title: str(raw.title, 80) || 'Minha mesa',
    seatsPerSide,
    tags,
    people,
    seating,
    locked,
  };
}

export function emptyState(title = 'Minha mesa') {
  return normalizeState({ title, people: [], seatsPerSide: 4 });
}

export const isTeen = (p) => p.age === '13–17';

export function allTags(state) {
  return { ...DEFAULT_TAGS, ...state.tags };
}

// Nome curto para a etiqueta do lugar. Nomes longos viram "Primeiro S.",
// e primeiros nomes repetidos ganham a inicial do sobrenome.
export function shortNames(people) {
  const firstCount = new Map();
  for (const p of people) {
    const first = p.name.split(/\s+/)[0].toLowerCase();
    firstCount.set(first, (firstCount.get(first) || 0) + 1);
  }
  const out = new Map();
  for (const p of people) {
    const parts = p.name.split(/\s+/);
    const first = parts[0];
    const dup = firstCount.get(first.toLowerCase()) > 1;
    if (p.name.length <= 12 && !(dup && parts.length === 1)) out.set(p.id, p.name);
    else if (parts.length > 1) out.set(p.id, `${first} ${parts[parts.length - 1][0]}.`);
    else out.set(p.id, p.name);
  }
  return out;
}

export function buildContext(state) {
  const present = state.people.filter((p) => p.present);
  const byId = new Map(state.people.map((p) => [p.id, p]));
  const teens = present.filter(isTeen);
  const teenLeader = present.find((p) => p.role === 'lider' && /adolesc/i.test(p.ministry)) || null;
  const names = shortNames(state.people);
  return { state, present, byId, teens, teenLeader, names, tags: allTags(state) };
}

function wantPhrase(tags, t) {
  if (WANT_PHRASES[t]) return WANT_PHRASES[t];
  const info = tags[t] || { label: t };
  return `Papo de ${info.label.toLowerCase()}`;
}

// Preferências de uma pessoa, derivadas dos dados. `hard` = regra obrigatória.
export function derivePrefs(p, ctx) {
  const prefs = [];
  const nm = (id) => ctx.names.get(id) || id;
  const isPresent = (id) => ctx.byId.get(id)?.present;
  const leaders = ctx.present.filter((q) => q.role === 'lider');

  if (p.partner && isPresent(p.partner)) {
    prefs.push({ kind: 'beside', target: p.partner, hard: true, w: 10, icon: '❤️', label: `Ao lado de ${nm(p.partner)}` });
  }
  if (isTeen(p) && ctx.teenLeader && ctx.teenLeader.id !== p.id) {
    const beside = ctx.teens.length <= 2;
    prefs.push({
      kind: beside ? 'beside' : 'near',
      target: ctx.teenLeader.id,
      hard: true,
      w: 10,
      icon: '🛹',
      label: `${beside ? 'Ao lado' : 'Perto'} de ${nm(ctx.teenLeader.id)}, líder dos adolescentes`,
    });
  }
  if (ctx.teenLeader && ctx.teenLeader.id === p.id && ctx.teens.length) {
    prefs.push({
      kind: 'nearAll',
      who: ctx.teens.map((t) => t.id),
      hard: true,
      w: 10,
      icon: '🛹',
      label: ctx.teens.length === 1 ? `Perto de ${nm(ctx.teens[0].id)}, a adolescente da mesa` : 'Perto dos adolescentes',
    });
  }
  for (const t of p.near) {
    if (isPresent(t)) prefs.push({ kind: 'near', target: t, w: 5, icon: '🏠', label: `Perto de ${nm(t)}` });
  }
  for (const t of p.avoid) {
    if (isPresent(t)) prefs.push({ kind: 'apart', target: t, w: 5, icon: '🙅', label: `Longe de ${nm(t)}` });
  }
  for (const t of p.wants) {
    const info = ctx.tags[t] || { icon: '🏷️' };
    prefs.push({ kind: 'nearTag', tag: t, w: 4, icon: info.icon, label: wantPhrase(ctx.tags, t) });
  }
  if (p.role === 'lider') {
    const g = /homens/i.test(p.ministry) ? 'm' : /mulheres/i.test(p.ministry) ? 'f' : '';
    const pool = ctx.present.filter((q) => q.role !== 'lider' && (!g || q.gender === g));
    if (pool.length) {
      prefs.push({
        kind: 'nearRole',
        roles: ['membro', 'convidado'],
        gender: g,
        w: 3,
        icon: '👋',
        label: g === 'm' ? 'Conhecer um dos novos irmãos' : g === 'f' ? 'Conhecer uma das novas irmãs' : 'Conhecer alguém novo',
      });
    }
  } else if (leaders.length) {
    prefs.push({ kind: 'nearRole', roles: ['lider'], gender: '', w: 3, icon: '🧭', label: 'Um líder por perto' });
  }
  return prefs;
}

// Versão indexada do estado, usada pela avaliação e pelo otimizador.
const KIND = { beside: 0, near: 1, apart: 2, nearTag: 3, nearRole: 4, nearAll: 5 };
const ROLE_CODE = { lider: 1, membro: 2, convidado: 4 };
const GENDER_CODE = { '': 0, f: 1, m: 2 };

export function compile(state) {
  const ctx = buildContext(state);
  const geo = geometry(state.seatsPerSide);
  const P = ctx.present;
  const N = P.length;
  const idx = new Map(P.map((p, k) => [p.id, k]));
  const tagIds = new Map();
  for (const p of P) for (const t of p.tags) if (!tagIds.has(t)) tagIds.set(t, tagIds.size);
  for (const p of P) for (const t of p.wants) if (!tagIds.has(t)) tagIds.set(t, tagIds.size);
  const T = Math.max(1, tagIds.size);
  const tagMatrix = new Uint8Array(N * T);
  P.forEach((p, a) => p.tags.forEach((t) => { tagMatrix[a * T + tagIds.get(t)] = 1; }));
  const role = P.map((p) => p.role);
  const roleCode = Uint8Array.from(P, (p) => ROLE_CODE[p.role] || 2);
  const isLeader = Uint8Array.from(P, (p) => (p.role === 'lider' ? 1 : 0));
  const genderCode = Uint8Array.from(P, (p) => GENDER_CODE[p.gender] || 0);
  const ministry = P.map((p) => p.ministry.trim().toLowerCase());
  const partner = Int16Array.from(P, (p) => (p.partner && idx.has(p.partner) ? idx.get(p.partner) : -1));
  const prefs = P.map((p) =>
    derivePrefs(p, ctx).map((pr) => ({
      ...pr,
      k: KIND[pr.kind],
      t: pr.target != null ? idx.get(pr.target) : -1,
      tg: pr.tag != null ? tagIds.get(pr.tag) : -1,
      roleMask: pr.roles ? pr.roles.reduce((m, r) => m | (ROLE_CODE[r] || 0), 0) : 0,
      genderCode: GENDER_CODE[pr.gender || ''] || 0,
      whoIdx: pr.who ? pr.who.map((id) => idx.get(id)) : null,
    })),
  );
  // Afinidade entre pares (assuntos em comum, sem contar o próprio par).
  const aff = new Float32Array(N * N);
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      if (a === b || partner[a] === b) continue;
      let shared = 0;
      for (let t = 0; t < T; t++) if (tagMatrix[a * T + t] && tagMatrix[b * T + t]) shared++;
      let v = 0.2 * shared;
      if (isLeader[a] && isLeader[b] && ministry[a] && ministry[a] === ministry[b]) v -= 1.5;
      aff[a * N + b] = v;
    }
  }
  return { state, ctx, geo, S: geo.ids.length, P, N, T, idx, tagMatrix, role, roleCode, isLeader, genderCode, ministry, partner, prefs, aff };
}

export function placement(m, seating) {
  const occ = new Int16Array(m.S).fill(-1);
  const pos = new Int16Array(m.P.length).fill(-1);
  for (const [seat, pid] of Object.entries(seating || {})) {
    const s = m.geo.index.get(seat);
    const a = m.idx.get(pid);
    if (s == null || a == null || occ[s] >= 0 || pos[a] >= 0) continue;
    occ[s] = a;
    pos[a] = s;
  }
  return { occ, pos };
}

const seated = (m, s) => s >= 0 && s < m.S;

export function prefSatisfied(m, a, pr, pos, occ) {
  const s = pos[a];
  if (!seated(m, s)) return pr.k === 2;
  const nb = m.geo.nbrs[s];
  switch (pr.k) {
    case 0: {
      const ts = pos[pr.t];
      if (!seated(m, ts)) return false;
      for (let i = 0; i < nb.length; i++) if (nb[i].side && nb[i].s === ts) return true;
      return false;
    }
    case 1: {
      const ts = pos[pr.t];
      if (!seated(m, ts)) return false;
      for (let i = 0; i < nb.length; i++) if (nb[i].s === ts) return true;
      return false;
    }
    case 2: {
      const ts = pos[pr.t];
      if (!seated(m, ts)) return true;
      for (let i = 0; i < nb.length; i++) if (nb[i].s === ts) return false;
      return true;
    }
    case 3: {
      const base = pr.tg;
      if (base < 0) return false;
      const partner = m.partner[a];
      for (let i = 0; i < nb.length; i++) {
        const q = occ[nb[i].s];
        if (q >= 0 && q !== partner && m.tagMatrix[q * m.T + base]) return true;
      }
      return false;
    }
    case 4: {
      const partner = m.partner[a];
      for (let i = 0; i < nb.length; i++) {
        const q = occ[nb[i].s];
        if (q >= 0 && q !== partner && m.roleCode[q] & pr.roleMask && (!pr.genderCode || m.genderCode[q] === pr.genderCode)) return true;
      }
      return false;
    }
    case 5: {
      for (const t of pr.whoIdx) {
        const ts = pos[t];
        if (!seated(m, ts)) return false;
        let ok = false;
        for (let i = 0; i < nb.length; i++) if (nb[i].s === ts) { ok = true; break; }
        if (!ok) return false;
      }
      return true;
    }
    default:
      return false;
  }
}

// Soma de felicidade (o mesmo número que aparece na tela).
export function happinessSum(m, pos, occ) {
  let got = 0;
  let total = 0;
  let hardFails = 0;
  for (let a = 0; a < m.P.length; a++) {
    const prefs = m.prefs[a];
    const isSeated = seated(m, pos[a]);
    if (!prefs.length) {
      total += 1;
      if (isSeated) got += 1;
      continue;
    }
    for (const pr of prefs) {
      total += pr.w;
      if (prefSatisfied(m, a, pr, pos, occ)) got += pr.w;
      else if (pr.hard) hardFails++;
    }
  }
  return { got, total, hardFails };
}

export function percentOf(got, total) {
  if (!total) return 100;
  if (got >= total) return 100;
  return Math.min(99, Math.round((100 * got) / total));
}

function sharedTags(m, a, b) {
  if (m.partner[a] === b) return [];
  return m.P[a].tags.filter((t) => m.P[b].tags.includes(t));
}

// Avaliação completa para a interface.
export function evaluate(state, m = compile(state)) {
  const { occ, pos } = placement(m, state.seating);
  const persons = new Map();
  const counts = { happy: 0, ok: 0, sad: 0, out: 0 };
  const hardBroken = [];
  m.P.forEach((p, a) => {
    const isSeated = pos[a] >= 0;
    const prefs = m.prefs[a].map((pr) => ({ ...pr, sat: prefSatisfied(m, a, pr, pos, occ) }));
    const tw = prefs.reduce((s, x) => s + x.w, 0);
    const gw = prefs.reduce((s, x) => s + (x.sat ? x.w : 0), 0);
    const hardFail = prefs.some((x) => x.hard && !x.sat);
    const ratio = tw ? gw / tw : isSeated ? 1 : 0;
    let mood = 'sad';
    if (!isSeated) mood = 'out';
    else if (!hardFail && ratio >= 0.999) mood = 'happy';
    else if (!hardFail && ratio >= 0.5) mood = 'ok';
    counts[mood]++;
    if (hardFail) hardBroken.push(p.id);
    const neighbors = isSeated
      ? m.geo.nbrs[pos[a]]
          .filter((x) => occ[x.s] >= 0)
          .map((x) => ({ id: m.P[occ[x.s]].id, rel: x.rel, seat: m.geo.ids[x.s], shared: sharedTags(m, a, occ[x.s]) }))
      : [];
    persons.set(p.id, { prefs, ratio, mood, hardFail, seat: isSeated ? m.geo.ids[pos[a]] : null, neighbors });
  });
  const { got, total } = happinessSum(m, pos, occ);
  return {
    persons,
    counts,
    hardBroken,
    got,
    total,
    percent: percentOf(got, total),
    seated: m.P.length - counts.out,
    present: m.P.length,
    seats: m.S,
  };
}

// Variação de felicidade se `pid` for para cada lugar (usada nas dicas do arrastar).
export function moveHints(state, pid) {
  const m = compile(state);
  const a = m.idx.get(pid);
  if (a == null) return new Map();
  const { occ, pos } = placement(m, state.seating);
  const base = happinessSum(m, pos, occ);
  const from = pos[a];
  const locked = new Set(state.locked);
  const out = new Map();
  for (let s = 0; s < m.S; s++) {
    if (s === from || locked.has(m.geo.ids[s])) continue;
    const other = occ[s];
    // aplica
    occ[s] = a;
    pos[a] = s;
    if (from >= 0) occ[from] = other;
    if (other >= 0) pos[other] = from;
    const r = happinessSum(m, pos, occ);
    // desfaz
    occ[s] = other;
    if (other >= 0) pos[other] = s;
    if (from >= 0) occ[from] = a;
    pos[a] = from;
    out.set(m.geo.ids[s], {
      delta: base.total ? (100 * (r.got - base.got)) / base.total : 0,
      hardDelta: r.hardFails - base.hardFails,
    });
  }
  return out;
}
