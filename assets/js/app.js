// Tá ocupado? Monte a mesa do seu evento como um quebra-cabeça.
import { normalizeState, evaluate, shortNames, seatLabel, moveHints, emptyState } from './model.js';
import { createStore, loadLocal, saveLocal } from './store.js';
import { decodePayload, readHashPayload, shareUrl, parseFileText, fileName } from './share.js';
import { DEMO } from './demo.js';
import { Board } from './ui/board.js';
import { renderPerson, renderGuide } from './ui/panel.js';
import { confirmDialog, openShareDialog, openImportDialog, openSettingsDialog, openPeopleEditor, openHelpDialog, downloadJson } from './ui/dialogs.js';
import { h, $, icon } from './ui/dom.js';
import { moodFace, MOOD_LABEL } from './ui/avatar.js';
import { toast, announce, celebrate } from './ui/feedback.js';
import { runSuggest } from './suggest-client.js';

const ui = { selected: null, moveMode: null, busy: false, lastPercent: null, brokenCursor: 0 };
const store = createStore(null);
const mqMobile = matchMedia('(max-width: 760px)');
let board = null;
let lastEval = null;

const seatOf = (st, pid) => Object.keys(st.seating).find((k) => st.seating[k] === pid) || null;
const personOf = (st, pid) => st.people.find((p) => p.id === pid);
const firstName = (p) => p.name.split(/\s+/)[0];

// ---------- Ações sobre a mesa ----------

function applyMove(pid, to) {
  const st = store.get();
  const p = personOf(st, pid);
  if (!p) return;
  const from = seatOf(st, pid);
  if (from && st.locked.includes(from)) {
    toast(`O lugar de ${firstName(p)} está fixado. Solte o alfinete para mover.`);
    return;
  }
  if (to && st.locked.includes(to)) {
    toast('Esse lugar está fixado.');
    return;
  }
  if ((to || null) === from) return;
  const otherId = to ? st.seating[to] : null;
  const other = otherId ? personOf(st, otherId) : null;
  const before = lastEval ? lastEval.hardBroken.length : 0;
  store.update((s) => {
    const x = personOf(s, pid);
    x.present = true;
    if (from) delete s.seating[from];
    if (to) {
      s.seating[to] = pid;
      if (other && from) s.seating[from] = other.id;
    }
    s.locked = s.locked.filter((k) => s.seating[k]);
  }, 'move');
  if (other) announce(from ? `${p.name} trocou de lugar com ${other.name}.` : `${p.name} sentou no lugar ${seatLabel(to)}. ${other.name} ficou fora da mesa.`);
  else announce(to ? `${p.name} sentou no lugar ${seatLabel(to)}.` : `${p.name} saiu da mesa.`);
  const after = lastEval ? lastEval.hardBroken.length : 0;
  if (after > before && lastEval) {
    const who = lastEval.hardBroken.find((id) => id === pid || id === other?.id) || lastEval.hardBroken[0];
    const info = lastEval.persons.get(who);
    const rule = info && info.prefs.find((x) => x.hard && !x.sat);
    if (rule) toast(`Regra quebrada: ${personOf(store.get(), who).name} quer ficar "${rule.label.toLowerCase()}".`, { action: 'Desfazer', onAction: undo, tone: 'warn' });
  }
}

function undo() {
  if (store.undo()) toast('Desfeito.');
}
function redo() {
  if (store.redo()) toast('Refeito.');
}

async function doSuggest() {
  const st = store.get();
  if (ui.busy || !st || !st.people.some((p) => p.present)) return;
  ui.busy = true;
  setBusy(true);
  try {
    const res = await runSuggest(st, Math.floor(Math.random() * 2 ** 31));
    ui.moveMode = null;
    store.update((s) => {
      s.seating = res.seating;
      s.locked = s.locked.filter((k) => s.seating[k]);
    }, 'suggest');
    const msg = res.percent === 100 ? 'Mesa sugerida: todo mundo feliz!' : `Mesa sugerida: ${res.percent}% de felicidade.`;
    toast(msg, { action: 'Desfazer', onAction: undo });
  } catch (err) {
    toast(`Não consegui sugerir a mesa: ${err.message}`, { tone: 'error' });
  } finally {
    ui.busy = false;
    setBusy(false);
  }
}

