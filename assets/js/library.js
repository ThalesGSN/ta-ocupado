// "Minhas mesas": várias mesas salvas no localStorage deste navegador.
// Cada mesa fica numa chave própria; um índice guarda a lista e a mesa aberta.
import { normalizeState } from './model.js';
import { compact } from './share.js';

const INDEX_KEY = 'ta-ocupado:mesas:v1';
const TABLE_PREFIX = 'ta-ocupado:mesa:';
const LEGACY_KEY = 'ta-ocupado:v1';
const MAX_TABLES = 200;

const store = () => globalThis.localStorage;

function readIndex() {
  try {
    const raw = store().getItem(INDEX_KEY);
    const idx = raw ? JSON.parse(raw) : null;
    if (idx && Array.isArray(idx.tables)) {
      idx.tables = idx.tables.filter((t) => t && typeof t.id === 'string');
      return idx;
    }
  } catch {
    /* índice corrompido: recomeça vazio */
  }
  return { activeId: null, tables: [] };
}

function writeIndex(idx) {
  store().setItem(INDEX_KEY, JSON.stringify(idx));
}

const serialize = (state) => JSON.stringify(compact(state));

function newId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function metaOf(state, percent) {
  return {
    title: state.title,
    people: state.people.filter((p) => p.present).length,
    seated: Object.keys(state.seating).length,
    percent: Number.isFinite(percent) ? percent : null,
  };
}

/** Lista as mesas, da editada mais recentemente para a mais antiga. */
export function listTables() {
  return readIndex().tables.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getActiveId() {
  const idx = readIndex();
  return idx.tables.some((t) => t.id === idx.activeId) ? idx.activeId : null;
}

export function setActive(id) {
  const idx = readIndex();
  idx.activeId = id;
  writeIndex(idx);
}

export function loadTable(id) {
  try {
    const raw = store().getItem(TABLE_PREFIX + id);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Salva a mesa `id` (cria a entrada se não existir). Pode lançar QuotaExceededError. */
export function saveTable(id, state, { percent, touch = true } = {}) {
  store().setItem(TABLE_PREFIX + id, serialize(state));
  const idx = readIndex();
  let entry = idx.tables.find((t) => t.id === id);
  const now = Date.now();
  if (!entry) {
    entry = { id, createdAt: now, updatedAt: now };
    idx.tables.push(entry);
  }
  Object.assign(entry, metaOf(state, percent ?? entry.percent));
  if (touch) entry.updatedAt = now;
  writeIndex(idx);
}

/** Cria uma mesa nova com o estado dado. Retorna o id. */
export function createTable(state, { percent, activate = true } = {}) {
  const idx = readIndex();
  if (idx.tables.length >= MAX_TABLES) throw new Error(`Você já tem ${MAX_TABLES} mesas salvas. Exclua algumas em Minhas mesas.`);
  const id = newId();
  saveTable(id, state, { percent });
  if (activate) setActive(id);
  return id;
}

export function renameTable(id, title) {
  const st = loadTable(id);
  if (!st) return false;
  st.title = title.trim().slice(0, 80) || st.title;
  saveTable(id, st, { touch: false });
  return st;
}

export function duplicateTable(id, title) {
  const st = loadTable(id);
  if (!st) return null;
  const entry = readIndex().tables.find((t) => t.id === id);
  st.title = (title || `${st.title} (cópia)`).slice(0, 80);
  return createTable(st, { percent: entry ? entry.percent : null, activate: false });
}

export function deleteTable(id) {
  store().removeItem(TABLE_PREFIX + id);
  const idx = readIndex();
  idx.tables = idx.tables.filter((t) => t.id !== id);
  if (idx.activeId === id) idx.activeId = null;
  writeIndex(idx);
}

/** Procura uma mesa salva com exatamente o mesmo conteúdo (evita duplicar links e o exemplo). */
export function findIdentical(state) {
  const target = serialize(state);
  for (const t of readIndex().tables) {
    if (store().getItem(TABLE_PREFIX + t.id) === target) return t.id;
  }
  return null;
}

/** Leva a mesa única das versões antigas para a lista. */
export function migrateLegacy() {
  let raw = null;
  try {
    raw = store().getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let id = null;
  try {
    const st = normalizeState(JSON.parse(raw));
    id = findIdentical(st) || createTable(st);
  } catch {
    /* dado antigo ilegível: descarta */
  }
  store().removeItem(LEGACY_KEY);
  return id;
}

/** Apaga todas as mesas deste navegador. */
export function clearAll() {
  const s = store();
  const keys = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && (k.startsWith(TABLE_PREFIX) || k === INDEX_KEY || k === LEGACY_KEY)) keys.push(k);
  }
  keys.forEach((k) => s.removeItem(k));
}

export const STORAGE_KEYS = { INDEX_KEY, TABLE_PREFIX, LEGACY_KEY };
