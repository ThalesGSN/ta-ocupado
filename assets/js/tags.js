// Catálogo de interesses. Cada pessoa tem `tags` (o que a descreve) e
// `wants` (assuntos que ela quer ter por perto na mesa).
export const DEFAULT_TAGS = {
  tecnologia: { label: 'Tecnologia', icon: '💻' },
  saude: { label: 'Saúde', icon: '🩺' },
  fitness: { label: 'Esporte e fitness', icon: '🏃' },
  psicologia: { label: 'Psicologia', icon: '🧠' },
  educacao: { label: 'Educação', icon: '📚' },
  lei: { label: 'Direito e segurança', icon: '⚖️' },
  comunicacao: { label: 'Comunicação', icon: '📣' },
  negocios: { label: 'Negócios', icon: '💼' },
  eventos: { label: 'Eventos e hospitalidade', icon: '🎉' },
  familia: { label: 'Filhos e bebês', icon: '🍼' },
  casados: { label: 'Vida de casado', icon: '💍' },
  jovens: { label: 'Galera jovem', icon: '🎧' },
  estudos: { label: 'Estudos', icon: '🎓' },
  adolescentes: { label: 'Adolescentes', icon: '🛹' },
  musica: { label: 'Música', icon: '🎵' },
  cozinha: { label: 'Cozinha', icon: '🍳' },
  viagens: { label: 'Viagens', icon: '✈️' },
  arte: { label: 'Arte e design', icon: '🎨' },
};

export const AGE_BANDS = ['13–17', '18–25', '26–35', '36–50', '51–60', '60+'];

export const ROLES = {
  lider: { label: 'Líder', plural: 'Líderes' },
  membro: { label: 'Novo membro', plural: 'Novos membros' },
  convidado: { label: 'Convidado', plural: 'Convidados' },
};

const FOOD_ICONS = [
  [/🤷/, '🤷'],
  [/brownie|chocolate|brigadeiro|trufa/i, '🍫'],
  [/p[ãa]o de queijo|queijo/i, '🧀'],
  [/pastel|coxinha|salgad|empada|esfirra|kibe|quibe/i, '🥟'],
  [/bolo|torta|cake|cupcake/i, '🍰'],
  [/pipoca/i, '🍿'],
  [/pizza/i, '🍕'],
  [/sandu[íi]che|misto|lanche/i, '🥪'],
  [/refri|suco|bebida|guaran[áa]|ch[áa]\b|caf[ée]/i, '🥤'],
  [/fruta|morango|salada de fruta/i, '🍓'],
  [/sorvete|picol[ée]/i, '🍨'],
  [/biscoito|cookie|bolacha/i, '🍪'],
  [/p[ãa]o/i, '🥖'],
  [/doce|pudim|mousse/i, '🍮'],
];

export function foodIcon(food) {
  if (!food) return '';
  for (const [re, icon] of FOOD_ICONS) if (re.test(food)) return icon;
  return '🍽️';
}

export function tagInfo(tags, id) {
  return tags[id] || DEFAULT_TAGS[id] || { label: id, icon: '🏷️' };
}