function setBusy(on) {
  const b = $('#btn-suggest');
  b.disabled = on;
  b.classList.toggle('is-busy', on);
  b.querySelector('.label').replaceChildren(on ? 'Pensando…' : 'Sugerir', ...(on ? [] : [h('span', { class: 'label-long', text: ' mesa' })]));
}

const actions = {
  select(pid) {
    ui.selected = ui.selected === pid ? null : pid;
    ui.moveMode = null;
    render('select');
  },
  close() {
    ui.selected = null;
    ui.moveMode = null;
    render('select');
  },
  move(pid) {
    ui.moveMode = pid;
    ui.selected = pid;
    render('pick');
    const p = personOf(store.get(), pid);
    announce(`Escolha um lugar para ${p.name}. Esc cancela.`);
    const first = document.querySelector('.seat.is-target');
    if (first && !mqMobile.matches) first.focus({ preventScroll: true });
  },
  lock(pid) {
    const st = store.get();
    const seat = seatOf(st, pid);
    if (!seat) return;
    const on = !st.locked.includes(seat);
    store.update((s) => {
      s.locked = on ? [...s.locked, seat] : s.locked.filter((k) => k !== seat);
    }, 'lock');
    toast(on ? `${firstName(personOf(st, pid))} ficou fixado no lugar ${seatLabel(seat)}.` : 'Lugar solto.');
  },
  unseat(pid) {
    const st = store.get();
    const seat = seatOf(st, pid);
    if (!seat) return;
    store.update((s) => {
      delete s.seating[seat];
      s.locked = s.locked.filter((k) => k !== seat);
    }, 'move');
    announce(`${personOf(st, pid).name} saiu da mesa.`);
  },
  present(pid) {
    const p = personOf(store.get(), pid);
    store.update((s) => {
      const x = personOf(s, pid);
      x.present = !x.present;
      if (!x.present) for (const [k, v] of Object.entries(s.seating)) if (v === pid) delete s.seating[k];
      s.locked = s.locked.filter((k) => s.seating[k]);
    }, 'present');
    toast(p.present ? `${firstName(p)} foi para a lista de quem não vai.` : `${firstName(p)} voltou para a lista do jantar.`);
  },
  edit(pid) {
    openPeopleEditor({ getState: () => store.get(), update: (fn) => store.update(fn, 'edit'), focusId: pid, toast });
  },
};

function cancelMove() {
  ui.moveMode = null;
  render('pick');
}

function onSeatPick(seat) {
  if (!ui.moveMode) {
    if (seat === null || !store.get().seating[seat]) {
      if (ui.selected) actions.close();
    }
    return;
  }
  const pid = ui.moveMode;
  ui.moveMode = null;
  const before = store.get();
  applyMove(pid, seat);
  if (store.get() === before) render('pick');
}

function onTap(pid) {
  if (ui.moveMode && ui.moveMode !== pid) {
    const seat = seatOf(store.get(), pid);
    if (seat) {
      onSeatPick(seat);
      return;
    }
  }
  actions.select(pid);
}

// ---------- Desenho ----------

