// Link compartilhável e arquivos. Os dados vão no fragmento (#) da URL,
// que o navegador nunca envia ao servidor.
import { normalizeState } from './model.js';

export const HASH_KEY = 'm';
const MAX_PAYLOAD = 200000;

function toB64url(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Remove campos vazios para o link ficar curto. normalizeState recompõe tudo.
export function compact(state) {
  const people = state.people.map((p) => {
    const o = { id: p.id, name: p.name };
    for (const k of ['role', 'ministry', 'about', 'age', 'gender', 'food', 'partner']) if (p[k]) o[k] = p[k];
    for (const k of ['tags', 'wants', 'near', 'avoid']) if (p[k] && p[k].length) o[k] = p[k];
    if (p.present === false) o.present = false;
    return o;
  });
  const out = { app: 'ta-ocupado', version: 1, title: state.title, seatsPerSide: state.seatsPerSide, people, seating: state.seating };
  if (state.locked.length) out.locked = state.locked;
  if (Object.keys(state.tags).length) out.tags = state.tags;
  return out;
}

export async function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(compact(state)));
  if (typeof CompressionStream === 'function') {
    try {
      return 'z' + toB64url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch {
      /* cai para o formato sem compressão */
    }
  }
  return 'j' + toB64url(bytes);
}

export async function decodePayload(payload) {
  if (!payload || payload.length > MAX_PAYLOAD) throw new Error('O link está vazio ou grande demais.');
  const kind = payload[0];
  let bytes;
  try {
    bytes = fromB64url(payload.slice(1));
  } catch {
    throw new Error('O link está incompleto. Copie o link inteiro de novo.');
  }
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Este navegador é antigo demais para abrir o link. Atualize o navegador ou importe o arquivo .json.');
    }
    try {
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } catch {
      throw new Error('O link está incompleto. Copie o link inteiro de novo.');
    }
  } else if (kind !== 'j') {
    throw new Error('Este link não é de uma mesa do Tá ocupado?.');
  }
  let raw;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('O link está incompleto. Copie o link inteiro de novo.');
  }
  return normalizeState(raw);
}

export function readHashPayload(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h) return null;
  const params = new URLSearchParams(h);
  return params.get(HASH_KEY);
}

export async function shareUrl(state, base) {
  const payload = await encodeState(state);
  const url = new URL(base);
  url.hash = `${HASH_KEY}=${payload}`;
  return url.toString();
}

export function parseFileText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Não consegui ler o arquivo: ele não é um JSON válido.');
  }
  return normalizeState(raw);
}

export function fileName(state) {
  const slug = state.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `mesa-${slug || 'evento'}.json`;
}
