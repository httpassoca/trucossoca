# Truco Mineiro — mesa 3D co-op

Jogo de Truco Mineiro em 3D, primeira pessoa, 2v2. Salas online com amigos (entrar, escolher a dupla, começar e cair na mesa; as jogadas online vêm em seguida) e a mesa offline contra bots.

```
bun install
bun run dev      # servidor Bun em :3000 + Vite em http://localhost:5173 (com proxy de /api e /ws)
bun test         # regras, protocolo, sala (entrar, lobby, começar, visibilidade, partida, bots, ausência, fantasmas, revanche), host, mesa local, mesa remota e a partida pelo cano
bun run check    # svelte-check + tsc do servidor e do protocolo
bun run build    # cliente em apps/web/dist
bun run start    # servidor servindo o cliente buildado (PORT=3000)
```

## Estrutura

```
packages/rules   motor puro em TypeScript — sem DOM, sem three.js. Vai virar a autoridade do servidor.
  src/types.ts     tipos (Rules, GameState, HandState, Play, GameEvent…) — nomes do glossário em CONTEXT.md:
                   `hand` = mão, `trick` = vaza (evento `trick`), `cards` = cartas que cada cadeira segura
  src/cards.ts     baralho de 40, força das cartas, manilhas fixas
  src/engine.ts    createGame / startHand (ADR 0008: o carteador `dealer` é sorteado na primeira mão e passa para a direita
                   a cada mão; o mão é a cadeira à direita dele, quem corta a da esquerda (`cutterOf`); as cartas saem uma
                   por vez do mão para a direita (`dealOrder`); o evento `newHand` leva `mao`, `dealer` e `cutter`) / playCard
                   (fecha a vaza com 4 cartas; cada jogada leva uma semente de onde a carta cai) / raise / respond / decideDez
                   / handWinner; `handUntouched` = nada aconteceu desde a distribuição; `viewFor(game, viewer)` = a partida
                   como uma cadeira (ou tudo/nada) a vê: `GameView` (com `dealer`), cartas alheias viram null, a coberta de
                   outra cadeira perde o id e o monte vira contagem; `eventsFor` faz o mesmo com o lote de eventos. Os
                   guardas (`canRaise`…) leem `GameReadable`, que serve às duas
  src/bot.ts       decisões dos bots (só olham as próprias cartas) e `thinkTime(rng, kind)`: quanto um bot pensa antes de
                   agir, sorteado (jogar 1-4 s puxado para 1-2 s; responder truco ou decidir a mão de dez 2-4 s)
  test/            bun test; `deck.ts` = `deckFor(hands, mao, rest)`, o baralho que dá a cada cadeira as cartas pedidas
                   (o servidor reusa nos testes roteirizados)

packages/protocol  mensagens cliente ↔ servidor (uniões discriminadas nos dois sentidos: sala, jogadas — play, raise,
                   respond, decideDez, rematch —, `takeBotSeat` (fantasma senta no lugar de um bot), `presence` (posição e
                   olhar) e de volta snapshot, lote de eventos, erro de jogada recusada, presença de outro membro, pong),
                   `RoomSnapshot` (membros com cadeira e bot, duplas, regras, toggle dos fantasmas, cenário, `game` como esta
                   pessoa vê), `parseClientMessage` (valida as regras inteiras, as cartas e a presença, com o `peek` opcional
                   de quem levanta as cartas para olhar), `parseRules` e `isScenery` (o servidor valida o corpo de
                   `POST /api/rooms` com eles), códigos de fechamento do WebSocket, e `DEAL_MS`: quanto toda tela leva para
                   embaralhar, cortar e dar depois do `newHand`; os bots não agem antes disso. Importado pelos dois lados.

apps/server      Bun.serve: HTTP (`/health`, `POST /api/rooms` com corpo JSON opcional `{ rules?, scenery? }`: o que não passa
                 na validação do protocolo é ignorado, cliente estático com fallback SPA) e WebSocket em `/ws`
  src/room.ts      máquina de estado da sala, pura: `step(state, input, now, { rng, deck })` → estado novo, mensagens
                   por token, eventos para o log; timers como dado em `state.timers` (morte em 10 min, saída 20 s após
                   cair, vez de um bot, mão seguinte). Lobby: sentar numa dupla (primeira cadeira livre), levantar,
                   renomear dupla, regras, cenário, toggle dos fantasmas; `start` (só quem senta) preenche cadeiras vazias com
                   bots, dá a primeira mão e tranca duplas, nomes e regras. Partida: as jogadas de quem senta passam
                   pelos guardas do motor (recusa = `error` só para quem errou), os bots agem quando o timer vence: pensam
                   `thinkTime` vezes `pace.think`, e a primeira ação de cada mão espera antes a coreografia de dar as
                   cartas (`pace.deal` = `DEAL_MS`), truco e mão de dez são da dupla (com gente na dupla, o bot parceiro espera),
                   a mão seguinte vem depois da pausa, e no fim de jogo `rematch` (quem senta) devolve a sala ao lobby
                   com as mesmas cadeiras. Ausência: quem cai segura a cadeira 20 s e depois um bot joga por ela
                   (`botControlled`, sem sair da sala; se a queda só foi notada pelo silêncio, os 20 s contam desde o último
                   sinal de vida, `since`); voltar com o mesmo token retoma na hora, com as cartas. Quem está
                   conectada mas parada há 60 s pode ter a cadeira passada a um bot por outra pessoa sentada (`handToBot`;
                   recusa `notIdle` antes disso) e retoma na primeira jogada que manda, valha ou não; os relógios de
                   parada começam com a partida. Fantasma senta no lugar de um bot de verdade (`takeBotSeat`) só na pausa
                   entre mãos (recusa `midHand` no meio de uma); a cadeira de uma pessoa ausente continua dela. `presence`
                   não entra na sala (é o host que repassa) e não é atividade. `snapshotFor` filtra as cartas: cadeira vê
                   só as suas (e as do parceiro na mão de dez), fantasma vê tudo ou nada conforme o toggle, ninguém vê o
                   monte nem a coberta alheia; cada membro leva `idle` (ms sem agir) para quem decide passar uma cadeira
  src/host.ts      `RoomHost`: sockets por token, agenda os timers que a sala pede e nunca os seus — fora o de silêncio:
                   socket que não manda nada (nem `ping`) por 30 s é derrubado como queda (a rede que morre não fecha o socket).
                   Presença passa por aqui, fora da sala: a de cada membro vai aos outros sockets no máximo dez vezes por
                   segundo (`PRESENCE_INTERVAL`), guardando só a mais recente enquanto a janela não abre
  src/rooms.ts     `Rooms`: as salas vivas num mapa em memória (ADR 0004), códigos de 4 letras; `create(init)` nasce com as
                   regras e o cenário pedidos
  src/server.ts    rotas e upgrade; sala inexistente fecha o socket com `CLOSE_ROOM_NOT_FOUND`
  test/            bun test: sala (entrar, sufixo, cair, voltar, morrer), lobby (cadeiras, duplas, começar, trancas,
                   visibilidade, regras e cenário de nascimento), partida (cinco mãos roteirizadas com baralho fixo e o
                   carteador da primeira mão fixado, o carteador passando, recusas, bots por timer com o tempo de pensar e a
                   espera pela coreografia, mão de dez,
                   coberta, ausência: tomada, retomada, passar cadeira, revanche; fantasma senta no lugar de um bot entre
                   mãos), host (silêncio no socket, repasse de presença) e um servidor real numa porta livre (duas abas e
                   dois bots jogam uma partida inteira; `POST /api/rooms` com regras e cenário no corpo)

apps/web         Vite + Svelte 5 + Threlte 8 + three, HUD em dssoca
  src/lib/route.svelte.ts   rotas: `/` início, `/sala/CODE`, `/offline`, `/offline/assistir` (fantasma numa mesa de quatro bots)
  src/lib/screens/          Home em duas colunas: à esquerda abrir sala, entrar com código, jogar offline e "assistir com 4 bots";
                            à direita as regras e o cenário (`hud/RulesPanel`), lembrados no navegador e mandados no corpo de
                            `POST /api/rooms` ao abrir a sala; Room (apelido → lobby com duplas, fantasmas, o mesmo painel de regras
                            mais o toggle dos fantasmas, começar → a mesa, e no menu da mesa a seção da sala: quem caiu, por quem um
                            bot joga, e o botão de passar a cadeira de quem está parada há 1 min); Table (cena + HUD atrás de
                            qualquer `Table`, com a seção extra do menu como snippet); Offline (mesa local; `watch` pela rota)
  src/lib/identity.ts       token por aba (sessionStorage); apelido, regras (validadas com `parseRules`), cenário offline e os
                            grupos abertos do menu lembrados (localStorage)
  src/lib/i18n.ts           a tabela de tradução (pt padrão, en), `translate`, e as dicas em inglês: as chamadas da mesa e as mãos
                            especiais ficam em português nas duas línguas, e `HintBook` dá a dica de cada uma só na primeira vez
                            (lembrado no navegador). Módulo puro, testado. `i18n.svelte.ts` põe a língua num `$state` (`t`, `setLang`,
                            lembrada em localStorage, `<html lang>` acompanha); `hud/LangSwitch` é a troca, no início, na sala e no menu
  src/lib/table/table.ts    interface `Table` (ADR 0003): snapshot imutável (`GameView`, cadeira local ou null = fantasma,
                            quem senta em cada cadeira, os outros fantasmas, duplas, `rulesEditable`, `restart` = nova partida ou
                            revanche), ações, `takeBotSeat` (fantasma senta no lugar de um bot entre mãos), assinatura de eventos,
                            presença (`setPresence`/`presenceOf`, lida por quadro); `actingFor`
  src/lib/table/local.ts    `LocalTable`: motor e bots no navegador; os bots pensam `thinkTime` vezes `botPace` (0.5 rápido, 1 normal,
                            2 devagar) e a primeira ação de cada mão espera a coreografia (`DEAL_MS`); pausa entre mãos; timers
                            injetáveis. `watch`: a pessoa é um fantasma numa mesa de quatro bots (`Nena` na cadeira 0), vê todas as
                            cartas, e `takeBotSeat` a senta no lugar de um bot entre mãos (no meio de uma mão fica como intenção,
                            `wantsSeat`); nova partida devolve ao lugar de fantasma
  src/lib/table/remote.ts   `RemoteTable`: conecta na sala com o token, aplica snapshots, reconecta com espera crescente, pinga
                            (um intervalo inteiro sem nada do servidor = socket morto: fecha e reconecta; `reconnect()` faz o mesmo
                            quando o navegador avisa que perdeu a rede, `retryNow()` quando volta); `watch` = a sala (lobby),
                            `subscribe` = a mesa (cada cadeira diz se é bot ou se um bot joga pela pessoa); ações do lobby, jogadas
                            e `handToBot` viram mensagens (a recusa do servidor é ignorada: o snapshot que temos vale); `newGame`
                            no fim de jogo = revanche; `takeBotSeat` vai na hora entre mãos ou fica como intenção (`wantsSeat`)
                            até a mão acabar; `setPresence` manda a própria, `presenceOf` (por id de fantasma ou por cadeira)
                            guarda a dos outros fora do snapshot
  src/lib/state.svelte.ts   estado reativo: `live.snap` (espelho do snapshot), `live.table` e `ui` (câmera, seleção, menu, regras offline)
  src/lib/controller.ts     cola entre a mesa e a interface: `attachTable`, log, falas, câmera, prompt derivado do snapshot
  src/lib/input.ts          teclado + pointer lock — só fala com `Table`; fantasma anda com WASD/setas e gira sem limite, e não tem tecla de jogo
  test/                     bun test: a tabela de tradução (toda chave nas duas línguas, mesmos parâmetros, chamadas em português nas
                            duas, língua lembrada) e o log (as duas línguas, a carta só valor e naipe, a dica uma vez só e só em inglês);
                            `LocalTable` joga uma partida inteira contra bots sem DOM (ritmo, carteador passando, e quem assiste quatro
                            bots e senta entre mãos); `RemoteTable` com socket falso;
                            `RemoteTable` ligada à sala real por um cano em memória (duas pessoas e dois bots: lobby, partida,
                            revanche; a rede de uma delas morre sem fechar nada: o cano nota o silêncio como o host, o bot
                            entra em 30 s, a aba reconecta sozinha e retoma sem recarregar; e uma fantasma: a presença dela
                            chega aos outros, as jogadas dela são recusadas, e ela senta no lugar de um bot entre mãos)
  src/lib/format.ts         eventos → linhas do log por chave (`LogLine`: mão, vaza, frase e a dica que introduz); `withHint` mantém a
                            dica só em inglês e só na primeira vez; `renderLine` rende na língua da hora (trocar a língua rende o log inteiro)
  src/lib/scene/buddy/      o boneco (ADR 0006): model (feijão torneado, rosto no corpo, braços e pernas; expressões, poses de braço,
                            andar/pular/sentar/quicar, olhar nos olhos e depois no tronco, inclinar, vulto, primeira pessoa),
                            parts (as peças do molho: chapéus, cabelos, barbas, óculos, pescoço, roupas, calçados, o que segura, arara),
                            molho (o molho de cada apelido, sorteado pela semente do apelido; bots vestem os seis regionais),
                            reactions (evento → cara, braços e quique de cada cadeira: quem age, a dupla, os adversários)
  src/lib/scene/scenery/    os cenários (ADR 0007), um módulo por id do protocolo, contra uma interface só (`scenery.ts`: grupo, quatro
                            cadeiras, desenho do baralho, névoa, exposição, cerca, update, dispose): `bar` (bar de esquina no fim de tarde:
                            calçada, fachada, poste de sódio, mesa e cadeiras de plástico, garrafas, copos, cinzeiro, cachorro caramelo,
                            mariposas, fumaça do carrinho; baralho estilo Copag), `graveyard` (cemitério à noite sob a lua de sangue: lápides,
                            criptas, cerca, catedral, corvos, velas e lustre; baralho preto e cobre). `kit.ts`: sorteio semeado, texturas em
                            canvas (null sem DOM), formas curtas, limpeza. Cada cenário roda sem navegador: cadeiras, alturas e zonas das
                            cartas são testadas com `bun test`
  src/lib/scene/            builders (bonecos sentados nas cadeiras do cenário, com a etiqueta sobre a cabeça marcando quem carteia e por quem
                            um bot joga; vultos dos fantasmas; cartas: costas dos dois lados para quem não conhece a carta, vestidas com o
                            baralho do cenário; `monteSpot`, onde o monte fica na frente da mão; a dica sobre uma carta da mesa), throw (onde a
                            carta cai, sorteado da semente da jogada: igual em toda tela), tween (as cartas andam por caminhos no tempo: trechos
                            com destino, hora, duração e arco; `DUR` tem as durações), layout (as cartas de cada cadeira na mão dela: baixas e
                            viradas para baixo, ou levantadas diante do rosto quando a pessoa olha, o bot pensa, ou o parceiro mostra na mão
                            de dez; cartas ocultas, a coberta alheia e o monte são desenhados com as 40 cartas físicas que a pessoa não vê em
                            lugar nenhum; `choreographDeal` monta a coreografia da mão nova a partir do `newHand`: juntar na frente do
                            carteador, embaralhar, cortar à esquerda, uma carta por vez começando pela mão, sobras no monte), gaze (quem
                            senta olha para onde a presença diz e se inclina quanto ela diz; bots olham pelo jogo), camera (olhar, zoom;
                            andar e pular com gravidade: a mesa é chão elevado, o assento também; levantar e sentar; `nearBotSeat` para o
                            fantasma sentar no lugar de um bot; ler de uma presença se a pessoa está de pé e quanto se inclina; a cerca vem
                            do cenário), World.svelte
                            (o cenário do snapshot montado inteiro e trocado inteiro; câmera nos olhos do boneco, sentada ou solta; a própria
                            presença dez vezes por segundo, com altura; um vulto por fantasma; as reações agendadas com um atraso por boneco)
  src/lib/hud/              Score (uma linha no alto e no centro: dupla e pontos, as três vazas de cada dupla como pontos ● ○ ◐, o valor
                            da mão ou a mão especial ou "sua vez", a seta em quem age, e os avisos "fantasma" / "bot joga por você"),
                            Keys (a barra de teclas; some o jogo enquanto as cartas são dadas), Log (maior; um cabeçalho a cada mão,
                            "Mão 4 · vale 2 · carteia Zé", e um traço a cada vaza fechada; a dica em inglês na linha), Prompt (terço de baixo,
                            uma fila de botões cheios: aceitar, correr, pedir mais), Menu (grupos de acordeão: Sala, Comandos, Regras,
                            Cenário, Interface; cada um lembra se ficou aberto; regras trancadas online; seção da sala vinda de fora),
                            RulesPanel (RulesForm + cenário, no início e no lobby), LangSwitch, RulesForm, Seg, Switch
                            (markup vanilla do dssoca). Toda frase passa por `t` (i18n): nada de texto solto

Dockerfile        imagem oficial do Bun em duas etapas: builda o cliente, roda o servidor (ver Deploy)
.github/workflows deploy.yml: push na main → check, test, build da imagem no runner, scp do tar, docker load/stop/start, sonda
deploy/           wizard.sh (passos humanos do deploy) e truco.passoca.dev.nginx (bloco do nginx com upgrade de WebSocket)
```