function render(reason) {
  const st = store.get();
  document.body.classList.toggle('has-data', !!st);
  $('#welcome').hidden = !!st;
  $('#layout').hidden = !st;
  $('#topbar').hidden = !st;
  if (!st) {
    buildWelcomeArt();
    lastEval = null;
    ui.lastPercent = null;
    return;
  }
  if (ui.selected && !personOf(st, ui.selected)) ui.selected = null;
  if (ui.moveMode && !personOf(st, ui.moveMode)) ui.moveMode = null;

  const ev = evaluate(st);
  lastEval = ev;
  const names = shortNames(st.people);
  board.render(st, ev, { selected: ui.selected, moveMode: ui.moveMode, names });

  const sheet = $('#sheet');
  if (ui.selected) renderPerson(sheet, { state: st, ev, pid: ui.selected, names, actions });
  else renderGuide(sheet);
  document.body.classList.toggle('sheet-open', !!ui.selected && !ui.moveMode);
  document.body.classList.toggle('is-picking', !!ui.moveMode);

  const banner = $('#move-banner');
  banner.hidden = !ui.moveMode;
  if (ui.moveMode) $('#move-text').textContent = `Escolha um lugar para ${personOf(st, ui.moveMode).name}. Tocar em alguém troca os dois de lugar.`;

  renderHeader(st, ev);

  const allHappy = ev.percent === 100 && ev.hardBroken.length === 0 && ev.counts.out === 0 && ev.present > 1;
  if (allHappy && ui.lastPercent !== null && ui.lastPercent < 100 && ['move', 'suggest', 'redo'].includes(reason)) {
    celebrate();
    if (reason === 'move') toast('Todo mundo feliz!');
  }
  ui.lastPercent = allHappy ? 100 : Math.min(99, ev.percent);
}

function renderHeader(st, ev) {
  $('#event-title-text').textContent = st.title;
  const meter = $('#score-meter');
  meter.setAttribute('aria-valuenow', String(ev.percent));
  meter.setAttribute('aria-valuetext', `${ev.percent}% de felicidade`);
  meter.dataset.level = ev.percent === 100 && !ev.hardBroken.length ? 'full' : ev.percent >= 75 ? 'good' : ev.percent >= 50 ? 'mid' : 'low';
  $('#score-fill').style.setProperty('--p', `${ev.percent}%`);
  $('#score-pct').textContent = `${ev.percent}%`;
  const moods = ['happy', 'ok', 'sad', 'out']
    .filter((m) => m !== 'out' || ev.counts.out)
    .map((m) => h('span', { class: 'mood-count', title: `${ev.counts[m]} ${m === 'out' ? 'sem lugar' : MOOD_LABEL[m]}` }, moodFace(m, 16), h('span', { text: String(ev.counts[m]) }), h('span', { class: 'sr-only', text: ` ${m === 'out' ? 'sem lugar' : MOOD_LABEL[m]}` })));
  $('#score-moods').replaceChildren(...moods);
  const rules = $('#rules-btn');
  const nb = ev.hardBroken.length;
  rules.hidden = nb === 0;
  rules.querySelector('.label').textContent = String(nb);
  rules.setAttribute('aria-label', `${nb} com regra quebrada: mostrar quem`);
  $('#btn-undo').disabled = !store.canUndo();
  $('#btn-redo').disabled = !store.canRedo();
}

function buildWelcomeArt() {
  const art = $('#welcome-art');
  if (art.childElementCount) return;
  const faces = ['happy', 'sad', 'ok', 'happy'];
  const colors = ['#FFD3A3', '#B7D5F2', '#CBE6AE', '#F5BFD0'];
  art.append(
    h(
      'div',
      { class: 'wa-row' },
      faces.slice(0, 2).map((f, i) => h('span', { class: 'wa-token', vars: { '--c': colors[i] } }, h('span', { class: 'face-slot' }, moodFace(f, 18)))),
      h('span', { class: 'wa-token is-empty' }),
    ),
    h('div', { class: 'cloth wa-cloth' }),
    h(
      'div',
      { class: 'wa-row' },
      h('span', { class: 'wa-token is-empty' }),
      faces.slice(2).map((f, i) => h('span', { class: 'wa-token', vars: { '--c': colors[i + 2] } }, h('span', { class: 'face-slot' }, moodFace(f, 18)))),
    ),
  );
}

// ---------- Menu "Mais" ----------

function menuItems() {
  return [
    ['seats', 'Ajustes da mesa', () => openSettings()],
    ['people', 'Pessoas', () => openPeople(), 'mobile'],
    ['share', 'Compartilhar', () => doShare(), 'mobile'],
    ['download', 'Baixar arquivo .json', () => doExport()],
    ['upload', 'Importar convidados', () => doImport()],
    ['print', 'Imprimir', () => window.print()],
    ['book', 'Como funciona', () => openHelpDialog()],
    ['table', 'Esvaziar a mesa', () => doClear()],
    ['sparkle', 'Abrir o exemplo', () => doDemo()],
    ['trash', 'Apagar dados deste aparelho', () => doErase(), 'danger'],
  ];
}

