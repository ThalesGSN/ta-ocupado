// Mesa de exemplo com pessoas fictícias. Nenhum dado real.
export const DEMO = {
  app: 'ta-ocupado',
  version: 1,
  title: 'Jantar de boas-vindas (exemplo)',
  seatsPerSide: 7,
  people: [
    { id: 'aurora', name: 'Aurora', role: 'lider', ministry: 'Louvor', about: 'Professora de música', age: '26–35', gender: 'f', food: 'Bolo de cenoura', tags: ['musica', 'educacao'], wants: ['musica'] },
    { id: 'benicio', name: 'Benício', role: 'lider', ministry: 'Adolescentes', about: 'Estudante de engenharia', age: '18–25', gender: 'm', food: 'Pipoca', tags: ['estudos', 'adolescentes', 'tecnologia'], wants: ['tecnologia'] },
    { id: 'cecilia', name: 'Cecília', role: 'lider', ministry: 'Kids', about: 'Pedagoga, mãe de dois', age: '36–50', gender: 'f', food: 'Pão de queijo', tags: ['educacao', 'familia'], wants: ['familia'] },
    { id: 'davi', name: 'Davi', role: 'lider', ministry: 'Diaconia', about: 'Aposentado, corre todo dia', age: '60+', gender: 'm', food: 'Coxinha', tags: ['fitness', 'familia'], wants: ['fitness'] },
    { id: 'helena', name: 'Helena', role: 'lider', ministry: 'Comunicação', about: 'Fotógrafa', age: '26–35', gender: 'f', food: 'Brigadeiro', tags: ['comunicacao', 'arte'], wants: ['arte'] },
    { id: 'elisa', name: 'Elisa', role: 'membro', about: 'Designer', age: '26–35', gender: 'f', partner: 'fabio', tags: ['arte', 'casados'], wants: ['arte'] },
    { id: 'fabio', name: 'Fábio', role: 'membro', about: 'Engenheiro de dados', age: '26–35', gender: 'm', partner: 'elisa', tags: ['tecnologia', 'casados'], wants: ['tecnologia'] },
    { id: 'igor', name: 'Igor', role: 'membro', about: 'Médico residente', age: '26–35', gender: 'm', partner: 'joana', tags: ['saude', 'casados'], wants: ['saude'] },
    { id: 'joana', name: 'Joana', role: 'membro', about: 'Professora', age: '26–35', gender: 'f', partner: 'igor', tags: ['educacao', 'casados'], wants: ['educacao'] },
    { id: 'lara', name: 'Lara', role: 'membro', about: 'Estudante, neta do Davi', age: '13–17', gender: 'f', tags: ['adolescentes', 'estudos', 'musica'], wants: ['musica'], near: ['davi'] },
    { id: 'miguel', name: 'Miguel', role: 'membro', about: 'Programador', age: '18–25', gender: 'm', tags: ['tecnologia', 'jovens', 'musica'], wants: ['jovens'] },
    { id: 'nina', name: 'Nina', role: 'membro', about: 'Enfermeira', age: '26–35', gender: 'f', tags: ['saude'], wants: ['saude'] },
    { id: 'otavio', name: 'Otávio', role: 'membro', about: 'Personal trainer', age: '18–25', gender: 'm', tags: ['fitness', 'jovens'], wants: ['fitness'] },
    { id: 'paula', name: 'Paula', role: 'convidado', about: 'Mãe de gêmeos', age: '36–50', gender: 'f', tags: ['familia'], wants: ['familia'] },
  ],
  // Começa bagunçada de propósito: o desafio é deixar todo mundo feliz.
  seating: {
    A0: 'aurora', A1: 'benicio', A2: 'cecilia', A3: 'davi', A4: 'helena', A5: 'elisa', A6: 'paula',
    B0: 'igor', B1: 'joana', B2: 'lara', B3: 'miguel', B4: 'nina', B5: 'otavio', B6: 'fabio',
  },
  locked: [],
};