## Deploy

Um push na `main` põe o jogo em https://truco.passoca.dev (ADR 0001): o workflow `.github/workflows/deploy.yml` roda `check` e
`test`, builda a imagem no runner (nunca no VPS: o build engasga o servidor inteiro), manda o `docker save` por scp e, por SSH,
roda `npm run docker:load` / `docker:stop` / `docker:start` (scripts na raiz; o container escuta em `127.0.0.1:3002`, atrás do
nginx, ao lado do passoca-api) e sonda `/health` e a raiz: sem resposta, o run falha. O `Dockerfile` (imagem oficial do Bun, duas etapas) builda o cliente e roda o servidor; `bun run docker:build && bun run
docker:start` reproduz o container localmente em http://localhost:3002. Os passos humanos (os três segredos `SSH_*` do repo,
o registro DNS, o bloco do nginx em `deploy/truco.passoca.dev.nginx` com upgrade de WebSocket e o certbot) são guiados por
`bash deploy/wizard.sh`, que termina provando HTTPS e o handshake `wss://` de fora.

## Decisões

- **Regras configuráveis** em `Rules`; defaults = Truco Mineiro (Copag): manilhas fixas 4♣ > 7♥ > A♠ > 7♦,
  escada 2 → 4 → 6 → 10 → 12, mão de dez (vale 4, parceiro mostra as cartas), mão de ferro às cegas,
  empate nas três vazas não pontua. Alterações no menu aplicam na próxima mão.
