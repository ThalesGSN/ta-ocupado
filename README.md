# Tá ocupado?

Um quebra-cabeça para montar a mesa de um evento. Cada convidado tem preferências: ficar ao lado do par, ter alguém com assuntos em comum por perto, conhecer um líder ou alguém novo. Um rostinho mostra se a pessoa está feliz com o lugar. Você arrasta as pessoas até todo mundo sorrir, ou pede uma sugestão automática.

Inspirado no jogo de quebra-cabeça *Is This Seat Taken?* (Poti Poti Studio). Visual e código são originais.

## Como usar

- **Abrir o exemplo** carrega uma mesa fictícia, bagunçada de propósito.
- **Importar convidados** lê um arquivo `.json` (formato abaixo).
- **Sugerir mesa** monta um arranjo automático que respeita as regras.
- **Arrastar e soltar** troca as pessoas de lugar. No celular, toque e segure antes de arrastar. Enquanto você arrasta, os lugares em verde deixam a mesa mais feliz, e a estrela marca o melhor.
- **Tocar numa pessoa** mostra os desejos dela (✓ e ✗), quem está em volta e as ações: mudar de lugar (também pelo teclado), fixar o lugar, tirar da mesa, marcar que não vai e editar.
- **Desfazer/Refazer** (Ctrl+Z / Ctrl+Shift+Z), **Imprimir** (A4 deitado) e **Ajustes** (nome da mesa e lugares por lado).

### Regras da mesa

A mesa é retangular, com lugares dos dois lados (A1…An de um lado e B1…Bn do outro). "Perto" quer dizer ao lado, em frente ou na diagonal.

| Regra | Tipo |
| --- | --- |
| Casal (ou noivos) senta lado a lado | obrigatória |
| Adolescente senta ao lado de quem lidera o ministério de adolescentes | obrigatória |
| Ficar perto de alguém da família ou de um amigo (`near`) | desejo |
| Papo sobre um assunto (`wants`): alguém por perto com o mesmo interesse. O próprio par não conta | desejo |
| Novo membro ou convidado quer um líder por perto | desejo |
| Líder quer conhecer alguém novo (os ministérios de homens e de mulheres procuram pessoas do mesmo gênero) | desejo |

A sugestão automática usa recozimento simulado (*simulated annealing*), roda num Web Worker e evita juntar líderes do mesmo ministério.

## Privacidade

- **Nenhum dado de pessoas fica neste repositório.** O exemplo usa nomes inventados, e o `.gitignore` bloqueia arquivos de convidados.
- A app não faz requisições de rede. A política de segurança da página (`connect-src 'none'`) proíbe isso.
- A mesa fica salva só no navegador de quem usa (`localStorage`). Use **Apagar dados deste aparelho** para limpar.
- O link de **Compartilhar** leva os dados compactados depois do `#`. O navegador não envia essa parte ao servidor, mas qualquer pessoa com o link vê a mesa: mande só para quem precisa.

## Formato do arquivo

Só o nome é obrigatório.

```json
{
  "title": "Jantar de boas-vindas",
  "seatsPerSide": 8,
  "people": [
    {
      "id": "ana",
      "name": "Ana",
      "role": "lider",
      "ministry": "Jovens",
      "about": "Professora",
      "age": "26–35",
      "gender": "f",
      "tags": ["educacao", "musica"],
      "wants": ["musica"],
      "partner": "beto",
      "near": [],
      "avoid": [],
      "present": true
    }
  ],
  "seating": { "A0": "ana" },
  "locked": []
}
```

- `role`: `lider`, `membro` ou `convidado`
- `age`: `13–17`, `18–25`, `26–35`, `36–50`, `51–60` ou `60+`
- `tags` e `wants`: `tecnologia`, `saude`, `fitness`, `psicologia`, `educacao`, `lei`, `comunicacao`, `negocios`, `eventos`, `familia`, `casados`, `jovens`, `estudos`, `adolescentes`, `musica`, `cozinha`, `viagens` e `arte` (dá para criar outras em `tags`)
- `seating`: lugar → id da pessoa. Os lugares começam em `A0`/`B0`, e a tela mostra A1/B1.

## Rodar localmente

Não há dependências nem etapa de build: são arquivos estáticos.

```bash
python3 -m http.server 8080   # abra http://localhost:8080
npm test                       # testes do modelo, do otimizador e do link (Node 20+)
```

## Publicação

Site: https://thalesgsn.github.io/ta-ocupado/

O GitHub Pages publica a branch `gh-pages` (pasta raiz). Para publicar uma atualização feita na `main`:

```bash
git push origin main main:gh-pages
```

O arquivo `.nojekyll` desliga o processamento do Jekyll.

## Créditos

- Fontes [Nunito](https://github.com/googlefonts/nunito) e [Shrikhand](https://github.com/jonpinhorn/shrikhand), sob a SIL Open Font License (licenças em `assets/fonts/`).
- Estampa de chita desenhada para este projeto.

Licença do código: MIT.