function buildMenu() {
  const menu = $('#more-menu');
  menu.replaceChildren(
    ...menuItems().map(([ic, label, fn, flag]) =>
      h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          class: `menu-item${flag === 'mobile' ? ' only-mobile' : ''}${flag === 'danger' ? ' is-danger' : ''}`,
          onclick: () => {
            toggleMenu(false);
            fn();
          },
        },
        icon(ic, 18),
        label,
      ),
    ),
  );
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('.menu-item')].filter((b) => b.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Escape') {
      toggleMenu(false);
      $('#btn-more').focus();
    }
  });
}

function onOutside(e) {
  if (!e.target.closest('#more-menu') && !e.target.closest('#btn-more')) toggleMenu(false);
}

function toggleMenu(open) {
  const menu = $('#more-menu');
  const btn = $('#btn-more');
  const willOpen = open ?? menu.hidden;
  menu.hidden = !willOpen;
  btn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    const first = [...menu.querySelectorAll('.menu-item')].find((b) => b.offsetParent !== null);
    if (first) first.focus();
    document.addEventListener('pointerdown', onOutside, true);
  } else {
    document.removeEventListener('pointerdown', onOutside, true);
  }
}

// ---------- Diálogos ----------

function openSettings() {
  openSettingsDialog({
    state: store.get(),
    onSave: ({ title, seatsPerSide }) =>
      store.update((s) => {
        s.title = title;
        s.seatsPerSide = seatsPerSide;
        return normalizeState(s);
      }, 'settings'),
  });
}

function openPeople() {
  openPeopleEditor({ getState: () => store.get(), update: (fn) => store.update(fn, 'edit'), toast });
}

async function doShare() {
  const st = store.get();
  const base = location.href.split('#')[0];
  const url = await shareUrl(st, base);
  openShareDialog({ url, onDownload: doExport, toast });
}

function doExport() {
  const st = store.get();
  downloadJson(st, fileName(st));
  toast('Arquivo baixado. Ele tem os nomes: guarde num lugar seguro.');
}

function loadState(next, message) {
  ui.selected = null;
  ui.moveMode = null;
  if (store.get()) store.replace(next, 'replace');
  else store.reset(next, 'reset');
  if (message) toast(message);
}

function doImport() {
  openImportDialog({
    onLoad: (text) => {
      const st = parseFileText(text);
      if (!st.people.length) throw new Error('O arquivo não tem nenhuma pessoa.');
      loadState(st, `${st.people.length} pessoas importadas.${store.canUndo() ? ' Use Desfazer para voltar à mesa anterior.' : ''}`);
      return st;
    },
  });
}

async function doClear() {
  const ok = await confirmDialog({ title: 'Esvaziar a mesa?', text: 'Todo mundo vai para "Fora da mesa". Dá para desfazer depois.', confirm: 'Esvaziar', cancel: 'Cancelar' });
  if (ok) store.update((s) => {
    s.seating = {};
    s.locked = [];
  }, 'clear');
}

function doDemo() {
  loadState(normalizeState(structuredClone(DEMO)), store.get() ? 'Exemplo aberto. Use Desfazer para voltar à sua mesa.' : null);
}

async function doErase() {
  const ok = await confirmDialog({
    title: 'Apagar dados deste aparelho?',
    text: 'A mesa e os nomes salvos neste navegador serão apagados. Se quiser guardar, baixe o arquivo .json antes.',
    confirm: 'Apagar',
    cancel: 'Cancelar',
    danger: true,
  });
  if (!ok) return;
  saveLocal(null);
  ui.selected = null;
  ui.moveMode = null;
  store.reset(null, 'reset');
  toast('Dados apagados deste aparelho.');
}

// ---------- Impressão ----------

