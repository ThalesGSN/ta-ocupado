// Pequenos utilitários de DOM. Dados do usuário entram sempre como texto.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  setProps(el, props);
  append(el, children);
  return el;
}

export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  append(el, children);
  return el;
}

function setProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'vars') for (const [vk, vv] of Object.entries(v)) el.style.setProperty(vk, vv);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Ícones de traço simples (desenhados para esta app).
const ICONS = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  copy: 'M9 9h11v12H9ZM5 15V4a1 1 0 0 1 1-1h10',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  chevron: 'm7 10 5 5 5-5',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  sparkle: 'M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z',
  close: 'M6 6l12 12M18 6 6 18',
  pin: 'M9 4h6l-1 5 3 3H7l3-3-1-5ZM12 12v8',
  move: 'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4',
  out: 'M10 17l5-5-5-5M15 12H3M21 4v16',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M7 7l10 10M17 7 7 17',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7Z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  table: 'M3 10h18v4H3ZM6 6h.01M10 6h.01M14 6h.01M18 6h.01M6 18h.01M10 18h.01M14 18h.01M18 18h.01',
  seats: 'M4 12h16M7 8v8M17 8v8',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4ZM5 16a4 4 0 0 1 4-4h9',
  calendar: 'M4 6h16v14H4ZM4 10h16M9 3v5M15 3v5',
};

export function icon(name, size = 20) {
  return s(
    'svg',
    { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', class: 'icon', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: ICONS[name] || '' }),
  );
}
