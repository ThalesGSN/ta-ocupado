// Avisos rápidos (toasts), anúncio para leitor de tela e confete.
import { h, reducedMotion } from './dom.js';

let live = null;

export function announce(text) {
  live = live || document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => (live.textContent = text), 30);
}

export function toast(text, { action, onAction, tone, ms = 3800 } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = h('div', { class: `toast${tone ? ` is-${tone}` : ''}`, role: tone === 'error' ? 'alert' : 'status' }, h('span', { text }));
  if (action && onAction) {
    el.append(
      h('button', {
        type: 'button',
        class: 'toast-action',
        text: action,
        onclick: () => {
          onAction();
          el.remove();
        },
      }),
    );
  }
  while (box.children.length >= 3) box.firstElementChild.remove();
  box.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

const COLORS = ['#C62839', '#F7C531', '#2F5DA9', '#2E8B57', '#FFF4DA', '#F29BB4'];

export function celebrate() {
  if (reducedMotion()) return;
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 90; i++) {
    const piece = h('span', { class: `bit${i % 3 === 0 ? ' round' : ''}` });
    piece.style.setProperty('--x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}vw`);
    piece.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty('--d', `${1.4 + Math.random() * 1.2}s`);
    piece.style.setProperty('--delay', `${Math.random() * 0.35}s`);
    piece.style.setProperty('--col', COLORS[i % COLORS.length]);
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 3200);
}
