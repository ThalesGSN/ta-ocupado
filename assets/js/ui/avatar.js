import { h, s, icon } from './dom.js';

const PALETTE = ['#FFD3A3', '#CBE6AE', '#B7D5F2', '#F5BFD0', '#DED1F4', '#FFE597', '#BBE8DE', '#F1C6A4', '#D3E0FB', '#F9D0BE'];

export function colorFor(id) {
  let x = 0;
  for (const ch of id) x = (x * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[x % PALETTE.length];
}

export function initials(name) {
  const parts = name.trim().split(/\s+/);
  const first = Array.from(parts[0])[0] || '?';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
  return (first + last).toUpperCase();
}

const MOUTH = {
  happy: 'M6.1 11.1 Q10 15.6 13.9 11.1',
  ok: 'M6.7 12.7 H13.3',
  sad: 'M6.3 14.6 Q10 10.6 13.7 14.6',
  out: 'M7.2 12.9 H12.8',
};

export const MOOD_LABEL = {
  happy: 'feliz',
  ok: 'quase feliz',
  sad: 'infeliz',
  out: 'sem lugar',
};

export function moodFace(mood, size = 20) {
  return s(
    'svg',
    { viewBox: '0 0 20 20', width: size, height: size, class: `face face-${mood}`, 'aria-hidden': 'true' },
    s('circle', { cx: 10, cy: 10, r: 8.7, class: 'face-bg' }),
    s('circle', { cx: 7.2, cy: 8.1, r: 1.3, class: 'face-ink' }),
    s('circle', { cx: 12.8, cy: 8.1, r: 1.3, class: 'face-ink' }),
    s('path', { d: MOUTH[mood] || MOUTH.ok, class: 'face-mouth' }),
  );
}

export function createChip(person) {
  const token = h(
    'button',
    { type: 'button', class: 'token' },
    h('span', { class: 'ini', 'aria-hidden': 'true' }),
    h('span', { class: 'face-slot', 'aria-hidden': 'true' }),
    h('span', { class: 'pin', 'aria-hidden': 'true' }, icon('pin', 11)),
  );
  const chip = h('div', { class: 'pchip', dataset: { person: person.id } }, token, h('span', { class: 'pname' }));
  return chip;
}

/**
 * Atualiza a ficha. info = avaliação da pessoa (mood etc.).
 */
export function updateChip(chip, person, info, opts) {
  const token = chip.firstElementChild;
  const mood = info ? info.mood : 'out';
  const color = colorFor(person.id);
  if (chip.dataset.color !== color) {
    chip.style.setProperty('--c', color);
    chip.dataset.color = color;
  }
  chip.classList.toggle('is-leader', person.role === 'lider');
  chip.classList.toggle('is-selected', !!opts.selected);
  chip.classList.toggle('is-locked', !!opts.locked);
  chip.classList.toggle('is-absent', !person.present);
  chip.classList.toggle('is-broken', !!(info && info.hardFail));
  token.querySelector('.ini').textContent = initials(person.name);
  chip.querySelector('.pname').textContent = opts.shortName;
  if (chip.dataset.mood !== mood) {
    const slot = token.querySelector('.face-slot');
    slot.replaceChildren(moodFace(person.present ? mood : 'out', 20));
    chip.dataset.mood = mood;
  }
  const where = opts.seatLabel ? `, lugar ${opts.seatLabel}` : person.present ? ', fora da mesa' : ', não vai';
  token.setAttribute(
    'aria-label',
    `${person.name}${where}, ${person.present ? MOOD_LABEL[mood] : 'ausente'}${opts.locked ? ', lugar fixado' : ''}`,
  );
  token.setAttribute('aria-pressed', opts.selected ? 'true' : 'false');
}

export function bigAvatar(person, mood) {
  return h(
    'div',
    { class: `big-avatar${person.role === 'lider' ? ' is-leader' : ''}`, vars: { '--c': colorFor(person.id) }, 'aria-hidden': 'true' },
    h('span', { class: 'ini', text: initials(person.name) }),
    h('span', { class: 'face-slot' }, moodFace(mood, 26)),
  );
}
