// Mesa + área "fora da mesa": desenho, animações e arrastar e soltar.
import { h, reducedMotion } from './dom.js';
import { createChip, updateChip } from './avatar.js';
import { seatId, seatLabel, parseSeat } from '../model.js';
import { foodIcon } from '../tags.js';

const SEAT_MIN = 72;
const SEAT_MAX = 88;

export class Board {
  /**
   * api: { onTap(pid), onDrop(pid, fromSeat|null, toSeat|null), hints(pid) -> Map, onSeatPick(seatId|null),
   *        onLockedDrag(pid) }
   */
  constructor({ table, bench, absent }, api) {
    this.tableRoot = table;
    this.benchRoot = bench;
    this.absentRoot = absent;
    this.api = api;
    this.chips = new Map();
    this.n = 0;
    this.horizontal = null;
    this.locked = new Set();
    this.pendingFlip = null;
    this.state = null;

    this.wrap = h('div', { class: 'table-wrap' });
    this.sideA = h('div', { class: 'side side-a', role: 'group', 'aria-label': 'Lado A da mesa' });
    this.sideB = h('div', { class: 'side side-b', role: 'group', 'aria-label': 'Lado B da mesa' });
    this.platesA = h('div', { class: 'plates plates-a' });
    this.platesB = h('div', { class: 'plates plates-b' });
    this.cloth = h('div', { class: 'cloth', 'aria-hidden': 'true' }, this.platesA, this.platesB);
    this.wrap.append(this.sideA, this.cloth, this.sideB);
    this.tableRoot.append(this.wrap);

    this.benchList = this.benchRoot.querySelector('[data-chips]');
    this.absentList = this.absentRoot.querySelector('[data-chips]');

    this.tableRoot.addEventListener('click', (e) => {
      const seat = e.target.closest('[data-seat]');
      if (!seat || e.target.closest('.token')) return;
      this.api.onSeatPick(seat.dataset.seat);
    });
    this.tableRoot.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-seat][tabindex]')) {
        e.preventDefault();
        this.api.onSeatPick(e.target.dataset.seat);
      }
    });
    this.benchRoot.addEventListener('click', (e) => {
      if (e.target.closest('.token')) return;
      if (this.moveMode) this.api.onSeatPick(null);
    });
    document.addEventListener('click', (e) => {
      const token = e.target.closest('.token');
      if (!token || !this.owns(token)) return;
      if (this.drag.consumeClick()) return;
      this.api.onTap(token.closest('.pchip').dataset.person);
    });

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.tableRoot);
    this.drag = new DragController(this);
  }

  owns(el) {
    return this.tableRoot.contains(el) || this.benchRoot.contains(el) || this.absentRoot.contains(el);
  }

  isLocked(seat) {
    return !!seat && this.locked.has(seat);
  }

  chipFor(person) {
    let chip = this.chips.get(person.id);
    if (!chip) {
      chip = createChip(person);
      this.chips.set(person.id, chip);
    }
    return chip;
  }

  buildSeats(n) {
    this.n = n;
    this.wrap.style.setProperty('--n', n);
    for (const [side, root, plates] of [['A', this.sideA, this.platesA], ['B', this.sideB, this.platesB]]) {
      root.replaceChildren();
      plates.replaceChildren();
      for (let i = 0; i < n; i++) {
        const id = seatId(side, i);
        root.append(
          h(
            'div',
            { class: 'seat', dataset: { seat: id } },
            h('span', { class: 'chair', 'aria-hidden': 'true' }, h('span', { class: 'chair-num', text: seatLabel(id) })),
            h('span', { class: 'heart', 'aria-hidden': 'true', text: '❤' }),
            h('span', { class: 'hint', 'aria-hidden': 'true' }),
          ),
        );
        plates.append(h('span', { class: 'plate', dataset: { seat: id } }, h('span', { class: 'food' })));
      }
    }
  }

  seatEl(id) {
    const p = parseSeat(id);
    if (!p) return null;
    return (p.side === 'A' ? this.sideA : this.sideB).children[p.i] || null;
  }

  layout() {
    if (!this.n) return;
    const width = this.tableRoot.clientWidth;
    const horizontal = width >= this.n * SEAT_MIN + 40;
    const seatW = horizontal ? Math.min(SEAT_MAX, Math.floor((width - 40) / this.n)) : SEAT_MIN;
    this.wrap.style.setProperty('--seat-w', `${seatW}px`);
    if (horizontal !== this.horizontal) {
      this.horizontal = horizontal;
      this.wrap.classList.toggle('horizontal', horizontal);
      this.wrap.classList.toggle('vertical', !horizontal);
    }
  }

  measure() {
    const out = new Map();
    for (const [pid, chip] of this.chips) if (chip.isConnected) out.set(pid, chip.getBoundingClientRect());
    return out;
  }

  /**
   * ui: { selected, moveMode, names: Map, ev }
   */
  render(state, ev, ui) {
    const first = this.measure();
    this.state = state;
    this.moveMode = ui.moveMode;
    this.locked = new Set(state.locked);
    if (state.seatsPerSide !== this.n) {
      this.buildSeats(state.seatsPerSide);
      this.horizontal = null;
      this.layout();
    }
    const byId = new Map(state.people.map((p) => [p.id, p]));
    const selInfo = ui.selected ? ev.persons.get(ui.selected) : null;
    const nearSeats = new Map();
    if (selInfo) {
      for (const nb of selInfo.neighbors) {
        const good = selInfo.prefs.some((pr) => pr.sat && prefMatches(pr, nb.id, byId));
        nearSeats.set(nb.seat, good);
      }
    }

    const used = new Set();
    for (let k = 0; k < 2 * this.n; k++) {
      const side = k < this.n ? 'A' : 'B';
      const i = k % this.n;
      const id = seatId(side, i);
      const seat = this.seatEl(id);
      const pid = state.seating[id];
      const person = pid ? byId.get(pid) : null;
      const current = seat.querySelector('.pchip');
      if (person) {
        const chip = this.chipFor(person);
        updateChip(chip, person, ev.persons.get(pid), {
          shortName: ui.names.get(pid),
          selected: ui.selected === pid,
          locked: this.locked.has(id),
          seatLabel: seatLabel(id),
        });
        if (current !== chip) {
          if (current) current.remove();
          seat.append(chip);
        }
        used.add(pid);
      } else if (current) {
        current.remove();
      }
      const partnerNext = person && person.partner && i < this.n - 1 && state.seating[seatId(side, i + 1)] === person.partner;
      seat.classList.toggle('is-empty', !person);
      seat.classList.toggle('is-locked', this.locked.has(id));
      seat.classList.toggle('pair-next', !!partnerNext);
      seat.classList.toggle('is-near', nearSeats.has(id));
      seat.classList.toggle('is-good', nearSeats.get(id) === true);
      const canPick = !!ui.moveMode && !this.locked.has(id) && pid !== ui.moveMode;
      seat.classList.toggle('is-target', canPick);
      if (canPick) {
        seat.tabIndex = 0;
        seat.setAttribute('role', 'button');
        seat.setAttribute('aria-label', person ? `Lugar ${seatLabel(id)}, trocar com ${person.name}` : `Lugar ${seatLabel(id)}, vazio`);
      } else {
        seat.removeAttribute('tabindex');
        seat.removeAttribute('role');
        seat.removeAttribute('aria-label');
      }
      const plate = (side === 'A' ? this.platesA : this.platesB).children[i];
      const food = person && person.food ? foodIcon(person.food) : '';
      plate.firstElementChild.textContent = food;
      plate.classList.toggle('has-food', !!food);
      if (food) plate.title = `${person.name} vai levar: ${person.food}`;
      else plate.removeAttribute('title');
    }

    const benchPeople = state.people.filter((p) => p.present && !used.has(p.id));
    const absentPeople = state.people.filter((p) => !p.present);
    this.fillList(this.benchList, benchPeople, ev, ui);
    this.fillList(this.absentList, absentPeople, ev, ui);
    this.benchRoot.classList.toggle('is-empty', benchPeople.length === 0);
    this.benchRoot.classList.toggle('is-target', !!ui.moveMode);
    this.benchRoot.querySelector('h2').dataset.count = String(benchPeople.length);
    this.absentRoot.hidden = absentPeople.length === 0;
    this.absentRoot.querySelector('h2').dataset.count = String(absentPeople.length);

    for (const [pid, chip] of this.chips) {
      if (!byId.has(pid)) {
        chip.remove();
        this.chips.delete(pid);
      }
    }
    this.playFlip(first);
  }

  fillList(list, people, ev, ui) {
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    sorted.forEach((p, k) => {
      const chip = this.chipFor(p);
      updateChip(chip, p, ev.persons.get(p.id), { shortName: ui.names.get(p.id), selected: ui.selected === p.id, locked: false });
      if (list.children[k] !== chip) list.insertBefore(chip, list.children[k] || null);
    });
    while (list.children.length > sorted.length) list.lastElementChild.remove();
  }

  playFlip(first) {
    const pending = this.pendingFlip;
    this.pendingFlip = null;
    if (reducedMotion()) return;
    for (const [pid, chip] of this.chips) {
      if (!chip.isConnected) continue;
      const last = chip.getBoundingClientRect();
      let f = first.get(pid);
      if (pending && pending.pid === pid) {
        const tok = chip.firstElementChild.getBoundingClientRect();
        f = { left: pending.rect.left - (tok.left - last.left), top: pending.rect.top - (tok.top - last.top) };
      }
      if (!f) continue;
      const dx = f.left - last.left;
      const dy = f.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      chip.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 420,
        easing: 'cubic-bezier(.2,.9,.25,1)',
      });
    }
  }

  flipBack(pid, rect) {
    const chip = this.chips.get(pid);
    if (!chip || reducedMotion()) return;
    const last = chip.getBoundingClientRect();
    const tok = chip.firstElementChild.getBoundingClientRect();
    const dx = rect.left - (tok.left - last.left) - last.left;
    const dy = rect.top - (tok.top - last.top) - last.top;
    chip.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 300, easing: 'ease-out' });
  }

  showHints(hints, from) {
    let bestId = null;
    let best = 0.5;
    for (const [id, x] of hints) {
      if (x.hardDelta <= 0 && x.delta > best) {
        best = x.delta;
        bestId = id;
      }
    }
    for (const [id, x] of hints) {
      const el = this.seatEl(id);
      if (!el) continue;
      const up = x.hardDelta < 0 || (x.hardDelta === 0 && x.delta > 0.5);
      const down = x.hardDelta > 0 || x.delta < -0.5;
      el.classList.toggle('hint-up', up);
      el.classList.toggle('hint-down', down && !up);
      el.classList.toggle('hint-best', id === bestId);
      const label = el.querySelector('.hint');
      label.textContent = id === bestId ? '★' : '';
    }
    if (from) this.seatEl(from)?.classList.add('is-origin');
    this.wrap.classList.add('show-hints');
  }

  clearHints() {
    this.wrap.classList.remove('show-hints');
    for (const el of this.wrap.querySelectorAll('.hint-up, .hint-down, .hint-best, .is-origin')) {
      el.classList.remove('hint-up', 'hint-down', 'hint-best', 'is-origin');
      const label = el.querySelector('.hint');
      if (label) label.textContent = '';
    }
  }
}