- **Eventos, não texto.** O motor emite `GameEvent`s estruturados; o cliente formata e anima.
  Um servidor autoritativo replica exatamente isso por WebSocket.
- **O carteador é do motor** (ADR 0008): quem dá, quem corta e a ordem das cartas são estado e evento (`newHand`), não
  coreografia da cena; toda tela anima a mesma distribuição, o monte fica na frente do próximo carteador, e os bots
  (servidor e mesa local) só agem depois de `DEAL_MS`, o tempo fixo da coreografia. Bots pensam um tempo sorteado
  (`thinkTime`), para parecer gente.
- **Cartas na mesa** caem "humanamente": `lead` perto do centro, `kill` em cima da carta que mata
  (puxada para quem jogou e atravessada), `tie` ao lado, `lose` e `cover` perto do jogador e tortas.
  Vazas passadas escurecem. O motor só dá a semente da jogada (a mesma para todo mundo); a posição é
  derivada dela no cliente (`scene/throw.ts`).
- **Teclado primeiro.** Mouse só para olhar (pointer lock) e, com o botão direito, chegar perto. Esc solta o mouse e abre o menu.
  Espaço pula: sentado, quica na cadeira; duas vezes, levanta e anda (WASD) e pula pela mesa, subindo nela se quiser, ainda
  jogando pela cadeira; Shift perto da cadeira senta de novo. Enter joga a carta escolhida (espaço não). Sentado, Shift segurado
  levanta as cartas para olhar (todo mundo vê que está olhando); fantasma perto da cadeira de um bot, Shift senta no lugar dele
  entre mãos. A mira (ou o mouse solto) sobre uma carta da mesa diz quem jogou e em que vaza. O esquema com mouse agindo
  (cursor solto sentado, botão direito para olhar) está proposto em `docs/research/controls.md`.
