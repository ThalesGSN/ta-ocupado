// Diálogos (elemento <dialog> nativo).
import { h, icon } from './dom.js';
import { initials, colorFor } from './avatar.js';
import { roleLine } from './panel.js';
import { AGE_BANDS, ROLES, DEFAULT_TAGS } from '../tags.js';
import { slugify, uniqueId, normalizeState } from '../model.js';

export function openDialog({ title, body, actions = [], wide = false, onClose, labelledBy }) {
  const titleId = labelledBy || `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const footer = actions.length ? h('footer', { class: 'dlg-foot' }, actions) : null;
  const dlg = h(
    'dialog',
    { class: `dlg${wide ? ' is-wide' : ''}`, 'aria-labelledby': titleId },
    h(
      'header',
      { class: 'dlg-head' },
      h('h2', { id: titleId, text: title }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => close() }, icon('close')),
    ),
    h('div', { class: 'dlg-body' }, body),
    footer,
  );
  let closed = false;
  function close(value) {
    if (closed) return;
    closed = true;
    if (dlg.open) dlg.close();
    dlg.remove();
    if (onClose) onClose(value);
  }
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  document.body.append(dlg);
  dlg.showModal();
  return { el: dlg, close, setTitle: (t) => (dlg.querySelector(`#${titleId}`).textContent = t) };
}

export function confirmDialog({ title, text, confirm = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const ok = h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, text: confirm });
    const no = h('button', { type: 'button', class: 'btn', text: cancel });
    const d = openDialog({ title, body: h('p', { class: 'dlg-text', text }), actions: [no, ok], onClose: () => resolve(result) });
    ok.addEventListener('click', () => {
      result = true;
      d.close();
    });
    no.addEventListener('click', () => d.close());
    ok.focus();
  });
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (input) {
      input.focus();
      input.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function downloadJson(state, name) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function openShareDialog({ url, onDownload, toast }) {
  const input = h('input', { type: 'text', class: 'field-input mono-url', readonly: true, value: url, 'aria-label': 'Link da mesa', onfocus: (e) => e.target.select() });
  const copy = h('button', { type: 'button', class: 'btn primary' }, icon('share', 18), 'Copiar link');
  const dl = h('button', { type: 'button', class: 'btn' }, icon('download', 18), 'Baixar arquivo .json');
  const body = [
    h('p', { class: 'dlg-text', text: 'O link abre a mesa como está agora, com todos os nomes. Os dados ficam depois do # no endereço, a parte que o navegador não envia para o servidor.' }),
    h('p', { class: 'dlg-text warn', text: 'Mesmo assim, quem tiver o link consegue ver a mesa. Mande só para quem precisa.' }),
    input,
    h('p', { class: 'dlg-note', text: `${url.length.toLocaleString('pt-BR')} caracteres.` }),
  ];
  const d = openDialog({ title: 'Compartilhar a mesa', body, actions: [dl, copy] });
  copy.addEventListener('click', async () => {
    const ok = await copyText(url, input);
    toast(ok ? 'Link copiado.' : 'Não deu para copiar. Selecione o link e copie à mão.');
    if (ok) d.close();
  });
  dl.addEventListener('click', () => {
    onDownload();
    d.close();
  });
  setTimeout(() => copy.focus(), 0);
}

export function openImportDialog({ onLoad }) {
  const err = h('p', { class: 'field-error', role: 'alert' });
  const file = h('input', { type: 'file', accept: '.json,application/json', class: 'field-file', id: 'imp-file' });
  const area = h('textarea', { class: 'field-input', rows: 6, id: 'imp-text', placeholder: '{ "people": [ { "name": "Ana", "role": "lider" } ] }', spellcheck: 'false' });
  const load = h('button', { type: 'button', class: 'btn primary', text: 'Carregar' });
  const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancelar' });
  const body = [
    h('p', { class: 'dlg-text', text: 'Escolha um arquivo .json exportado por esta app, ou cole o conteúdo dele abaixo.' }),
    h('label', { class: 'field-label', for: 'imp-file', text: 'Arquivo' }),
    file,
    h('label', { class: 'field-label', for: 'imp-text', text: 'Ou cole aqui' }),
    area,
    err,
    h(
      'details',
      { class: 'format-help' },
      h('summary', { text: 'Formato do arquivo' }),
      h('p', { class: 'dlg-text', text: 'Só o nome é obrigatório. Campos opcionais: role (lider, membro ou convidado), ministry, about, age (13–17, 18–25, 26–35, 36–50, 51–60, 60+), gender (f ou m), tags, wants, partner (id do par), near e avoid (listas de ids).' }),
    ),
  ];
  const d = openDialog({ title: 'Importar convidados', body, actions: [cancel, load] });
  cancel.addEventListener('click', () => d.close());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      err.textContent = 'O arquivo passa de 2 MB. Confira se é o arquivo certo.';
      return;
    }
    area.value = await f.text();
    err.textContent = '';
  });
  load.addEventListener('click', () => {
    try {
      const st = onLoad(area.value);
      if (st) d.close();
    } catch (e) {
      err.textContent = e.message;
    }
  });
}