function prefMatches(pr, otherId, byId) {
  const q = byId.get(otherId);
  if (!q) return false;
  switch (pr.kind) {
    case 'beside':
    case 'near':
      return pr.target === otherId;
    case 'nearAll':
      return pr.who.includes(otherId);
    case 'nearTag':
      return q.tags.includes(pr.tag);
    case 'nearRole':
      return pr.roles.includes(q.role) && (!pr.gender || q.gender === pr.gender);
    default:
      return false;
  }
}

// Arrastar e soltar com Pointer Events. Mouse: arrasta na hora.
// Toque: segure ~0,25 s para pegar a pessoa (assim a página continua rolando).
class DragController {
  constructor(board) {
    this.board = board;
    this.d = null;
    this.suppressUntil = 0;
    this.raf = 0;
    document.addEventListener('pointerdown', (e) => this.onDown(e));
    document.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    document.addEventListener('pointerup', (e) => this.onUp(e));
    document.addEventListener('pointercancel', (e) => this.onCancel(e));
    document.addEventListener('touchmove', (e) => { if (this.d && this.d.started) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.token') && this.board.owns(e.target)) e.preventDefault(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.d && this.d.started) this.cancel(); });
    window.addEventListener('blur', () => { if (this.d && this.d.started) this.cancel(); });
  }

  consumeClick() {
    return performance.now() < this.suppressUntil;
  }

  onDown(e) {
    const token = e.target.closest && e.target.closest('.token');
    if (!token || !this.board.owns(token)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.d) this.cleanup();
    const chip = token.closest('.pchip');
    const seat = chip.closest('[data-seat]');
    this.d = {
      pid: chip.dataset.person,
      chip,
      token,
      from: seat ? seat.dataset.seat : null,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      type: e.pointerType,
      started: false,
      over: null,
      timer: 0,
    };
    if (e.pointerType === 'touch') {
      this.d.timer = setTimeout(() => {
        if (this.d && !this.d.started) this.start();
      }, 260);
    }
  }

  onMove(e) {
    const d = this.d;
    if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.started) {
      const dist = Math.hypot(d.x - d.x0, d.y - d.y0);
      if (d.type === 'touch') {
        if (dist > 10) {
          clearTimeout(d.timer);
          this.d = null;
        }
        return;
      }
      if (dist < 6) return;
      this.start();
      if (!this.d) return;
    }
    e.preventDefault();
    this.track();
  }

  onUp(e) {
    const d = this.d;
    if (!d || e.pointerId !== d.id) return;
    clearTimeout(d.timer);
    if (d.started) {
      this.suppressUntil = performance.now() + 450;
      this.drop();
    } else {
      this.d = null;
    }
  }

  onCancel(e) {
    const d = this.d;
    if (!d || e.pointerId !== d.id) return;
    clearTimeout(d.timer);
    if (d.started) this.cancel();
    else this.d = null;
  }

  start() {
    const d = this.d;
    if (this.board.isLocked(d.from)) {
      this.board.api.onLockedDrag(d.pid);
      d.chip.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
        { duration: 260 },
      );
      this.suppressUntil = performance.now() + 450;
      this.d = null;
      return;
    }
    d.started = true;
    const r = d.token.getBoundingClientRect();
    d.offX = d.x0 - r.left;
    d.offY = d.y0 - r.top;
    const ghost = d.token.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.removeAttribute('aria-label');
    ghost.style.setProperty('--c', getComputedStyle(d.chip).getPropertyValue('--c'));
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    document.body.append(ghost);
    d.ghost = ghost;
    d.chip.classList.add('is-dragging');
    document.body.classList.add('is-dragging');
    if (navigator.vibrate && d.type === 'touch') navigator.vibrate(8);
    this.board.showHints(this.board.api.hints(d.pid), d.from);
    this.track();
    this.loop();
  }

