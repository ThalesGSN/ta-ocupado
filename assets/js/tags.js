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

export function tagInfo(tags, id) {
  return tags[id] || DEFAULT_TAGS[id] || { label: id, icon: '🏷️' };
}