function buildPrintSheet() {
  const st = store.get();
  const sheet = $('#print-sheet');
  if (!st) return;
  const names = new Map(st.people.map((p) => [p.id, p.name]));
  const n = st.seatsPerSide;
  const idxs = [...Array(n).keys()];
  const row = (side) =>
    h(
      'div',
      { class: 'pt-row' },
      idxs.map((i) => {
        const pid = st.seating[`${side}${i}`];
        return h('div', { class: 'pt-seat' }, h('span', { class: 'pt-num', text: `${side}${i + 1}` }), h('span', { class: 'pt-name', text: pid ? names.get(pid) : '' }));
      }),
    );
  sheet.replaceChildren(
    h('h1', { text: st.title }),
    h('div', { class: 'pt-table', vars: { '--n': String(n) } }, row('A'), h('div', { class: 'pt-cloth' }), row('B')),
    h(
      'div',
      { class: 'pt-lists' },
      ['A', 'B'].map((side) =>
        h('section', {}, h('h2', { text: `Lado ${side}` }), h('ol', {}, idxs.map((i) => h('li', { text: names.get(st.seating[`${side}${i}`]) || '(vazio)' })))),
      ),
    ),
  );
}

// ---------- Link com dados (#m=...) ----------

function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

async function openFromHash() {
  const payload = readHashPayload(location.hash);
  if (!payload) return false;
  let fromLink;
  try {
    fromLink = await decodePayload(payload);
  } catch (err) {
    clearHash();
    toast(err.message, { tone: 'error', ms: 7000 });
    return false;
  }
  clearHash();
  const local = store.get();
  if (local && local.people.length && JSON.stringify(local) !== JSON.stringify(fromLink)) {
    const ok = await confirmDialog({
      title: 'Abrir a mesa do link?',
      text: `Este aparelho já tem a mesa "${local.title}". Abrir o link troca a mesa salva aqui (dá para desfazer).`,
      confirm: 'Abrir a mesa do link',
      cancel: 'Manter a minha',
    });
    if (!ok) return true;
  }
  loadState(fromLink, 'Mesa aberta. Ela fica salva só neste aparelho.');
  return true;
}

// ---------- Início ----------

function wire() {
  board = new Board(
    { table: $('#table-area'), bench: $('#bench'), absent: $('#absent') },
    {
      onTap,
      onDrop: (pid, from, to) => applyMove(pid, to),
      hints: (pid) => moveHints(store.get(), pid),
      onSeatPick,
      onLockedDrag: (pid) => toast(`O lugar de ${firstName(personOf(store.get(), pid))} está fixado. Solte o alfinete para mover.`),
    },
  );
  buildMenu();
  $('#btn-suggest').addEventListener('click', doSuggest);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-share').addEventListener('click', doShare);
  $('#btn-people').addEventListener('click', openPeople);
  $('#btn-more').addEventListener('click', () => toggleMenu());
  $('#event-title').addEventListener('click', openSettings);
  $('#move-cancel').addEventListener('click', cancelMove);
  $('#rules-btn').addEventListener('click', () => {
    const ev = lastEval;
    if (!ev || !ev.hardBroken.length) return;
    ui.brokenCursor = (ui.brokenCursor + 1) % ev.hardBroken.length;
    ui.selected = ev.hardBroken[ui.brokenCursor];
    ui.moveMode = null;
    render('select');
    const chip = document.querySelector(`.pchip[data-person="${CSS.escape(ui.selected)}"]`);
    if (chip) chip.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  $('#welcome').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'demo') doDemo();
    else if (act === 'import') doImport();
    else if (act === 'blank') {
      loadState(emptyState('Minha mesa'));
      openPeople();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (e.key === 'Escape' && !$('#more-menu').hidden) {
      toggleMenu(false);
    } else if (e.key === 'Escape') {
      if (ui.moveMode) cancelMove();
      else if (ui.selected) actions.close();
    }
  });
  window.addEventListener('beforeprint', buildPrintSheet);
  window.addEventListener('hashchange', () => openFromHash());
  store.subscribe((_, reason) => render(reason));
}

async function boot() {
  wire();
  const local = loadLocal();
  if (local) store.reset(local, 'boot');
  else render('boot');
  await openFromHash();
}

boot();