  track() {
    const d = this.d;
    if (!d || !d.ghost) return;
    d.ghost.style.transform = `translate(${d.x - d.offX}px, ${d.y - d.offY}px) rotate(-5deg) scale(1.1)`;
    const el = document.elementFromPoint(d.x, d.y);
    let over = el && el.closest ? el.closest('[data-seat], [data-drop]') : null;
    if (over && !this.board.owns(over)) over = null;
    if (over && over.dataset.seat && this.board.isLocked(over.dataset.seat) && over.dataset.seat !== d.from) over = null;
    if (over && over.classList.contains('plate')) over = this.board.seatEl(over.dataset.seat);
    if (over !== d.over) {
      if (d.over) d.over.classList.remove('is-over');
      if (over) over.classList.add('is-over');
      d.over = over;
    }
  }

  loop() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      const d = this.d;
      if (!d || !d.started) return;
      const edge = 72;
      const max = 16;
      let vy = 0;
      if (d.y < edge) vy = -((edge - d.y) / edge) * max;
      else if (d.y > innerHeight - edge) vy = ((d.y - (innerHeight - edge)) / edge) * max;
      if (vy) {
        window.scrollBy(0, vy);
        this.track();
      }
      const strip = this.board.benchList;
      const sr = strip.getBoundingClientRect();
      if (d.y > sr.top && d.y < sr.bottom && strip.scrollWidth > strip.clientWidth) {
        if (d.x < sr.left + 40) strip.scrollLeft -= 8;
        else if (d.x > sr.right - 40) strip.scrollLeft += 8;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  drop() {
    const d = this.d;
    const target = d.over;
    const rect = d.ghost.getBoundingClientRect();
    this.cleanup();
    const to = target ? (target.dataset.seat ? target.dataset.seat : 'bench') : null;
    const fromKey = d.from || 'bench';
    if (!to || to === fromKey) {
      this.board.flipBack(d.pid, rect);
      return;
    }
    this.board.pendingFlip = { pid: d.pid, rect };
    this.board.api.onDrop(d.pid, d.from, to === 'bench' ? null : to);
  }

  cancel() {
    const d = this.d;
    const rect = d.ghost ? d.ghost.getBoundingClientRect() : null;
    this.cleanup();
    if (rect) this.board.flipBack(d.pid, rect);
  }

  cleanup() {
    const d = this.d;
    cancelAnimationFrame(this.raf);
    if (d) {
      clearTimeout(d.timer);
      if (d.ghost) d.ghost.remove();
      if (d.over) d.over.classList.remove('is-over');
      d.chip.classList.remove('is-dragging');
    }
    document.body.classList.remove('is-dragging');
    this.board.clearHints();
    this.d = null;
  }
}