export function openSettingsDialog({ state, onSave }) {
  const present = state.people.filter((p) => p.present).length;
  const title = h('input', { type: 'text', class: 'field-input', id: 'set-title', value: state.title, maxlength: 80 });
  const seats = h('input', { type: 'number', class: 'field-input seats-input', id: 'set-seats', min: 1, max: 60, value: state.seatsPerSide, inputmode: 'numeric' });
  const info = h('p', { class: 'dlg-note', 'aria-live': 'polite' });
  const refresh = () => {
    const n = Math.max(1, Math.min(60, parseInt(seats.value, 10) || 1));
    const total = 2 * n;
    info.textContent =
      total >= present
        ? `${total} lugares para ${present} pessoas.`
        : `${total} lugares para ${present} pessoas: ${present - total} ficariam fora da mesa.`;
    info.classList.toggle('warn', total < present);
  };
  const step = (delta) => {
    seats.value = String(Math.max(1, Math.min(60, (parseInt(seats.value, 10) || 1) + delta)));
    refresh();
  };
  seats.addEventListener('input', refresh);
  refresh();
  const save = h('button', { type: 'button', class: 'btn primary', text: 'Salvar' });
  const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancelar' });
  const fit = h('button', { type: 'button', class: 'btn small', text: `Ajustar para ${Math.max(1, Math.ceil(present / 2))} por lado`, onclick: () => { seats.value = String(Math.max(1, Math.ceil(present / 2))); refresh(); } });
  const body = [
    h('label', { class: 'field-label', for: 'set-title', text: 'Nome da mesa' }),
    title,
    h('label', { class: 'field-label', for: 'set-seats', text: 'Lugares em cada lado' }),
    h(
      'div',
      { class: 'stepper' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Menos um lugar por lado', onclick: () => step(-1) }, icon('minus')),
      seats,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mais um lugar por lado', onclick: () => step(1) }, icon('plus')),
      fit,
    ),
    info,
  ];
  const d = openDialog({ title: 'Ajustes da mesa', body, actions: [cancel, save] });
  cancel.addEventListener('click', () => d.close());
  save.addEventListener('click', () => {
    const n = Math.max(1, Math.min(60, parseInt(seats.value, 10) || 1));
    onSave({ title: title.value.trim() || state.title, seatsPerSide: n });
    d.close();
  });
}

export function openHelpDialog() {
  const body = [
    h('p', { class: 'dlg-text', text: 'Cada pessoa tem desejos: ficar ao lado do par, ter alguém com assuntos em comum por perto, conhecer um líder ou alguém novo. O rostinho mostra se ela está feliz com o lugar.' }),
    h(
      'ul',
      { class: 'help-list' },
      h('li', { text: 'Toque numa pessoa para ver os desejos dela, com ✓ e ✗.' }),
      h('li', { text: 'Arraste para trocar de lugar. No celular, toque e segure antes de arrastar.' }),
      h('li', { text: 'Enquanto você arrasta, lugares em verde deixam a mesa mais feliz e a estrela marca o melhor.' }),
      h('li', { text: '"Perto" quer dizer ao lado, em frente ou na diagonal. O próprio par não conta para os assuntos em comum.' }),
      h('li', { text: 'Casais ficam sempre lado a lado. Adolescentes ficam ao lado de quem lidera os adolescentes.' }),
      h('li', { text: 'Fixe alguém com o alfinete para a sugestão automática não mexer no lugar dele.' }),
    ),
    h('p', { class: 'dlg-text', text: 'Privacidade: os nomes ficam salvos só neste aparelho. A app não envia nada para servidor nenhum. O link de compartilhar leva os dados depois do #, parte que não chega ao servidor.' }),
  ];
  const ok = h('button', { type: 'button', class: 'btn primary', text: 'Entendi' });
  const d = openDialog({ title: 'Como funciona', body, actions: [ok] });
  ok.addEventListener('click', () => d.close());
}

// ---------- Editor de pessoas ----------

function tagToggles(allTags, selected, { max, name }) {
  const wrap = h('div', { class: 'tag-toggles', role: 'group', 'aria-label': name });
  for (const [id, t] of Object.entries(allTags)) {
    const b = h('button', { type: 'button', class: 'tagchip', 'aria-pressed': selected.includes(id) ? 'true' : 'false', dataset: { tag: id } }, h('span', { 'aria-hidden': 'true', text: t.icon }), ` ${t.label}`);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') === 'true';
      if (!on && max && wrap.querySelectorAll('[aria-pressed="true"]').length >= max) return;
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
    });
    wrap.append(b);
  }
  return { el: wrap, value: () => [...wrap.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.tag) };
}

