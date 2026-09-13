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
  src/engine.ts    createGame / startHand / playCard (fecha a vaza com 4 cartas; cada jogada leva uma semente de onde a
                   carta cai) / raise / respond / decideDez / handWinner; `viewFor(game, viewer)` = a partida como uma
                   cadeira (ou tudo/nada) a vê: `GameView`, cartas alheias viram null, a coberta de outra cadeira perde o
                   id e o monte vira contagem; `eventsFor` faz o mesmo com o lote de eventos. Os guardas (`canRaise`…)
                   leem `GameReadable`, que serve às duas
  src/bot.ts       decisões dos bots (só olham as próprias cartas)
  test/            bun test

packages/protocol  mensagens cliente ↔ servidor (uniões discriminadas nos dois sentidos: sala, jogadas — play, raise,
                   respond, decideDez, rematch —, `takeBotSeat` (fantasma senta no lugar de um bot), `presence` (posição e
                   olhar) e de volta snapshot, lote de eventos, erro de jogada recusada, presença de outro membro, pong),
                   `RoomSnapshot` (membros com cadeira e bot, duplas, regras, toggle dos fantasmas, `game` como esta
                   pessoa vê), `parseClientMessage` (valida as regras inteiras e as cartas), códigos de fechamento do
                   WebSocket. Importado pelos dois lados.

apps/server      Bun.serve: HTTP (`/health`, `POST /api/rooms`, cliente estático com fallback SPA) e WebSocket em `/ws`
  src/room.ts      máquina de estado da sala, pura: `step(state, input, now, { rng, deck })` → estado novo, mensagens
                   por token, eventos para o log; timers como dado em `state.timers` (morte em 10 min, saída 20 s após
                   cair, vez de um bot, mão seguinte). Lobby: sentar numa dupla (primeira cadeira livre), levantar,
                   renomear dupla, regras, toggle dos fantasmas; `start` (só quem senta) preenche cadeiras vazias com
                   bots, dá a primeira mão e tranca duplas, nomes e regras. Partida: as jogadas de quem senta passam
                   pelos guardas do motor (recusa = `error` só para quem errou), os bots agem quando o timer vence no
                   ritmo da sala (`pace`), truco e mão de dez são da dupla (com gente na dupla, o bot parceiro espera),
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
  src/rooms.ts     `Rooms`: as salas vivas num mapa em memória (ADR 0004), códigos de 4 letras
  src/server.ts    rotas e upgrade; sala inexistente fecha o socket com `CLOSE_ROOM_NOT_FOUND`
  test/            bun test: sala (entrar, sufixo, cair, voltar, morrer), lobby (cadeiras, duplas, começar, trancas,
                   visibilidade), partida (cinco mãos roteirizadas com baralho fixo, recusas, bots por timer, mão de dez,
                   coberta, ausência: tomada, retomada, passar cadeira, revanche; fantasma senta no lugar de um bot entre
                   mãos), host (silêncio no socket, repasse de presença) e um servidor real numa porta livre (duas abas e
                   dois bots jogam uma partida inteira)

apps/web         Vite + Svelte 5 + Threlte 8 + three, HUD em dssoca
  src/lib/route.svelte.ts   rotas: `/` início, `/sala/CODE`, `/offline`
  src/lib/screens/          Home (abrir sala, entrar com código, offline); Room (apelido → lobby com duplas, fantasmas, regras,
                            toggle, começar → a mesa, e no menu da mesa a seção da sala: quem caiu, por quem um bot joga, e o
                            botão de passar a cadeira de quem está parada há 1 min); Table (cena + HUD atrás de qualquer `Table`,
                            com a seção extra do menu como snippet); Offline (mesa local)
  src/lib/identity.ts       token por aba (sessionStorage) e apelido lembrado (localStorage)
  src/lib/table/table.ts    interface `Table` (ADR 0003): snapshot imutável (`GameView`, cadeira local ou null = fantasma,
                            quem senta em cada cadeira, os outros fantasmas, duplas, `rulesEditable`, `restart` = nova partida ou
                            revanche), ações, assinatura de eventos, presença (`setPresence`/`presenceOf`, lida por quadro); `actingFor`
  src/lib/table/local.ts    `LocalTable`: motor e bots no navegador, com ritmo dos bots e pausa entre mãos (timers injetáveis)
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
  test/                     bun test: `LocalTable` joga uma partida inteira contra bots sem DOM; `RemoteTable` com socket falso;
                            `RemoteTable` ligada à sala real por um cano em memória (duas pessoas e dois bots: lobby, partida,
                            revanche; a rede de uma delas morre sem fechar nada: o cano nota o silêncio como o host, o bot
                            entra em 30 s, a aba reconecta sozinha e retoma sem recarregar; e uma fantasma: a presença dela
                            chega aos outros, as jogadas dela são recusadas, e ela senta no lugar de um bot entre mãos)
  src/lib/format.ts         eventos → texto (PT-BR)
  src/lib/scene/            builders (personagens/cartas/fantasmas procedurais), throw (onde a carta cai, sorteado da semente da
                            jogada: igual em toda tela), layout (cartas ocultas, a coberta alheia e o monte são desenhados com as
                            40 cartas físicas que a pessoa não vê em lugar nenhum), gaze (cabeça de quem senta segue a presença
                            que a pessoa mandou; bots olham pelo jogo), camera (olhar; fantasma: andar, ficar atrás de uma cadeira),
                            World.svelte (câmera sentada ou solta, a própria presença dez vezes por segundo, um vulto por fantasma)
  src/lib/hud/              Score (com o aviso "bot joga por você"), Seats (·bot / ·bot jogando), Keys, Log, Prompt, Menu (regras trancadas
                            online; seção da sala vinda de fora), RulesForm, Seg, Switch (markup vanilla do dssoca)

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
- **Cartas na mesa** caem "humanamente": `lead` perto do centro, `kill` em cima da carta que mata
  (puxada para quem jogou e atravessada), `tie` ao lado, `lose` e `cover` perto do jogador e tortas.
  Vazas passadas escurecem. O motor só dá a semente da jogada (a mesma para todo mundo); a posição é
  derivada dela no cliente (`scene/throw.ts`).
- **Teclado primeiro.** Mouse só para olhar (pointer lock). Esc solta o mouse e abre o menu.
- **dssoca** via `theme.css` + `vanilla.css` com o contrato de markup dos componentes Svelte —
  trocar por `import { Button } from 'dssoca'` é 1:1 quando quiser. Menu expõe os dois eixos
  (`data-theme`, `data-size-variant`) e um override de `--ss-accent`.

## Pendente

- `vanilla.css` do dssoca@0.17 tem `:where(:scope)a.ss-svc` que o lightningcss (Vite 8) rejeita;
  `build.cssMinify` está desligado até isso ser corrigido no dssoca.
- Rede: sala, lobby, partida inteira, bots do servidor, revanche, ausência (bot joga por quem cai ou fica parada;
  a pessoa retoma ao voltar ou agir) e fantasmas (andam pela mesa, todo mundo os vê, sentam no lugar de um bot entre
  mãos) já existem (spec #1). Falta a troca de idioma.
- Onde a carta empatada cai (ao lado × cruzada por cima) — confirmar com a mesa de Minas.