- **Bonecos procedurais** (ADR 0006): cada apelido tem o seu molho, sorteado do apelido, igual em toda tela; bots vestem os seis
  molhos regionais. Ninguém vê as cartas dos outros, de pé ou sentado; só fantasmas, quando a sala deixa: uma carta que a pessoa
  não conhece mostra as costas dos dois lados. Tab só troca de cadeira para fantasma e na mesa offline sem bots.
- **Idioma por navegador** (ADR 0005): português padrão, inglês pela troca no início, na sala e no menu; as chamadas
  ("Truco!", "Seis!", "Corro!") e as mãos especiais ficam em português nas duas, com uma dica em inglês uma vez só.
- **dssoca** via `theme.css` + `vanilla.css` com o contrato de markup dos componentes Svelte —
  trocar por `import { Button } from 'dssoca'` é 1:1 quando quiser. Menu expõe os dois eixos
  (`data-theme`, `data-size-variant`) e um override de `--ss-accent`.

## Pendente

- `vanilla.css` do dssoca@0.17 tem `:where(:scope)a.ss-svc` que o lightningcss (Vite 8) rejeita;
  `build.cssMinify` está desligado até isso ser corrigido no dssoca.
- A spec #1 (sala, lobby, partida inteira, bots do servidor, revanche, ausência, fantasmas, idioma) está inteira. Online, os
  nomes das duplas e dos bots são dado da sala, iguais para todo mundo, e não traduzem; offline, a cadeira 0 e as duplas
  vêm da tabela.
- Onde a carta empatada cai (ao lado × cruzada por cima) — confirmar com a mesa de Minas.