export function openPeopleEditor({ getState, update, focusId, toast }) {
  const body = h('div', { class: 'people-editor' });
  const d = openDialog({ title: 'Pessoas', body, wide: true });
  let query = '';

  function showList() {
    const state = getState();
    d.setTitle(`Pessoas (${state.people.length})`);
    const counts = Object.fromEntries(Object.keys(ROLES).map((r) => [r, state.people.filter((p) => p.role === r).length]));
    const going = state.people.filter((p) => p.present).length;
    const search = h('input', { type: 'search', class: 'field-input', placeholder: 'Buscar pelo nome', 'aria-label': 'Buscar pelo nome', value: query });
    const add = h('button', { type: 'button', class: 'btn primary', onclick: () => showForm(null) }, icon('plus', 18), 'Adicionar pessoa');
    const list = h('ul', { class: 'people-list' });
    const fill = () => {
      const q = query.trim().toLowerCase();
      list.replaceChildren(
        ...state.people
          .filter((p) => !q || p.name.toLowerCase().includes(q))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          .map((p) => {
            const going = h('input', { type: 'checkbox', checked: p.present, 'aria-label': `${p.name} vai ao jantar` });
            going.addEventListener('change', () => {
              update((s) => {
                const x = s.people.find((y) => y.id === p.id);
                x.present = going.checked;
                if (!x.present) {
                  for (const [k, v] of Object.entries(s.seating)) if (v === p.id) delete s.seating[k];
                  s.locked = s.locked.filter((k) => s.seating[k]);
                }
              });
            });
            return h(
              'li',
              { class: p.present ? '' : 'is-absent' },
              h('span', { class: 'mini-avatar', vars: { '--c': colorFor(p.id) }, 'aria-hidden': 'true', text: initials(p.name) }),
              h('button', { type: 'button', class: 'people-row', onclick: () => showForm(p.id) }, h('strong', { text: p.name }), h('span', { text: [roleLine(p), p.about].filter(Boolean).join(', ') })),
              h('label', { class: 'going' }, going, h('span', { text: 'Vai' })),
            );
          }),
      );
    };
    search.addEventListener('input', () => {
      query = search.value;
      fill();
    });
    fill();
    body.replaceChildren(
      h('div', { class: 'pe-toolbar' }, search, add),
      h('p', { class: 'dlg-note', text: `${counts.lider} líderes, ${counts.membro} novos membros e ${counts.convidado} convidados. ${going} vão ao jantar.` }),
      list,
    );
  }

  function showForm(pid) {
    const state = getState();
    const p = pid ? state.people.find((x) => x.id === pid) : { id: '', name: '', role: 'membro', ministry: '', about: '', age: '', gender: '', tags: [], wants: [], partner: '', near: [], avoid: [], present: true };
    d.setTitle(pid ? `Editar ${p.name}` : 'Nova pessoa');
    const allTags = { ...DEFAULT_TAGS, ...state.tags };
    const others = state.people.filter((x) => x.id !== pid).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const field = (label, control, help) => h('div', { class: 'field' }, h('label', { class: 'field-label', for: control.id, text: label }), control, help ? h('p', { class: 'field-help', text: help }) : null);

    const name = h('input', { type: 'text', class: 'field-input', id: 'pf-name', value: p.name, maxlength: 60, required: true, autocomplete: 'off' });
    const roleSel = h('select', { class: 'field-input', id: 'pf-role' }, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: p.role === k, text: r.label })));
    const ministry = h('input', { type: 'text', class: 'field-input', id: 'pf-ministry', value: p.ministry, maxlength: 60, placeholder: 'Ex.: Jovens' });
    const about = h('input', { type: 'text', class: 'field-input', id: 'pf-about', value: p.about, maxlength: 120, placeholder: 'Profissão, fase da vida…' });
    const age = h('select', { class: 'field-input', id: 'pf-age' }, h('option', { value: '', text: 'Não informada' }), AGE_BANDS.map((a) => h('option', { value: a, selected: p.age === a, text: `${a} anos` })));
    const gender = h('select', { class: 'field-input', id: 'pf-gender' }, h('option', { value: '', text: 'Não informado' }), h('option', { value: 'f', selected: p.gender === 'f', text: 'Feminino' }), h('option', { value: 'm', selected: p.gender === 'm', text: 'Masculino' }));
    const partner = h('select', { class: 'field-input', id: 'pf-partner' }, h('option', { value: '', text: 'Ninguém' }), others.map((o) => h('option', { value: o.id, selected: p.partner === o.id, text: o.name })));
    const tagsT = tagToggles(allTags, p.tags, { name: 'Interesses' });
    const wantsT = tagToggles(allTags, p.wants, { name: 'Quer papo sobre', max: 3 });
    const nearSel = h('select', { class: 'field-input', id: 'pf-near', multiple: true, size: Math.min(6, Math.max(3, others.length)) }, others.map((o) => h('option', { value: o.id, selected: p.near.includes(o.id), text: o.name })));
    const present = h('input', { type: 'checkbox', id: 'pf-present', checked: p.present });
    const err = h('p', { class: 'field-error', role: 'alert' });
    const ministryField = field('Ministério', ministry);
    const syncRole = () => (ministryField.hidden = roleSel.value !== 'lider');
    roleSel.addEventListener('change', syncRole);
    syncRole();

    const save = h('button', { type: 'button', class: 'btn primary', text: 'Salvar' });
    const back = h('button', { type: 'button', class: 'btn', text: 'Voltar' });
    const del = pid ? h('button', { type: 'button', class: 'btn danger', text: 'Excluir pessoa' }) : null;

    body.replaceChildren(
      h(
        'form',
        { class: 'person-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
        h('div', { class: 'grid-2' }, field('Nome', name), field('Papel', roleSel), ministryField, field('Sobre', about), field('Faixa etária', age), field('Gênero', gender, 'Usado pelos ministérios de homens e de mulheres.'), field('Par (casal ou noivos)', partner, 'O par senta sempre ao lado.')),
        h('fieldset', { class: 'field' }, h('legend', { class: 'field-label', text: 'Interesses' }), tagsT.el),
        h('fieldset', { class: 'field' }, h('legend', { class: 'field-label', text: 'Quer papo sobre (até 3)' }), wantsT.el),
        field('Quer ficar perto de', nearSel, 'Segure Ctrl (ou Cmd) para escolher mais de uma pessoa.'),
        h('label', { class: 'check' }, present, h('span', { text: 'Vai ao jantar' })),
        err,
        h('div', { class: 'form-actions' }, del, h('span', { class: 'spacer' }), back, save),
      ),
    );
    name.focus();
    back.addEventListener('click', showList);
    save.addEventListener('click', () => {
      const nm = name.value.trim();
      if (!nm) {
        err.textContent = 'Escreva o nome da pessoa.';
        name.focus();
        return;
      }
      let savedId = pid;
      update((s) => {
        const taken = new Set(s.people.map((x) => x.id));
        let x = pid ? s.people.find((y) => y.id === pid) : null;
        if (!x) {
          x = { id: uniqueId(slugify(nm), taken), tags: [], wants: [], near: [], avoid: [] };
          s.people.push(x);
          savedId = x.id;
        }
        Object.assign(x, {
          name: nm,
          role: roleSel.value,
          ministry: roleSel.value === 'lider' ? ministry.value.trim() : '',
          about: about.value.trim(),
          age: age.value,
          gender: gender.value,
          tags: tagsT.value(),
          wants: wantsT.value(),
          near: [...nearSel.selectedOptions].map((o) => o.value),
          present: present.checked,
        });
        // Par simétrico: desfaz pares antigos e liga o novo.
        const newPartner = partner.value;
        for (const y of s.people) {
          if (y.id !== x.id && y.partner === x.id && y.id !== newPartner) y.partner = '';
        }
        x.partner = newPartner;
        if (newPartner) {
          const y = s.people.find((z) => z.id === newPartner);
          if (y.partner && y.partner !== x.id) {
            const old = s.people.find((z) => z.id === y.partner);
            if (old) old.partner = '';
          }
          y.partner = x.id;
        }
        if (!x.present) {
          for (const [k, v] of Object.entries(s.seating)) if (v === x.id) delete s.seating[k];
        }
        return normalizeState(s);
      });
      toast(pid ? `${nm}: dados salvos.` : `${nm} entrou na lista. Arraste para um lugar.`);
      if (savedId) showList();
    });
    if (del) {
      del.addEventListener('click', () => {
        update((s) => {
          s.people = s.people.filter((y) => y.id !== pid);
          for (const y of s.people) {
            if (y.partner === pid) y.partner = '';
            y.near = y.near.filter((z) => z !== pid);
            y.avoid = y.avoid.filter((z) => z !== pid);
          }
          for (const [k, v] of Object.entries(s.seating)) if (v === pid) delete s.seating[k];
          s.locked = s.locked.filter((k) => s.seating[k]);
        });
        toast(`${p.name} saiu da lista. Dá para desfazer.`);
        showList();
      });
    }
  }

  if (focusId) showForm(focusId);
  else showList();
  return d;
}
