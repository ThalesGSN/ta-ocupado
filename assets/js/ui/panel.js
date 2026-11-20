// Painel lateral (ou folha inferior no celular) com os detalhes da pessoa.
import { h, icon } from './dom.js';
import { bigAvatar, moodFace } from './avatar.js';
import { REL_LABEL, seatLabel } from '../model.js';
import { ROLES, tagInfo, foodIcon } from '../tags.js';

export function roleLine(p) {
  if (p.role === 'lider') return p.ministry ? `Líder do ministério ${p.ministry}` : 'Líder';
  if (p.role === 'convidado') return p.gender === 'f' ? 'Convidada' : 'Convidado';
  return ROLES[p.role]?.label || '';
}

function statusText(info, firstName) {
  if (!info) return { mood: 'out', text: `${firstName} não vai ao jantar.` };
  const total = info.prefs.length;
  const got = info.prefs.filter((x) => x.sat).length;
  switch (info.mood) {
    case 'happy':
      return { mood: 'happy', text: 'Feliz com o lugar.' };
    case 'ok':
      return { mood: 'ok', text: `Quase feliz: ${got} de ${total} desejos atendidos.` };
    case 'sad':
      return info.hardFail
        ? { mood: 'sad', text: 'Infeliz: uma regra obrigatória não foi cumprida.' }
        : { mood: 'sad', text: `Infeliz: só ${got} de ${total} desejos atendidos.` };
    default:
      return { mood: 'out', text: 'Ainda sem lugar na mesa.' };
  }
}

export function renderGuide(root) {
  root.replaceChildren(
    h(
      'div',
      { class: 'guide' },
      h('h2', { text: 'Como funciona' }),
      h(
        'ul',
        {},
        h('li', { text: 'Toque numa pessoa para ver o que a deixa feliz.' }),
        h('li', { text: 'Arraste para trocar de lugar. No celular, toque e segure antes de arrastar.' }),
        h('li', { text: 'Enquanto você arrasta, os lugares em verde deixam a mesa mais feliz. A estrela marca o melhor lugar.' }),
        h('li', { text: 'Sugerir mesa monta um arranjo automático que mantém casais lado a lado. Fixe alguém com o alfinete para a sugestão não mexer no lugar dele.' }),
      ),
    ),
  );
}

/**
 * opts: { state, ev, pid, names, actions: { close, select, move, lock, unseat, present, edit } }
 */
export function renderPerson(root, opts) {
  const { state, ev, pid, names, actions } = opts;
  const p = state.people.find((x) => x.id === pid);
  if (!p) {
    renderGuide(root);
    return;
  }
  const tags = { ...state.tags };
  const info = p.present ? ev.persons.get(pid) : null;
  const firstName = p.name.split(/\s+/)[0];
  const st = statusText(info, firstName);
  const seat = info && info.seat;
  const locked = seat && state.locked.includes(seat);

  const head = h(
    'div',
    { class: 'pc-head' },
    bigAvatar(p, p.present ? st.mood : 'out'),
    h(
      'div',
      { class: 'pc-id' },
      h('h2', { class: 'pc-name', id: 'pc-name', text: p.name }),
      h('p', { class: 'pc-role', text: roleLine(p) }),
      p.about ? h('p', { class: 'pc-about', text: p.about }) : null,
      p.food ? h('p', { class: 'pc-food' }, h('span', { 'aria-hidden': 'true', text: foodIcon(p.food) }), ` Vai levar: ${p.food === '🤷' ? 'ainda não decidiu' : p.food}`) : null,
    ),
    h('button', { type: 'button', class: 'icon-btn pc-close', 'aria-label': 'Fechar detalhes', onclick: actions.close }, icon('close')),
  );

  const status = h(
    'p',
    { class: `pc-status mood-${st.mood}` },
    moodFace(st.mood, 22),
    h('span', { text: st.text }),
    seat ? h('span', { class: 'pc-seat', text: `Lugar ${seatLabel(seat)}${locked ? ', fixado' : ''}` }) : null,
  );

  const sections = [head, status];

  if (info && info.prefs.length) {
    sections.push(
      h(
        'section',
        { class: 'pc-section', 'aria-labelledby': 'pc-prefs' },
        h('h3', { id: 'pc-prefs', text: `O que deixa ${firstName} feliz` }),
        h(
          'ul',
          { class: 'pref-list' },
          info.prefs.map((pr) =>
            h(
              'li',
              { class: `pref ${pr.sat ? 'is-sat' : 'is-unsat'}${pr.hard ? ' is-hard' : ''}` },
              h('span', { class: 'pref-check', 'aria-hidden': 'true' }, icon(pr.sat ? 'check' : 'x', 16)),
              h('span', { class: 'pref-icon', 'aria-hidden': 'true', text: pr.icon }),
              h('span', { class: 'pref-label' }, pr.label, h('span', { class: 'sr-only', text: pr.sat ? ' (atendido)' : ' (não atendido)' })),
              pr.hard ? h('span', { class: 'pref-hard', text: 'obrigatório' }) : null,
            ),
          ),
        ),
      ),
    );
  }

  if (info && info.neighbors.length) {
    const order = { side: 0, front: 1, diag: 2 };
    const nbs = [...info.neighbors].sort((a, b) => order[a.rel] - order[b.rel]);
    sections.push(
      h(
        'section',
        { class: 'pc-section', 'aria-labelledby': 'pc-nbrs' },
        h('h3', { id: 'pc-nbrs', text: 'Em volta' }),
        h(
          'ul',
          { class: 'nbr-list' },
          nbs.map((nb) => {
            const q = state.people.find((x) => x.id === nb.id);
            const shared = nb.shared.map((t) => tagInfo(tags, t));
            return h(
              'li',
              {},
              h('button', { type: 'button', class: 'link', onclick: () => actions.select(nb.id), text: names.get(nb.id) || q.name }),
              h('span', { class: 'nbr-rel', text: REL_LABEL[nb.rel] }),
              shared.length
                ? h('span', { class: 'nbr-shared', title: `Em comum: ${shared.map((x) => x.label.toLowerCase()).join(', ')}` }, shared.map((x) => x.icon).join(' '))
                : null,
            );
          }),
        ),
      ),
    );
  }

  const acts = [];
  if (p.present) {
    acts.push(h('button', { type: 'button', class: 'btn small', onclick: () => actions.move(pid) }, icon('move', 18), seat ? 'Mudar de lugar' : 'Escolher lugar'));
    if (seat) {
      acts.push(h('button', { type: 'button', class: 'btn small', 'aria-pressed': locked ? 'true' : 'false', onclick: () => actions.lock(pid) }, icon('pin', 18), locked ? 'Soltar o lugar' : 'Fixar o lugar'));
      acts.push(h('button', { type: 'button', class: 'btn small', onclick: () => actions.unseat(pid) }, icon('out', 18), 'Tirar da mesa'));
    }
  }
  acts.push(h('button', { type: 'button', class: 'btn small', onclick: () => actions.present(pid) }, icon(p.present ? 'x' : 'check', 18), p.present ? 'Não vai' : 'Vai ao jantar'));
  acts.push(h('button', { type: 'button', class: 'btn small', onclick: () => actions.edit(pid) }, icon('edit', 18), 'Editar'));
  sections.push(h('div', { class: 'pc-actions' }, acts));

  root.replaceChildren(h('div', { class: 'person-card', role: 'region', 'aria-labelledby': 'pc-name' }, sections));
}
